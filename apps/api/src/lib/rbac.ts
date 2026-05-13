/**
 * Role-Based Access Control matrix.
 *
 * Roles (in increasing privilege):
 *   employee        — view own profile, request PTO, claim shifts
 *   manager         — approve PTO/shifts for direct reports
 *   payroll_admin   — run payroll, view all employees, view audit
 *   hr_admin        — onboard/offboard, edit policies, view audit
 *   org_owner       — billing, all hr_admin powers, manage roles
 *   super_admin     — cross-org (Pic Shift internal staff only)
 *
 * Permissions are kebab-cased "domain.action" strings. The router uses
 * `requirePerm('employee.write')` to gate handlers.
 */

export const ROLES = [
  'employee',
  'manager',
  'payroll_admin',
  'hr_admin',
  'org_owner',
  'super_admin',
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  // Self
  'self.read',
  'self.update',
  'self.mfa.manage',

  // Employees
  'employee.read.self',
  'employee.read.team',
  'employee.read.all',
  'employee.write',
  'employee.delete',
  'employee.export',

  // PTO
  'pto.request',
  'pto.approve.team',
  'pto.approve.all',
  'pto.policy.manage',

  // Shifts
  'shift.claim',
  'shift.assign',
  'shift.create',
  'shift.delete',

  // Documents
  'document.read.self',
  'document.read.team',
  'document.read.all',
  'document.upload',
  'document.delete',

  // Payroll
  'payroll.read',
  'payroll.run',
  'payroll.approve',
  'payroll.dispatch',

  // Audit
  'audit.read',
  'audit.export',

  // Org admin
  'org.settings.manage',
  'org.users.manage',
  'org.roles.manage',
  'org.billing.manage',

  // Compliance
  'compliance.consent.manage',
  'compliance.erasure.execute',

  // Super-admin
  'system.cross_org',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const employeePerms: Permission[] = [
  'self.read',
  'self.update',
  'self.mfa.manage',
  'employee.read.self',
  'pto.request',
  'shift.claim',
  'document.read.self',
  'document.upload',
];

const managerPerms: Permission[] = [
  ...employeePerms,
  'employee.read.team',
  'pto.approve.team',
  'shift.assign',
  'shift.create',
  'document.read.team',
];

const payrollAdminPerms: Permission[] = [
  ...managerPerms,
  'employee.read.all',
  'pto.approve.all',
  'document.read.all',
  'payroll.read',
  'payroll.run',
  'payroll.approve',
  'payroll.dispatch',
  'audit.read',
];

const hrAdminPerms: Permission[] = [
  ...managerPerms,
  'employee.read.all',
  'employee.write',
  'employee.delete',
  'employee.export',
  'pto.approve.all',
  'pto.policy.manage',
  'document.read.all',
  'document.delete',
  'shift.delete',
  'audit.read',
  'audit.export',
  'compliance.consent.manage',
  'compliance.erasure.execute',
  'payroll.read',
];

const orgOwnerPerms: Permission[] = [
  ...hrAdminPerms,
  ...payrollAdminPerms,
  'org.settings.manage',
  'org.users.manage',
  'org.roles.manage',
  'org.billing.manage',
];

const superAdminPerms: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  employee: new Set(employeePerms),
  manager: new Set(managerPerms),
  payroll_admin: new Set(payrollAdminPerms),
  hr_admin: new Set(hrAdminPerms),
  org_owner: new Set(orgOwnerPerms),
  super_admin: new Set(superAdminPerms),
};

export function hasPermission(roles: readonly string[], perm: Permission): boolean {
  for (const r of roles) {
    const role = r as Role;
    const set = ROLE_PERMISSIONS[role];
    if (set && set.has(perm)) return true;
  }
  return false;
}

export function highestRole(roles: readonly string[]): Role | null {
  const ordered: Role[] = [
    'super_admin',
    'org_owner',
    'hr_admin',
    'payroll_admin',
    'manager',
    'employee',
  ];
  for (const r of ordered) {
    if (roles.includes(r)) return r;
  }
  return null;
}
