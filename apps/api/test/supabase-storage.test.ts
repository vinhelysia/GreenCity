import { SupabaseObjectStorage } from '../src/storage/supabase-object-storage';

/**
 * The adapter is verified end to end against real Supabase during deploy (needs
 * a service key this test cannot hold). Here we pin the parts that must be right
 * regardless: URL construction, key safety, auth header, and status handling —
 * a mistake in any of these silently breaks every image on the deployed app.
 */
describe('SupabaseObjectStorage', () => {
  const config = {
    url: 'https://proj.supabase.co/',
    serviceKey: 'service-key-xxx',
    bucket: 'greencity-media',
  };

  let calls: Array<{ url: string; init: RequestInit }>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    calls = [];
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(Buffer.from('IMG'), { status: 200 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('requires all three config values', () => {
    expect(() => new SupabaseObjectStorage({ ...config, serviceKey: '' })).toThrow();
    expect(() => new SupabaseObjectStorage({ ...config, url: '' })).toThrow();
    expect(() => new SupabaseObjectStorage({ ...config, bucket: '' })).toThrow();
  });

  it('builds the object URL, trims a trailing slash, and sends the bearer token', async () => {
    const store = new SupabaseObjectStorage(config);
    await store.putObject({
      key: 'media/owner/asset.jpg',
      body: Buffer.from('IMG'),
      contentType: 'image/jpeg',
    });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    // Single slash after .co despite the trailing slash in config.url.
    expect(call.url).toBe(
      'https://proj.supabase.co/storage/v1/object/greencity-media/media/owner/asset.jpg',
    );
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer service-key-xxx');
    expect(headers['Content-Type']).toBe('image/jpeg');
  });

  it('rejects path-unsafe keys before any network call', async () => {
    const store = new SupabaseObjectStorage(config);
    await expect(store.getObject('../secret')).rejects.toThrow('traversal');
    await expect(store.getObject('/leading')).rejects.toThrow('Invalid storage key');
    await expect(store.getObject('')).rejects.toThrow('empty');
    expect(calls).toHaveLength(0);
  });

  it('returns bytes on getObject and surfaces a non-200 as an error', async () => {
    const store = new SupabaseObjectStorage(config);
    const bytes = await store.getObject('media/x.jpg');
    expect(bytes.toString()).toBe('IMG');

    globalThis.fetch = (async () =>
      new Response('nope', { status: 404 })) as typeof fetch;
    await expect(store.getObject('media/missing.jpg')).rejects.toThrow('404');
  });

  it('treats a 404 on delete as success (already absent)', async () => {
    const store = new SupabaseObjectStorage(config);
    globalThis.fetch = (async () =>
      new Response('', { status: 404 })) as typeof fetch;
    await expect(store.deleteObject('media/gone.jpg')).resolves.toBeUndefined();
  });
});
