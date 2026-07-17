import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type {
  ObjectStorage,
  PutObjectInput,
  PutObjectResult,
} from './storage.types';

/** Development-only filesystem storage under STORAGE_LOCAL_DIR. */
export class LocalObjectStorage implements ObjectStorage {
  readonly driver = 'local' as const;

  constructor(private readonly rootDir: string) {}

  private resolveKey(key: string): string {
    const normalized = key.replace(/\\/g, '/').replace(/^\/+/, '');
    if (
      normalized.includes('..') ||
      path.isAbsolute(normalized) ||
      normalized.includes('\0')
    ) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return path.join(this.rootDir, ...normalized.split('/'));
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const full = this.resolveKey(input.key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, input.body);
    return { key: input.key, uri: `file://${full}` };
  }

  async getReadUrl(key: string): Promise<string> {
    return `file://${this.resolveKey(key)}`;
  }

  async deleteObject(key: string): Promise<void> {
    await unlink(this.resolveKey(key)).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
}
