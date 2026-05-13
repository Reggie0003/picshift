/**
 * Auth service: signup, login, MFA enrollment / verification,
 * refresh token rotation, logout.
 *
 * Threat model addressed:
 *   - Credential stuffing → Argon2id + Redis-backed lockout
 *   - Session theft       → Refresh tokens hashed in DB; revoke-on-rotate
 *   - MFA bypass          → MFA flag is part of the access token claims
 *   - Phishing            → Tokens scoped to org and audience; HSTS in prod
 *   - User enumeration    → Generic "invalid credentials" on every failure
 */
import { randomUUID } from 'node:crypto';
import { getPrisma } from '@/lib/prisma.js';
import { getRedis } from '@/lib/redis.js';
import {
  generateOpaqueToken,
  hashRefreshToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '@/lib/jwt.js';
import { hashPassword, verifyPassword } from '@/lib/passwords.js';
import {
  buildOtpAuthUri,
  buildTotpQrPng,
  generateTotpSecret,
  verifyTotp,
} from '@/lib/totp.js';
import { decryptField, encryptField } from '@/lib/crypto.js';
import { ApiError } from '@/lib/errors.js';
import { env } from '@/config/env.js';
import { clearLockout, isLockedOut, recordFailedLogin } from '@/lib/lockout.js';
import { recordAudit } from '@/modules/audit/audit.service.js';
import type { SignupInput } from '@/modules/auth/auth.schemas.js';

const MFA_CHALLENGE_TTL_SECONDS = 300; // 5 minutes

export interface AuthContext {
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
}

export interface LoginResult {
  status: 'mfa_required' | 'authenticated';
  tokens?: AuthTokens;
  mfaChallengeId?: string;
  user?: { id: string; email: string; fullName: string; orgId: string; mfaEnrolled: boolean };
}

// -- Signup -------------------------------------------------------------------

export async function signup(input: SignupInput, ctx: AuthContext): Promise<{
  user: { id: string; email: string };
  organization: { id: string; slug: string };
  tokens: AuthTokens;
}> {
  const prisma = getPrisma();

  // Email uniqueness is enforced per-organization, but during signup we
  // also create the org, so check globally.
  const existing = await prisma.user.findFirst({ where: { email: input.email } });
  if (existing) {
    // Don't leak whether email exists — return a generic conflict.
    throw ApiError.conflict('Could not create account with the provided details');
  }

  const slug = await deriveOrgSlug(input.organizationName);
  const passwordHash = await hashPassword(input.password);

  const created = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.organizationName,
        slug,
        country: input.country,
        timezone: input.country === 'GH' ? 'Africa/Accra' : input.country === 'NG' ? 'Africa/Lagos' : 'UTC',
        baseCurrency: input.country === 'GH' ? 'GHS' : input.country === 'NG' ? 'NGN' : 'USD',
      },
    });

    const user = await tx.user.create({
      data: {
        organizationId: org.id,
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        status: 'active',
      },
    });

    await tx.roleAssignment.create({
      data: {
        userId: user.id,
        organizationId: org.id,
        role: 'org_owner',
      },
    });

    // Consent ledger entries for ToS + Privacy.
    await tx.consentRecord.createMany({
      data: [
        {
          organizationId: org.id,
          userId: user.id,
          consentType: 'terms_of_service',
          version: '2026-05-01-v1',
          granted: true,
          grantedAt: new Date(),
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        {
          organizationId: org.id,
          userId: user.id,
          consentType: 'privacy_policy',
          version: '2026-05-01-v1',
          granted: true,
          grantedAt: new Date(),
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
      ],
    });

    return { org, user };
  });

  const tokens = await issueSession({
    userId: created.user.id,
    orgId: created.org.id,
    roles: ['org_owner'],
    mfa: false,
    ctx,
  });

  await recordAudit({
    organizationId: created.org.id,
    actorId: created.user.id,
    action: 'create',
    entityType: 'user',
    entityId: created.user.id,
    after: { email: created.user.email, role: 'org_owner' },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });
  await recordAudit({
    organizationId: created.org.id,
    actorId: created.user.id,
    action: 'consent_granted',
    entityType: 'consent',
    metadata: { types: ['terms_of_service', 'privacy_policy'] },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });

  return {
    user: { id: created.user.id, email: created.user.email },
    organization: { id: created.org.id, slug: created.org.slug },
    tokens,
  };
}

