export const USER_ROLES = ['MEMBER', 'SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ADMIN_ROLES: UserRole[] = ['SUPER_ADMIN', 'MODERATOR', 'COMMUNITY_LEADER'];

export function isUserRole(role: string | undefined | null): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}

export function isAdminRole(role: string | undefined | null): role is UserRole {
  return ADMIN_ROLES.includes(role as UserRole);
}
