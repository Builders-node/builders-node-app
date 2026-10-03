import { SetMetadata } from '@nestjs/common';

export const SUPER_ADMIN_ONLY = 'superAdminOnly';

/**
 * Marks an /admin route as Super Admin only. AdminGuard enforces it.
 *
 * Every admin tier used to be able to do everything short of changing roles
 * and deleting people — including marking invoices paid, changing prices and
 * activating memberships. Money, pricing and community-wide settings belong
 * with whoever owns the business; moderators and community leaders run the
 * pipeline and the day-to-day.
 */
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_ONLY, true);
