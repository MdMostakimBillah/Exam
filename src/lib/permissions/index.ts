import { UserRole } from '../types';

type Permission = string;

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: [
    'institution.read', 'institution.create', 'institution.update', 'institution.delete',
    'institution.approve', 'institution.reject', 'institution.suspend',
    'student.read', 'student.create', 'student.update', 'student.delete',
    'exam.read', 'exam.create', 'exam.update', 'exam.delete', 'exam.publish',
    'registration.read', 'registration.create', 'registration.update', 'registration.verify',
    'result.read', 'result.edit', 'result.publish',
    'certificate.generate', 'certificate.download', 'certificate.verify',
    'payment.read', 'payment.manage',
    'report.read', 'report.export',
    'notification.read', 'notification.manage',
    'settings.read', 'settings.update',
    'audit.read',
    'admin.read',
  ],
  INSTITUTION_ADMIN: [
    'student.read', 'student.create', 'student.update', 'student.delete',
    'registration.create', 'registration.read',
    'result.read',
    'certificate.download',
    'payment.read',
    'report.read',
    'notification.read',
    'settings.read',
    'admin.read',
  ],
  STUDENT: [
    'result.read',
    'certificate.download',
    'payment.read',
    'notification.read',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
