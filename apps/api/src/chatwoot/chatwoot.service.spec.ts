import { createHmac } from 'node:crypto';
import { ChatwootService } from './chatwoot.service';

/**
 * The security property under test is narrow but total: the hash must be
 * derived from the session's user id and the server-held secret, and from
 * nothing a caller can influence.
 */
describe('chatwoot identity', () => {
  const SECRET = 'test-inbox-hmac-secret';
  const original = process.env.CHATWOOT_HMAC_TOKEN;

  afterEach(() => {
    if (original === undefined) delete process.env.CHATWOOT_HMAC_TOKEN;
    else process.env.CHATWOOT_HMAC_TOKEN = original;
  });

  function serviceWith(token: string | undefined) {
    if (token === undefined) delete process.env.CHATWOOT_HMAC_TOKEN;
    else process.env.CHATWOOT_HMAC_TOKEN = token;
    return new ChatwootService();
  }

  it('produces the HMAC-SHA256 Chatwoot expects', () => {
    const result = serviceWith(SECRET).identityFor('user-123');

    expect(result.userId).toBe('user-123');
    expect(result.identifierHash).toBe(
      createHmac('sha256', SECRET).update('user-123').digest('hex'),
    );
    expect(result.identifierHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives different users different hashes', () => {
    const svc = serviceWith(SECRET);
    expect(svc.identityFor('user-a').identifierHash).not.toBe(
      svc.identityFor('user-b').identifierHash,
    );
  });

  it('never echoes the secret back to the caller', () => {
    // A leaked secret here would let anyone impersonate anyone.
    const result = serviceWith(SECRET).identityFor('user-123');
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(Object.keys(result).sort()).toEqual(['identifierHash', 'userId']);
  });

  it('refuses with 503 rather than a weak hash when unconfigured', () => {
    // Falling back to an empty key would still produce a valid-looking hex
    // string that Chatwoot would reject — failing loudly is the honest answer.
    expect(() => serviceWith(undefined).identityFor('user-123')).toThrow(
      expect.objectContaining({ status: 503 }),
    );
    expect(() => serviceWith('   ').identityFor('user-123')).toThrow(
      expect.objectContaining({ status: 503 }),
    );
  });
});
