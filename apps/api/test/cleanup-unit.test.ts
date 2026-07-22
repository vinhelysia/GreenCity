import { CleanupService } from '../src/cleanup/cleanup.service';

describe('CleanupService public photo', () => {
  it('maps a missing storage object to CLEANUP_REPORT_NOT_FOUND', async () => {
    const prisma = {
      cleanupReport: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'report-1',
          mediaAssetId: 'media-1',
        }),
      },
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'media-1',
          objectKey: 'cleanup/report-1.png',
          contentType: 'image/png',
          deletedAt: null,
        }),
      },
    };
    const storage = {
      getObject: jest.fn().mockRejectedValue(new Error('object missing')),
    };
    const service = new CleanupService(prisma as never, storage as never);

    await expect(service.getPublicPhoto('report-1')).rejects.toMatchObject({
      status: 404,
      response: { code: 'CLEANUP_REPORT_NOT_FOUND' },
    });
  });

  it.each([
    ['missing', null],
    [
      'deleted',
      {
        id: 'media-1',
        objectKey: 'cleanup/report-1.png',
        contentType: 'image/png',
        deletedAt: new Date(),
      },
    ],
  ])('rejects a %s media asset before reading storage', async (_case, asset) => {
    const prisma = {
      cleanupReport: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'report-1',
          mediaAssetId: 'media-1',
        }),
      },
      mediaAsset: {
        findUnique: jest.fn().mockResolvedValue(asset),
      },
    };
    const storage = { getObject: jest.fn() };
    const service = new CleanupService(prisma as never, storage as never);

    await expect(service.getPublicPhoto('report-1')).rejects.toMatchObject({
      status: 404,
      response: { code: 'CLEANUP_REPORT_NOT_FOUND' },
    });
    expect(storage.getObject).not.toHaveBeenCalled();
  });
});
