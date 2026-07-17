/** Object storage port — local FS in Phase 0; S3-compatible later. */
export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

export interface PutObjectResult {
  key: string;
  /** file://… or s3://… or absolute local path for local driver */
  uri: string;
}

export interface ObjectStorage {
  readonly driver: 'local' | 's3';
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  /** Returns a path or temporary URL suitable for authorized download. */
  getReadUrl(key: string, expiresSeconds?: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
