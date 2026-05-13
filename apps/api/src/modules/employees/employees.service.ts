/**
 * Employee CRUD with field-level encryption for PII columns.
 *
 * Pattern: encryptField() before write, decryptField() before serialise.
 * Searchable equality lookups go via the *_hash columns (lib/crypto.hashSearchable).
 */
import type { EmployeeProfile, Prisma } from '@prisma/client';
import { getPrisma } from '@/lib/prisma.js';
import { decryptField, encryptField, hashSearchable, maskLast4 } from '@/lib/crypto.js';
import { ApiError } from '@/lib/errors.js';
import type {
  CreateEmployeeInput,
  ListEmployeesQuery,
  UpdateEmployeeInput,
} from '@/modules/employees/employees.schemas.js';
import { recordAudit } from '@/modules/audit/audit.service.js';

export interface EmployeeView {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  workEmail: string | null;
  workPhone: string | null;
  jobTitle: string | null;
  department: string | null;
  status: string;
  employmentType: string;
  payFrequency: string;
  currency: string;
  baseSalaryMinor: string | null; // BigInt → string for JSON safety
  hiredAt: string | null;
  // Decrypted (HR/admin views)
  ghanaCard?: string | null;
  ssnitNumber?: string | null;
  tin?: string | null;
  bvn?: string | null;
  nin?: string | null;
  dob?: string | null;
  address?: string | null;
  // Always masked
  bankAccountMasked: string | null;
  momoNumberMasked: string | null;
}

export type EmployeeViewMode = 'self' | 'manager' | 'admin';

async function generateEmployeeNumber(orgId: string): Promise<string> {
  const prisma = getPrisma();
  const year = new Date().getFullYear();
  const count = await prisma.employeeProfile.count({
    where: { organizationId: orgId },
  });
  const next = String(count + 1).padStart(4, '0');
  return `PS-${year}-${next}`;
}

export async function createEmployee(
  orgId: string,
  input: CreateEmployeeInput,
  actor: { userId: string; ip: string | null; userAgent: string | null; requestId: string },
): Promise<EmployeeView> {
  const prisma = getPrisma();

  // Uniqueness checks via hash (cheap equality lookups on encrypted PII)
  if (input.ghanaCard) {
    const exists = await prisma.employeeProfile.findFirst({
      where: { organizationId: orgId, ghanaCardHash: hashSearchable(input.ghanaCard) },
    });
    if (exists) throw ApiError.conflict('An employee with this Ghana Card already exists');
  }
  if (input.ssnitNumber) {
    const exists = await prisma.employeeProfile.findFirst({
      where: { organizationId: orgId, ssnitNumberHash: hashSearchable(input.ssnitNumber) },
    });
    if (exists) throw ApiError.conflict('An employee with this SSNIT number already exists');
  }
  if (input.bvn) {
    const exists = await prisma.employeeProfile.findFirst({
      where: { organizationId: orgId, bvnHash: hashSearchable(input.bvn) },
    });
    if (exists) throw ApiError.conflict('An employee with this BVN already exists');
  }

  const employeeNumber = await generateEmployeeNumber(orgId);

  const created = await prisma.employeeProfile.create({
    data: {
      organizationId: orgId,
      employeeNumber,
      firstName: input.firstName,
      lastName: input.lastName,
      preferredName: input.preferredName ?? null,
      workEmail: input.workEmail ?? null,
      workPhone: input.workPhone ?? null,

      ghanaCardEnc: encryptField(input.ghanaCard ?? null),
      ghanaCardHash: input.ghanaCard ? hashSearchable(input.ghanaCard) : null,
      ssnitNumberEnc: encryptField(input.ssnitNumber ?? null),
      ssnitNumberHash: input.ssnitNumber ? hashSearchable(input.ssnitNumber) : null,
      tinEnc: encryptField(input.tin ?? null),
      tinHash: input.tin ? hashSearchable(input.tin) : null,
      bvnEnc: encryptField(input.bvn ?? null),
      bvnHash: input.bvn ? hashSearchable(input.bvn) : null,
      ninEnc: encryptField(input.nin ?? null),
      ninHash: input.nin ? hashSearchable(input.nin) : null,
      passportEnc: encryptField(input.passport ?? null),
      passportHash: input.passport ? hashSearchable(input.passport) : null,
      dobEnc: encryptField(input.dob ?? null),
      addressEnc: encryptField(input.address ?? null),
      emergencyContactEnc: encryptField(input.emergencyContact ?? null),

      bankName: input.bankName ?? null,
      bankAccountEnc: encryptField(input.bankAccount ?? null),
      bankAccountHash: input.bankAccount ? hashSearchable(input.bankAccount) : null,
      bankBranch: input.bankBranch ?? null,
      swiftCode: input.swiftCode ?? null,

      momoProvider: input.momoProvider ?? null,
      momoNumberEnc: encryptField(input.momoNumber ?? null),
      momoNumberHash: input.momoNumber ? hashSearchable(input.momoNumber) : null,

      employmentType: input.employmentType,
      jobTitle: input.jobTitle ?? null,
      department: input.department ?? null,
      managerId: input.managerId ?? null,
      hiredAt: input.hiredAt ? new Date(input.hiredAt) : null,
      baseSalaryMinor: input.baseSalaryMinor !== undefined ? BigInt(input.baseSalaryMinor) : null,
      payFrequency: input.payFrequency,
      currency: input.currency,
      status: 'pending',
    },
  });

  await recordAudit({
    organizationId: orgId,
    actorId: actor.userId,
    action: 'create',
    entityType: 'employee',
    entityId: created.id,
    after: { employeeNumber, firstName: created.firstName, lastName: created.lastName },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
    requestId: actor.requestId,
  });

  return toView(created, 'admin');
}

