import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findRepoRoot, resolveFromRepoRoot } from './paths';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function run(): void {
  const base = mkdtempSync(path.join(tmpdir(), 'gc-paths-'));
  writeFileSync(path.join(base, 'pnpm-workspace.yaml'), 'packages: []\n');
  const nested = path.join(base, 'apps', 'api');
  mkdirSync(nested, { recursive: true });

  const fromRoot = findRepoRoot(base);
  const fromApi = findRepoRoot(nested);
  assert(fromRoot === fromApi, 'repo root must match from root and apps/api');

  const a = resolveFromRepoRoot('.local/storage', fromRoot);
  const b = resolveFromRepoRoot('.local/storage', fromApi);
  assert(a === b, 'storage path must be identical from root and apps/api');

  rmSync(base, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log('paths.spec: ok');
}

try {
  run();
} catch (e) {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
}
