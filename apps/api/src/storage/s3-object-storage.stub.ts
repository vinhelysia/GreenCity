import type {
  ObjectStorage,
  PutObjectInput,
  PutObjectResult,
} from './storage.types';

/**
 * Placeholder for production S3-compatible storage.
 * Not wired for Phase 0; selected only when STORAGE_DRIVER=s3.
 */
export class S3ObjectStorageStub implements ObjectStorage {
  readonly driver = 's3' as const;

  constructor(
    private readonly config: {
      endpoint?: string;
      accessKey?: string;
      secretKey?: string;
      bucket?: string;
      region: string;
    },
  ) {
    if (!config.endpoint || !config.accessKey || !config.secretKey || !config.bucket) {
      throw new Error(
        'STORAGE_DRIVER=s3 requires S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET',
      );
    }
  }

  putObject(_input: PutObjectInput): Promise<PutObjectResult> {
    return Promise.reject(
      new Error(
        'S3 object storage is not implemented in Phase 0. Use STORAGE_DRIVER=local.',
      ),
    );
  }

  getReadUrl(_key: string, _expiresSeconds?: number): Promise<string> {
    return Promise.reject(
      new Error(
        'S3 object storage is not implemented in Phase 0. Use STORAGE_DRIVER=local.',
      ),
    );
  }

  getObject(_key: string): Promise<Buffer> {
    return Promise.reject(
      new Error(
        'S3 object storage is not implemented in Phase 0. Use STORAGE_DRIVER=local.',
      ),
    );
  }

  deleteObject(_key: string): Promise<void> {
    return Promise.reject(
      new Error(
        'S3 object storage is not implemented in Phase 0. Use STORAGE_DRIVER=local.',
      ),
    );
  }
}
