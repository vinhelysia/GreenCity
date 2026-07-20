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
  readonly driver: 'local' | 's3' | 'supabase';
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  /**
   * Returns a path or temporary URL for internal use only.
   * Never forward local file:// or absolute paths to API clients.
   */
  getReadUrl(key: string, expiresSeconds?: number): Promise<string>;
  /** Read object bytes for authorized application streaming. */
  getObject(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
