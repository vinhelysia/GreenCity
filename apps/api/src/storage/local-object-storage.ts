import { lstatSync, mkdirSync } from 'node:fs';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import type {
  ObjectStorage,
  PutObjectInput,
  PutObjectResult,
} from './storage.types';

/**
 * Development-only filesystem storage.
 *
 * Residual risk (TOCTOU): a directory could be replaced with a junction/symlink
 * between containment checks and write. Mitigated for Phase 0 by rejecting
 * symlink/junction *ancestors at resolve time* and re-checking the final path
 * is still under root after realpath. Full atomic containment would need
 * platform-specific open flags; upgrade if untrusted multi-tenant writers share the host FS.
 */
export class LocalObjectStorage implements ObjectStorage {
  readonly driver = 'local' as const;
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
    mkdirSync(this.rootDir, { recursive: true });
    this.assertNoSymlinkAncestors(this.rootDir);
  }

  /** Public for tests — resolve object key to absolute path under root. */
  resolveSafePath(key: string): string {
    if (typeof key !== 'string' || key.length === 0) {
      throw new Error('Invalid storage key: empty');
    }
    if (key.includes('\0')) {
      throw new Error('Invalid storage key: null byte');
    }

    // Reject absolute paths (POSIX, Windows drive, UNC)
    if (path.isAbsolute(key) || /^[a-zA-Z]:[\\/]/.test(key) || key.startsWith('\\\\')) {
      throw new Error(`Invalid storage key: absolute path escape rejected (${key})`);
    }

    const normalized = key.replace(/\\/g, '/');
    if (normalized.startsWith('/') || normalized.includes('\0')) {
      throw new Error(`Invalid storage key: ${key}`);
    }

    const segments = normalized.split('/').filter((s) => s.length > 0);
    for (const seg of segments) {
      if (seg === '..' || seg === '.') {
        throw new Error(`Invalid storage key: path traversal rejected (${key})`);
      }
    }

    const candidate = path.resolve(this.rootDir, ...segments);
    const rootWithSep = this.rootDir.endsWith(path.sep)
      ? this.rootDir
      : this.rootDir + path.sep;

    if (candidate !== this.rootDir && !candidate.startsWith(rootWithSep)) {
      throw new Error(`Invalid storage key: escapes storage root (${key})`);
    }

    // Reject if any existing ancestor under root is a symlink/junction
    this.assertNoSymlinkAncestors(path.dirname(candidate), this.rootDir);

    return candidate;
  }

  /**
   * Ensure no path component from `fromRoot` to `target` is a symlink or Windows junction.
   */
  private assertNoSymlinkAncestors(target: string, stopAt?: string): void {
    const stop = stopAt ? path.resolve(stopAt) : path.parse(target).root;
    let current = path.resolve(target);
    const seen = new Set<string>();

    while (current && !seen.has(current)) {
      seen.add(current);
      try {
        const st = lstatSync(current);
        if (st.isSymbolicLink()) {
          throw new Error(
            `Storage path rejects symlink/junction ancestor: ${current}`,
          );
        }
        // Windows junctions often appear as reparse points; Node reports isSymbolicLink for many
        // If directory has reparsePoint and is not a normal dir, reject when possible.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anySt = st as any;
        if (anySt.isDirectory?.() && anySt.isSymbolicLink?.()) {
          throw new Error(
            `Storage path rejects reparse/junction ancestor: ${current}`,
          );
        }
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code === 'ENOENT') {
          // path does not exist yet — continue walking parents
        } else if (err instanceof Error && err.message.startsWith('Storage path')) {
          throw err;
        } else if (e.code !== 'ENOENT') {
          throw err;
        }
      }

      if (current === stop || current === path.parse(current).root) break;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const full = this.resolveSafePath(input.key);
    await mkdir(path.dirname(full), { recursive: true });
    // Re-check after mkdir (TOCTOU residual: race between check and write remains)
    this.assertNoSymlinkAncestors(path.dirname(full), this.rootDir);
    const finalResolved = path.resolve(full);
    const rootWithSep = this.rootDir.endsWith(path.sep)
      ? this.rootDir
      : this.rootDir + path.sep;
    if (
      finalResolved !== this.rootDir &&
      !finalResolved.startsWith(rootWithSep)
    ) {
      throw new Error('Storage write rejected: path escaped root after resolve');
    }
    await writeFile(full, input.body);
    return { key: input.key, uri: `file://${full}` };
  }

  async getReadUrl(key: string): Promise<string> {
    return `file://${this.resolveSafePath(key)}`;
  }

  async deleteObject(key: string): Promise<void> {
    const full = this.resolveSafePath(key);
    await unlink(full).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
}
