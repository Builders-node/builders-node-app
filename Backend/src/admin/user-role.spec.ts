import { AdminService } from './admin.service';

/**
 * Granting and revoking admin access.
 *
 * The interesting cases aren't the happy ones — they're the two ways to lock
 * every admin out of the panel, neither of which can be undone from inside the
 * product: demoting yourself, and demoting the last Super Admin there is.
 */
function makeService(target: Record<string, unknown> = {}, superAdminsBesidesTarget = 1) {
  const user = { id: 'user-2', email: 'ada@builders.test', role: 'MEMBER', ...target };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...user, ...data, profile: null, membership: null })),
      count: jest.fn().mockResolvedValue(superAdminsBesidesTarget),
    },
    auditEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  return {
    service: new AdminService(prisma as never, {} as never, {} as never, notifications as never),
    prisma,
    notifications,
  };
}

const superAdmin = { userId: 'user-1', role: 'SUPER_ADMIN', via: 'session' as const };

describe('AdminService.updateUserRole', () => {
  it('lets a Super Admin grant admin access to someone else', async () => {
    const { service, prisma } = makeService();
    const updated = await service.updateUserRole('user-2', 'MODERATOR', superAdmin);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { role: 'MODERATOR' } }));
    expect(updated.role).toBe('MODERATOR');
  });

  it('tells the person they now have admin access', async () => {
    const { service, notifications } = makeService();
    await service.updateUserRole('user-2', 'SUPER_ADMIN', superAdmin);
    expect(notifications.notify).toHaveBeenCalledWith('user-2', expect.objectContaining({ link: '/admin' }));
  });

  it('does not announce a change between two non-admin roles', async () => {
    const { service, notifications } = makeService({ role: 'MEMBER' });
    await service.updateUserRole('user-2', 'MEMBER', superAdmin);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('records who changed whose role', async () => {
    const { service, prisma } = makeService();
    await service.updateUserRole('user-2', 'MODERATOR', superAdmin);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-1', action: 'user_role_change' }) }),
    );
  });

  it('refuses anyone who is not a Super Admin', async () => {
    const { service, prisma } = makeService();
    await expect(service.updateUserRole('user-2', 'SUPER_ADMIN', { userId: 'user-9', role: 'MODERATOR', via: 'session' })).rejects.toThrow(
      /Only Super Admin/,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a role that is not a real role', async () => {
    const { service } = makeService();
    await expect(service.updateUserRole('user-2', 'OWNER', superAdmin)).rejects.toThrow(/valid role/);
  });

  it('refuses to let a Super Admin change their own role', async () => {
    // Otherwise one wrong pick in a dropdown ends your own access, and there is
    // no screen left that can give it back.
    const { service, prisma } = makeService({ id: 'user-1', role: 'SUPER_ADMIN' });
    await expect(service.updateUserRole('user-1', 'MEMBER', superAdmin)).rejects.toThrow(/your own role/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses to demote the last Super Admin', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN' }, 0);
    await expect(service.updateUserRole('user-2', 'MEMBER', superAdmin)).rejects.toThrow(/last Super Admin/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows demoting a Super Admin while another one remains', async () => {
    const { service, prisma } = makeService({ role: 'SUPER_ADMIN' }, 1);
    await service.updateUserRole('user-2', 'MEMBER', superAdmin);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('still works for the break-glass admin key, which has no user behind it', async () => {
    const { service, prisma } = makeService();
    await service.updateUserRole('user-2', 'SUPER_ADMIN', { role: 'SUPER_ADMIN', via: 'key' });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('404s on a user that does not exist', async () => {
    const { service, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.updateUserRole('nope', 'MEMBER', superAdmin)).rejects.toThrow(/not found/i);
  });
});
