/**
 * Idempotent seed for local development. Creates a demo organization with
 * Ghana defaults, an org_owner user, and the standard PTO policies.
 *
 * Run with: npm run seed
 */
import { hashPassword } from '@/lib/passwords.js';
import { getPrisma, closePrisma } from '@/lib/prisma.js';
import { seedDefaultPolicies } from '@/modules/pto/pto.service.js';
import { logger } from '@/lib/logger.js';

async function main(): Promise<void> {
  const prisma = getPrisma();

  const slug = 'acme-gh';
  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    logger.info('seed: organization already exists, skipping');
    return;
  }

  const org = await prisma.organization.create({
    data: {
      name: 'Acme Ghana Ltd',
      slug,
      country: 'GH',
      timezone: 'Africa/Accra',
      baseCurrency: 'GHS',
      registeredName: 'Acme Ghana Limited',
    },
  });

  const passwordHash = await hashPassword('OwnerPassword!2026');
  const owner = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'owner@acme.gh',
      passwordHash,
      fullName: 'Ama Owner',
      status: 'active',
    },
  });
  await prisma.roleAssignment.create({
    data: { userId: owner.id, organizationId: org.id, role: 'org_owner' },
  });

  await seedDefaultPolicies(org.id, 'GH');

  logger.info(
    { orgSlug: slug, ownerEmail: owner.email },
    'seed complete (login: owner@acme.gh / OwnerPassword!2026)',
  );
}

main()
  .then(closePrisma)
  .catch(async (err) => {
    logger.fatal({ err }, 'seed failed');
    await closePrisma();
    process.exit(1);
  });
