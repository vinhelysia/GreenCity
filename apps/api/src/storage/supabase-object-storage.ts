import type {
  ObjectStorage,
  PutObjectInput,
  PutObjectResult,
} from './storage.types';

export interface SupabaseStorageConfig {
  /** Project URL, e.g. https://xxxx.supabase.co */
  url: string;
  /** service_role key — server-side only, never sent to a client. */
  serviceKey: string;
  bucket: string;
}

/**
 * Supabase Storage adapter over its REST API, using Node's built-in fetch
 * (no SDK dependency). For split deploys where the API runs on an ephemeral
 * disk (e.g. Render free) and uploaded images must survive restarts and be
 * shared across instances — the local FS driver cannot do either.
 *
 * The bucket is private; objects are streamed through the API (getObject),
 * exactly like the local driver, so listing/media visibility rules still apply.
 */
export class SupabaseObjectStorage implements ObjectStorage {
  readonly driver = 'supabase' as const;
  private readonly base: string;
  private readonly serviceKey: string;
  private readonly bucket: string;

  constructor(config: SupabaseStorageConfig) {
    if (!config.url || !config.serviceKey || !config.bucket) {
      throw new Error(
        'Supabase storage requires SUPABASE_URL, SUPABASE_SERVICE_KEY, and SUPABASE_STORAGE_BUCKET',
      );
    }
    this.base = config.url.replace(/\/+$/, '');
    this.serviceKey = config.serviceKey;
    this.bucket = config.bucket;
  }

  /** Keys are opaque object names within the bucket; reject anything unsafe. */
  private objectUrl(key: string): string {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('Invalid storage key: empty');
    }
    if (key.includes('\0') || key.startsWith('/')) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    if (key.split('/').some((seg) => seg === '..' || seg === '.')) {
      throw new Error(`Invalid storage key: path traversal rejected (${key})`);
    }
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    return `${this.base}/storage/v1/object/${this.bucket}/${encoded}`;
  }

  private authHeaders(): Record<string, string> {
    if (this.serviceKey.startsWith('sb_secret_')) {
      return { apikey: this.serviceKey };
    }
    return { Authorization: `Bearer ${this.serviceKey}` };
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const res = await fetch(this.objectUrl(input.key), {
      method: 'POST',
      headers: {
        ...this.authHeaders(),
        'Content-Type': input.contentType,
        'x-upsert': 'true',
      },
      body: Buffer.from(input.body),
    });
    if (!res.ok) {
      throw new Error(
        `Supabase putObject failed (${res.status}): ${await bodyPreview(res)}`,
      );
    }
    return { key: input.key, uri: `supabase://${this.bucket}/${input.key}` };
  }

  async getReadUrl(key: string): Promise<string> {
    // Internal identifier only — objects are streamed via getObject, never
    // handed to a client as a URL.
    return `supabase://${this.bucket}/${key}`;
  }

  async getObject(key: string): Promise<Buffer> {
    const res = await fetch(this.objectUrl(key), {
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new Error(
        `Supabase getObject failed (${res.status}): ${await bodyPreview(res)}`,
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async deleteObject(key: string): Promise<void> {
    const res = await fetch(this.objectUrl(key), {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
    // A missing object is already in the desired state.
    if (!res.ok && res.status !== 404) {
      throw new Error(
        `Supabase deleteObject failed (${res.status}): ${await bodyPreview(res)}`,
      );
    }
  }
}

async function bodyPreview(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 200);
  } catch {
    return '<no body>';
  }
}
