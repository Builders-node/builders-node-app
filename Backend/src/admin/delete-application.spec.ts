import { AdminService } from './admin.service';

/**
 * Deleting an application, as distinct from deleting an account.
 *
 * They are separate rows and always have been: an Application is keyed by
 * email and carries no link to a User, so purging an account leaves the
 * application behind — and that leftover keeps refusing the address with
 * "an application with this email already exists".
 */
function makeService(application: Record<string, unknown> | null = { id: 'app-1', email: 'ada@builders.test' }) {
  const tx = {
    application: { delete: jest.fn().mockResolvedValue({}) },
    applicationVerification: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    application: {
      findUnique: jest.fn().mockResolvedValue(application),
      findMany: jest.fn().mockResolvedValue(application ? [application] : []),
    },
    $transaction: jest.fn().mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { service: new AdminService(prisma as never, {} as never, {} as never, {} as never), prisma, tx };
}

const superAdmin = { userId: 'admin-1', role: 'SUPER_ADMIN', via: 'session' as const };
const moderator = { userId: 'mod-1', role: 'MODERATOR', via: 'session' as const };

describe('AdminService.deleteApplication', () => {
  it('deletes the application and reports the address it freed', async () => {
    const { service, tx } = makeService();

    const result = await service.deleteApplication('app-1', superAdmin);

    expect(tx.application.delete).toHaveBeenCalledWith({ where: { id: 'app-1' } });
    expect(result).toEqual({ deleted: true, id: 'app-1', email: 'ada@builders.test' });
  });

  it('clears a half-finished attempt on the same address', async () => {
    // An unconfirmed application still holds an emailed code. Left behind, a
    // "deleted" applicant could confirm themselves back into the pipeline.
    const { service, tx } = makeService();

    await service.deleteApplication('app-1', superAdmin);

    expect(tx.applicationVerification.deleteMany).toHaveBeenCalledWith({ where: { email: 'ada@builders.test' } });
  });

  it('never touches the account — that is a separate action', async () => {
    const { service, prisma } = makeService();

    await service.deleteApplication('app-1', superAdmin);

    expect((prisma as Record<string, unknown>).user).toBeUndefined();
  });

  it('refuses anyone below Super Admin', async () => {
    // Same bar as deleting an account: a real person's name, address and
    // answers, with no undo. Rejecting is the reversible move.
    const { service, tx } = makeService();

    await expect(service.deleteApplication('app-1', moderator)).rejects.toThrow(/Super Admin/);
    expect(tx.application.delete).not.toHaveBeenCalled();
  });

  it('404s on an application that is already gone', async () => {
    const { service } = makeService(null);

    await expect(service.deleteApplication('app-1', superAdmin)).rejects.toThrow(/not found/i);
  });
});

describe('AdminService.deleteApplications', () => {
  it('skips ids that no longer exist rather than failing the batch', async () => {
    // Two admins clearing the same spam is not an error.
    const { service } = makeService();

    const result = await service.deleteApplications(['app-1', 'app-gone'], superAdmin);

    expect(result).toEqual({ deleted: 1, skipped: 1 });
  });

  it('refuses an empty selection', async () => {
    const { service } = makeService();

    await expect(service.deleteApplications([], superAdmin)).rejects.toThrow(/at least one/i);
  });
});