async function deriveOrgSlug(name: string): Promise<string> {
  const prisma = getPrisma();
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'org';
  let slug = base;
  let i = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    i += 1;
    slug = `${base}-${i}`;
    if (i > 50) {
      slug = `${base}-${Date.now().toString(36)}`;
      break;
    }
  }
  return slug;
}

// -- Login --------------------------------------------------------------------

export async function login(
  email: string,
  password: string,
  ctx: AuthContext,
): Promise<LoginResult> {
  const prisma = getPrisma();
  const ip = ctx.ipAddress ?? 'unknown';

  if (await isLockedOut(email, ip)) {
    throw ApiError.accountLocked();
  }

  const user = await prisma.user.findFirst({
    where: { email },
    include: { roles: true },
  });

  if (!user || user.status !== 'active') {
    await recordFailedLogin(email, ip);
    await recordAudit({
      action: 'login_failed',
      entityType: 'user',
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      metadata: { email, reason: 'unknown_or_inactive' },
    });
    throw ApiError.invalidCredentials();
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    await recordFailedLogin(email, ip);
    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'login_failed',
      entityType: 'user',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      metadata: { reason: 'bad_password' },
    });
    throw ApiError.invalidCredentials();
  }

  await clearLockout(email, ip);

  const roles = (user.roles ?? []).map((r) => r.role);

  // If MFA enrolled, issue a short-lived challenge and require /auth/mfa/verify.
  if (user.mfaEnrolledAt && user.mfaSecretEnc) {
    const challengeId = randomUUID();
    const r = getRedis();
    await r.setex(
      `mfa:challenge:${challengeId}`,
      MFA_CHALLENGE_TTL_SECONDS,
      JSON.stringify({ userId: user.id, orgId: user.organizationId, roles }),
    );
    return {
      status: 'mfa_required',
      mfaChallengeId: challengeId,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        orgId: user.organizationId,
        mfaEnrolled: true,
      },
    };
  }

  const tokens = await issueSession({
    userId: user.id,
    orgId: user.organizationId,
    roles,
    mfa: false,
    ctx,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ctx.ipAddress },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: 'login',
    entityType: 'user',
    entityId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });

  return {
    status: 'authenticated',
    tokens,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      orgId: user.organizationId,
      mfaEnrolled: false,
    },
  };
}

// -- MFA challenge verification ----------------------------------------------

export async function verifyMfaChallenge(
  challengeId: string,
  totp: string,
  ctx: AuthContext,
): Promise<AuthTokens> {
  const prisma = getPrisma();
  const r = getRedis();

  const raw = await r.get(`mfa:challenge:${challengeId}`);
  if (!raw) throw ApiError.unauthorized('MFA challenge expired or invalid');

  const challenge = JSON.parse(raw) as { userId: string; orgId: string; roles: string[] };
  const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
  if (!user || !user.mfaSecretEnc) throw ApiError.unauthorized();

  const secret = decryptField(user.mfaSecretEnc);
  if (!secret || !verifyTotp(secret, totp)) {
    await recordAudit({
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'login_failed',
      entityType: 'user',
      entityId: user.id,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      metadata: { reason: 'bad_totp' },
    });
    throw ApiError.invalidCredentials('Invalid MFA code');
  }

  await r.del(`mfa:challenge:${challengeId}`);

  const tokens = await issueSession({
    userId: user.id,
    orgId: user.organizationId,
    roles: challenge.roles,
    mfa: true,
    ctx,
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), lastLoginIp: ctx.ipAddress },
  });

  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: 'mfa_verified',
    entityType: 'user',
    entityId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });

  return tokens;
}

// -- MFA enrollment -----------------------------------------------------------