export async function listEmployees(
  orgId: string,
  query: ListEmployeesQuery,
  mode: EmployeeViewMode,
): Promise<{ items: EmployeeView[]; total: number; page: number; pageSize: number }> {
  const prisma = getPrisma();
  const where: Prisma.EmployeeProfileWhereInput = {
    organizationId: orgId,
    deletedAt: null,
  };
  if (query.status) where.status = query.status;
  if (query.department) where.department = query.department;
  if (query.q) {
    where.OR = [
      { firstName: { contains: query.q, mode: 'insensitive' } },
      { lastName: { contains: query.q, mode: 'insensitive' } },
      { employeeNumber: { contains: query.q, mode: 'insensitive' } },
      { workEmail: { contains: query.q, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.employeeProfile.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.employeeProfile.count({ where }),
  ]);

  return {
    items: items.map((i) => toView(i, mode)),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getEmployee(
  orgId: string,
  id: string,
  mode: EmployeeViewMode,
): Promise<EmployeeView> {
  const prisma = getPrisma();
  const e = await prisma.employeeProfile.findFirst({
    where: { id, organizationId: orgId, deletedAt: null },
  });
  if (!e) throw ApiError.notFound('Employee not found');
  return toView(e, mode);
}

export async function updateEmployee(
  orgId: string,
  id: string,
  input: UpdateEmployeeInput,
  actor: { userId: string; ip: string | null; userAgent: string | null; requestId: string },
): Promise<EmployeeView> {
  const prisma = getPrisma();
  const existing = await prisma.employeeProfile.findFirst({
    where: { id, organizationId: orgId, deletedAt: null },
  });
  if (!existing) throw ApiError.notFound('Employee not found');

  const data: Prisma.EmployeeProfileUpdateInput = {};

  // Plain fields
  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.preferredName !== undefined) data.preferredName = input.preferredName;
  if (input.workEmail !== undefined) data.workEmail = input.workEmail;
  if (input.workPhone !== undefined) data.workPhone = input.workPhone;
  if (input.jobTitle !== undefined) data.jobTitle = input.jobTitle;
  if (input.department !== undefined) data.department = input.department;
  if (input.managerId !== undefined) data.managerId = input.managerId;
  if (input.employmentType !== undefined) data.employmentType = input.employmentType;
  if (input.payFrequency !== undefined) data.payFrequency = input.payFrequency;
  if (input.currency !== undefined) data.currency = input.currency;
  if (input.bankName !== undefined) data.bankName = input.bankName;
  if (input.bankBranch !== undefined) data.bankBranch = input.bankBranch;
  if (input.swiftCode !== undefined) data.swiftCode = input.swiftCode;
  if (input.momoProvider !== undefined) data.momoProvider = input.momoProvider;
  if (input.hiredAt !== undefined) data.hiredAt = input.hiredAt ? new Date(input.hiredAt) : null;
  if (input.baseSalaryMinor !== undefined) data.baseSalaryMinor = BigInt(input.baseSalaryMinor);

  // Encrypted fields
  if (input.ghanaCard !== undefined) {
    data.ghanaCardEnc = encryptField(input.ghanaCard);
    data.ghanaCardHash = input.ghanaCard ? hashSearchable(input.ghanaCard) : null;
  }
  if (input.ssnitNumber !== undefined) {
    data.ssnitNumberEnc = encryptField(input.ssnitNumber);
    data.ssnitNumberHash = input.ssnitNumber ? hashSearchable(input.ssnitNumber) : null;
  }
  if (input.tin !== undefined) {
    data.tinEnc = encryptField(input.tin);
    data.tinHash = input.tin ? hashSearchable(input.tin) : null;
  }
  if (input.bvn !== undefined) {
    data.bvnEnc = encryptField(input.bvn);
    data.bvnHash = input.bvn ? hashSearchable(input.bvn) : null;
  }
  if (input.nin !== undefined) {
    data.ninEnc = encryptField(input.nin);
    data.ninHash = input.nin ? hashSearchable(input.nin) : null;
  }
  if (input.passport !== undefined) {
    data.passportEnc = encryptField(input.passport);
    data.passportHash = input.passport ? hashSearchable(input.passport) : null;
  }
  if (input.dob !== undefined) data.dobEnc = encryptField(input.dob);
  if (input.address !== undefined) data.addressEnc = encryptField(input.address);
  if (input.emergencyContact !== undefined) data.emergencyContactEnc = encryptField(input.emergencyContact);
  if (input.bankAccount !== undefined) {
    data.bankAccountEnc = encryptField(input.bankAccount);
    data.bankAccountHash = input.bankAccount ? hashSearchable(input.bankAccount) : null;
  }
  if (input.momoNumber !== undefined) {
    data.momoNumberEnc = encryptField(input.momoNumber);
    data.momoNumberHash = input.momoNumber ? hashSearchable(input.momoNumber) : null;
  }

  const updated = await prisma.employeeProfile.update({
    where: { id },
    data,
  });

  await recordAudit({
    organizationId: orgId,
    actorId: actor.userId,
    action: 'update',
    entityType: 'employee',
    entityId: id,
    metadata: { fields: Object.keys(input) },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
    requestId: actor.requestId,
  });

  return toView(updated, 'admin');
}

/**
 * Soft delete + redaction. Used for terminated employees AND for
 * Ghana DPA / NDPR / GDPR right-to-erasure requests.
 *
 * We retain the employeeNumber and audit log; we wipe PII.
 * Statutory retention (e.g. payroll records — Ghana Income Tax Act §125
 * requires 6-year retention) is enforced by NOT actually deleting the
 * row — we redact instead.
 */
export async function eraseEmployee(
  orgId: string,
  id: string,
  actor: { userId: string; ip: string | null; userAgent: string | null; requestId: string; reason: string },
): Promise<void> {
  const prisma = getPrisma();
  const existing = await prisma.employeeProfile.findFirst({
    where: { id, organizationId: orgId },
  });
  if (!existing) throw ApiError.notFound();

  await prisma.employeeProfile.update({
    where: { id },
    data: {
      firstName: 'REDACTED',
      lastName: 'REDACTED',
      preferredName: null,
      workEmail: null,
      workPhone: null,
      ghanaCardEnc: null,
      ghanaCardHash: null,
      ssnitNumberEnc: null,
      ssnitNumberHash: null,
      tinEnc: null,
      tinHash: null,
      bvnEnc: null,
      bvnHash: null,
      ninEnc: null,
      ninHash: null,
      passportEnc: null,
      passportHash: null,
      dobEnc: null,
      addressEnc: null,
      emergencyContactEnc: null,
      bankAccountEnc: null,
      bankAccountHash: null,
      momoNumberEnc: null,
      momoNumberHash: null,
      status: 'terminated',
      deletedAt: new Date(),
    },
  });

  await recordAudit({
    organizationId: orgId,
    actorId: actor.userId,
    action: 'data_erasure',
    entityType: 'employee',
    entityId: id,
    metadata: { reason: actor.reason },
    ipAddress: actor.ip,
    userAgent: actor.userAgent,
    requestId: actor.requestId,
  });
}

function toView(e: EmployeeProfile, mode: EmployeeViewMode): EmployeeView {
  const decrypt = (v: string | null): string | null => decryptField(v);
  const showPii = mode === 'admin' || mode === 'self';
  const view: EmployeeView = {
    id: e.id,
    employeeNumber: e.employeeNumber,
    firstName: e.firstName,
    lastName: e.lastName,
    preferredName: e.preferredName,
    workEmail: e.workEmail,
    workPhone: e.workPhone,
    jobTitle: e.jobTitle,
    department: e.department,
    status: e.status,
    employmentType: e.employmentType,
    payFrequency: e.payFrequency,
    currency: e.currency,
    baseSalaryMinor: e.baseSalaryMinor !== null ? e.baseSalaryMinor.toString() : null,
    hiredAt: e.hiredAt ? e.hiredAt.toISOString() : null,
    bankAccountMasked: maskLast4(decrypt(e.bankAccountEnc) ?? ''),
    momoNumberMasked: maskLast4(decrypt(e.momoNumberEnc) ?? ''),
  };
  if (showPii) {
    view.ghanaCard = decrypt(e.ghanaCardEnc);
    view.ssnitNumber = decrypt(e.ssnitNumberEnc);
    view.tin = decrypt(e.tinEnc);
    view.bvn = decrypt(e.bvnEnc);
    view.nin = decrypt(e.ninEnc);
    view.dob = decrypt(e.dobEnc);
    view.address = decrypt(e.addressEnc);
  }
  return view;
}
