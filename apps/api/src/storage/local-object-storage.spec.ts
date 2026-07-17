import { mkdtempSync, rmSync, writeFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalObjectStorage } from './local-object-storage';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function run(): Promise<void> {
  const root = mkdtempSync(path.join(tmpdir(), 'gc-storage-'));
  const storage = new LocalObjectStorage(root);

  // happy path
  await storage.putObject({
    key: 'a/b.txt',
    body: Buffer.from('ok'),
    contentType: 'text/plain',
  });
  assert(existsSync(path.join(root, 'a', 'b.txt')), 'expected file written under root');

  // ../ traversal
  let threw = false;
  try {
    storage.resolveSafePath('../escape.txt');
  } catch {
    threw = true;
  }
  assert(threw, 'expected ../ rejection');

  // absolute escape (Windows + POSIX style)
  threw = false;
  try {
    storage.resolveSafePath('C:\\Windows\\Temp\\x');
  } catch {
    threw = true;
  }
  assert(threw, 'expected absolute Windows path rejection');

  threw = false;
  try {
    storage.resolveSafePath('/etc/passwd');
  } catch {
    threw = true;
  }
  assert(threw, 'expected absolute POSIX path rejection');

  // symlink/junction ancestor rejection (when platform supports symlink)
  try {
    const outside = mkdtempSync(path.join(tmpdir(), 'gc-out-'));
    writeFileSync(path.join(outside, 'secret.txt'), 'nope');
    const link = path.join(root, 'linkdir');
    symlinkSync(outside, link, 'junction');
    threw = false;
    try {
      storage.resolveSafePath('linkdir/secret.txt');
    } catch {
      threw = true;
    }
    assert(threw, 'expected junction/symlink escape rejection');
    rmSync(outside, { recursive: true, force: true });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'EPERM' || e.code === 'EACCES') {
      // Creating symlinks may require admin on Windows — skip with notice
      // eslint-disable-next-line no-console
      console.log('skip symlink test (insufficient privileges)');
    } else if (e.message?.includes('expected junction')) {
      throw err;
    } else {
      // rethrow unexpected
      throw err;
    }
  }

  // same root from different relative construction
  const storage2 = new LocalObjectStorage(path.resolve(root));
  const p1 = storage.resolveSafePath('x/y');
  const p2 = storage2.resolveSafePath('x/y');
  assert(p1 === p2, 'paths should match for same absolute root');

  rmSync(root, { recursive: true, force: true });
  // eslint-disable-next-line no-console
  console.log('local-object-storage.spec: ok');
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