export async function startMfaEnrollment(userId: string): Promise<{
  secret: string;
  otpauthUri: string;
  qrPngDataUrl: string;
}> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound();

  const secret = generateTotpSecret();
  const otpauthUri = buildOtpAuthUri({
    secret,
    account: user.email,
    issuer: `Pic Shift`,
  });
  const qrPngDataUrl = await buildTotpQrPng(otpauthUri);

  // Store the secret encrypted, but don't activate MFA until the user
  // confirms a valid TOTP via /auth/mfa/enroll/verify.
  await prisma.user.update({
    where: { id: userId },
    data: { mfaSecretEnc: encryptField(secret) },
  });

  return { secret, otpauthUri, qrPngDataUrl };
}

export async function confirmMfaEnrollment(
  userId: string,
  totp: string,
  ctx: AuthContext,
): Promise<void> {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.mfaSecretEnc) throw ApiError.badRequest('No MFA enrollment in progress');
  const secret = decryptField(user.mfaSecretEnc);
  if (!secret || !verifyTotp(secret, totp)) {
    throw ApiError.invalidCredentials('Invalid TOTP code');
  }
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnrolledAt: new Date() },
  });
  await recordAudit({
    organizationId: user.organizationId,
    actorId: user.id,
    action: 'mfa_enrolled',
    entityType: 'user',
    entityId: user.id,
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });
}

// -- Refresh / logout ---------------------------------------------------------

export async function refreshTokens(refreshToken: string, ctx: AuthContext): Promise<AuthTokens> {
  const prisma = getPrisma();
  const payload = await verifyRefreshToken(refreshToken);
  const tokenHash = hashRefreshToken(refreshToken);

  const session = await prisma.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.refreshTokenHash !== tokenHash || session.revokedAt) {
    throw ApiError.tokenInvalid('Refresh token reuse or revocation detected');
  }
  if (session.expiresAt < new Date()) {
    throw ApiError.tokenExpired();
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { roles: true },
  });
  if (!user || user.status !== 'active') throw ApiError.unauthorized();

  // Rotate: revoke the old session, issue a new one
  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  return issueSession({
    userId: user.id,
    orgId: user.organizationId,
    roles: (user.roles ?? []).map((r) => r.role),
    mfa: !!user.mfaEnrolledAt,
    ctx,
  });
}

export async function logout(refreshToken: string, ctx: AuthContext): Promise<void> {
  const prisma = getPrisma();
  try {
    const payload = await verifyRefreshToken(refreshToken);
    await prisma.session.update({
      where: { id: payload.sid },
      data: { revokedAt: new Date() },
    }).catch(() => undefined);
    await recordAudit({
      organizationId: payload.org,
      actorId: payload.sub,
      action: 'logout',
      entityType: 'user',
      entityId: payload.sub,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  } catch {
    // Best-effort logout; swallow invalid-token errors
  }
}

// -- Helpers ------------------------------------------------------------------

async function issueSession(args: {
  userId: string;
  orgId: string;
  roles: string[];
  mfa: boolean;
  ctx: AuthContext;
}): Promise<AuthTokens> {
  const prisma = getPrisma();
  const sid = generateOpaqueToken(16);

  const refreshToken = await signRefreshToken({
    sub: args.userId,
    sid,
    org: args.orgId,
  });
  const refreshTokenHash = hashRefreshToken(refreshToken);

  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL * 1000);

  await prisma.session.create({
    data: {
      id: sid,
      userId: args.userId,
      refreshTokenHash,
      ipAddress: args.ctx.ipAddress,
      userAgent: args.ctx.userAgent,
      expiresAt,
    },
  });

  const accessToken = await signAccessToken({
    sub: args.userId,
    org: args.orgId,
    roles: args.roles,
    mfa: args.mfa,
  });

  return {
    accessToken,
    refreshToken,
    accessTtlSeconds: env.JWT_ACCESS_TTL,
    refreshTtlSeconds: env.JWT_REFRESH_TTL,
  };
}
