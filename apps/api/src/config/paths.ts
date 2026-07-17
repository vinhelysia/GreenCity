import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Resolve monorepo root by walking up from cwd until pnpm-workspace.yaml is found.
 * Ensures paths are identical when starting from repo root or apps/api.
 */
export function findRepoRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);
  for (;;) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        'Could not find monorepo root (pnpm-workspace.yaml). Start the API from the GreenCity repository.',
      );
    }
    dir = parent;
  }
}

/** Repo root during development; artifact root when deployed without workspace metadata. */
export function findRuntimeRoot(
  startDir: string = process.cwd(),
  artifactRoot: string = path.resolve(__dirname, '../..'),
): string {
  try {
    return findRepoRoot(startDir);
  } catch {
    return path.resolve(artifactRoot);
  }
}

/** Absolute path under runtime root (rejects escape via resolve + prefix check later in storage). */
export function resolveFromRepoRoot(
  relativeOrAbsolute: string,
  repoRoot: string = findRuntimeRoot(),
): string {
  if (path.isAbsolute(relativeOrAbsolute)) {
    return path.normalize(relativeOrAbsolute);
  }
  return path.normalize(path.join(repoRoot, relativeOrAbsolute));
}

export function repoRootEnvPath(repoRoot: string = findRuntimeRoot()): string {
  return path.join(repoRoot, '.env');
}
