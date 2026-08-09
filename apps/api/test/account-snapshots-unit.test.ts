import type { AuthContext } from '../src/authz/auth-context';
import { CleanupService } from '../src/cleanup/cleanup.service';
import { PointsService } from '../src/points/points.service';

describe('account dashboard snapshots', () => {
  const createdAt = new Date('2026-08-09T00:00:00.000Z');

  it('limits the owner points ledger while calculating the complete balance', async () => {
    const prisma = {
      pointEntry: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { delta: 70 } }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'entry-1',
            delta: 50,
            reason: 'CLEANUP_VERIFIED',
            createdAt,
          },
        ]),
      },
    };
    const service = new PointsService(prisma as never);

    await expect(service.getBalance('owner-1', 5)).resolves.toEqual({
      balance: 70,
      entries: [
        {
          id: 'entry-1',
          delta: 50,
          reason: 'CLEANUP_VERIFIED',
          occurredAt: createdAt.toISOString(),
        },
      ],
    });
    expect(prisma.pointEntry.aggregate).toHaveBeenCalledWith({
      where: { userId: 'owner-1' },
      _sum: { delta: true },
    });
    expect(prisma.pointEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'owner-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    );
  });

  it('limits cleanup reports to the authenticated reporter', async () => {
    const prisma = {
      cleanupReport: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new CleanupService(
      prisma as never,
      {} as never,
      {} as never,
    );
    const auth = {
      user: { id: 'owner-1' },
      sessionId: 'session-1',
      roles: ['USER'],
    } as AuthContext;

    await expect(service.mine(auth, 5)).resolves.toEqual({ reports: [] });
    expect(prisma.cleanupReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reporterId: 'owner-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    );
  });
});
