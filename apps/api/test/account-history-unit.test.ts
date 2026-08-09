import type { AuthContext } from '../src/authz/auth-context';
import { Reflector } from '@nestjs/core';
import { AccountHistoryQuerySchema } from '@greencity/shared';
import { ZodValidationPipe } from '../src/common/zod-validation.pipe';
import { AccountHistoryController } from '../src/marketplace/account-history.controller';
import { AccountHistoryService } from '../src/marketplace/account-history.service';

describe('Account history', () => {
  const createdAt = new Date('2026-08-09T00:00:00.000Z');

  it('passes the authenticated owner and validated limit through the controller', async () => {
    const result = { reservations: [], subscriptions: [], payments: [] };
    const history = { getRecent: jest.fn().mockResolvedValue(result) };
    const controller = new AccountHistoryController(history as never);
    const auth = {
      user: { id: 'owner-1' },
      sessionId: 'session-1',
      roles: ['USER'],
    } as AuthContext;

    await expect(controller.history(auth, { limit: 5 })).resolves.toEqual(result);
    expect(history.getRecent).toHaveBeenCalledWith('owner-1', 5);
  });

  it('is not public and rejects an invalid history limit before reaching the service', () => {
    const history = { getRecent: jest.fn() };
    const reflector = new Reflector();
    const queryPipe = new ZodValidationPipe(AccountHistoryQuerySchema);

    expect(
      reflector.getAllAndOverride<boolean>('isPublic', [
        AccountHistoryController.prototype.history,
        AccountHistoryController,
      ]),
    ).toBeUndefined();
    expect(() => queryPipe.transform({ limit: 11 })).toThrow(
      expect.objectContaining({ status: 400 }),
    );
    expect(history.getRecent).not.toHaveBeenCalled();
  });

  it('reads only the owner rows, with deterministic bounded queries and safe output', async () => {
    const prisma = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'reservation-1',
            createdAt,
            listing: {
              categoryName: 'Giấy carton',
              estimatedWeightKg: 12.345,
              buyerPricePerKgVnd: 3001,
              status: 'COMPLETED',
            },
          },
        ]),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'subscription-1',
            status: 'ACTIVE',
            startsAt: createdAt,
            expiresAt: new Date('2026-09-08T00:00:00.000Z'),
          },
        ]),
      },
      subscriptionPayment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'payment-1',
            provider: 'PAYOS',
            status: 'PAID',
            amountVnd: 50000,
            createdAt,
            paidAt: createdAt,
          },
        ]),
      },
    };
    const service = new AccountHistoryService(prisma as never);

    await expect(service.getRecent('owner-1', 5)).resolves.toEqual({
      reservations: [
        {
          id: 'reservation-1',
          categoryName: 'Giấy carton',
          estimatedWeightKg: 12.345,
          buyerPricePerKgVnd: 3001,
          // Same Math.round(pricePerKg * weight) rule as MarketplaceListing.
          estimatedTotalVnd: 37047,
          status: 'COMPLETED',
          createdAt: createdAt.toISOString(),
        },
      ],
      subscriptions: [
        {
          id: 'subscription-1',
          status: 'ACTIVE',
          startsAt: createdAt.toISOString(),
          expiresAt: '2026-09-08T00:00:00.000Z',
        },
      ],
      payments: [
        {
          id: 'payment-1',
          provider: 'PAYOS',
          status: 'PAID',
          amountVnd: 50000,
          createdAt: createdAt.toISOString(),
          paidAt: createdAt.toISOString(),
        },
      ],
    });

    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      {
        where: { buyerId: 'owner-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          createdAt: true,
          listing: {
            select: {
              categoryName: true,
              estimatedWeightKg: true,
              buyerPricePerKgVnd: true,
              status: true,
            },
          },
        },
      },
    );
    expect(prisma.subscription.findMany).toHaveBeenCalledWith(
      {
        where: { userId: 'owner-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          status: true,
          startsAt: true,
          expiresAt: true,
        },
      },
    );
    expect(prisma.subscriptionPayment.findMany).toHaveBeenCalledWith(
      {
        where: { userId: 'owner-1' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 5,
        select: {
          id: true,
          provider: true,
          status: true,
          amountVnd: true,
          createdAt: true,
          paidAt: true,
        },
      },
    );
  });
});
