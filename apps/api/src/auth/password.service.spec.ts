import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const svc = new PasswordService();

  it('hashes with argon2id and verifies', async () => {
    const hash = await svc.hash('correct-horse-battery');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await svc.verify(hash, 'correct-horse-battery')).toBe(true);
    expect(await svc.verify(hash, 'wrong-password')).toBe(false);
  });
});
