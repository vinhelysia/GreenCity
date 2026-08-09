import {
  SUPABASE_REQUEST_TIMEOUT_MS,
  SupabaseObjectStorage,
} from '../src/storage/supabase-object-storage';

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
    jest.restoreAllMocks();
  });

  it('requires all three config values', () => {
    expect(() => new SupabaseObjectStorage({ ...config, serviceKey: '' })).toThrow();
    expect(() => new SupabaseObjectStorage({ ...config, url: '' })).toThrow();
    expect(() => new SupabaseObjectStorage({ ...config, bucket: '' })).toThrow();
  });

  it('builds the object URL and sends a legacy bearer token for every operation', async () => {
    const store = new SupabaseObjectStorage(config);
    await store.putObject({
      key: 'media/owner/asset.jpg',
      body: Buffer.from('IMG'),
      contentType: 'image/jpeg',
    });
    await store.getObject('media/owner/asset.jpg');
    await store.deleteObject('media/owner/asset.jpg');

    expect(calls).toHaveLength(3);
    const call = calls[0]!;
    // Single slash after .co despite the trailing slash in config.url.
    expect(call.url).toBe(
      'https://proj.supabase.co/storage/v1/object/greencity-media/media/owner/asset.jpg',
    );
    expect(
      calls.map(({ init }) => (init.headers as Record<string, string>).Authorization),
    ).toEqual(Array(3).fill('Bearer service-key-xxx'));
    expect((call.init.headers as Record<string, string>)['Content-Type']).toBe(
      'image/jpeg',
    );
  });

  it('sends new secret keys as apikey for every operation', async () => {
    const store = new SupabaseObjectStorage({
      ...config,
      serviceKey: 'sb_secret_example',
    });
    await store.putObject({
      key: 'media/x.jpg',
      body: Buffer.from('IMG'),
      contentType: 'image/jpeg',
    });
    await store.getObject('media/x.jpg');
    await store.deleteObject('media/x.jpg');

    for (const call of calls) {
      const headers = call.init.headers as Record<string, string>;
      expect(headers.apikey).toBe('sb_secret_example');
      expect(headers.Authorization).toBeUndefined();
    }
  });

  it('rejects path-unsafe keys before any network call', async () => {
    const store = new SupabaseObjectStorage(config);
    await expect(store.getObject('../secret')).rejects.toThrow('traversal');
    await expect(store.getObject('/leading')).rejects.toThrow('Invalid storage key');
    await expect(store.getObject('')).rejects.toThrow('empty');
    expect(calls).toHaveLength(0);
  });

  it('percent-encodes reserved characters so a key cannot escape the bucket path', async () => {
    const store = new SupabaseObjectStorage(config);
    await store.getObject('media/a?b#c%2Fz\\x.jpg');

    expect(calls[0]!.url).toBe(
      'https://proj.supabase.co/storage/v1/object/greencity-media/media/a%3Fb%23c%252Fz%5Cx.jpg',
    );
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

  it('passes a bounded abort timeout to an in-flight upload', async () => {
    const store = new SupabaseObjectStorage(config);
    const timeoutController = new AbortController();
    const timeout = jest
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal);
    let signal: AbortSignal | undefined;
    globalThis.fetch = ((_: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => reject(new Error('upstream abort detail')),
          { once: true },
        );
      });
    }) as typeof fetch;

    const pending = store.putObject({
      key: 'media/x.jpg',
      body: Buffer.from('IMG'),
      contentType: 'image/jpeg',
    });

    expect(signal).toBeDefined();
    expect(timeout).toHaveBeenCalledWith(SUPABASE_REQUEST_TIMEOUT_MS);
    timeoutController.abort();
    await expect(pending).rejects.toThrow('Supabase putObject request failed');
    expect(signal?.aborted).toBe(true);
  });

  it('keeps the getObject timeout active while a response body is still pending', async () => {
    const store = new SupabaseObjectStorage(config);
    const timeoutController = new AbortController();
    const timeout = jest
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal);
    let signal: AbortSignal | undefined;
    let bodyReadStarted!: () => void;
    const bodyRead = new Promise<void>((resolve) => {
      bodyReadStarted = resolve;
    });
    globalThis.fetch = ((_: string | URL | Request, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return Promise.resolve({
        ok: true,
        arrayBuffer: () => {
          bodyReadStarted();
          return new Promise<ArrayBuffer>((_resolve, reject) => {
            signal?.addEventListener(
              'abort',
              () => reject(new Error('upstream body abort detail')),
              { once: true },
            );
          });
        },
      } as Response);
    }) as typeof fetch;

    const pending = store.getObject('media/x.jpg');

    await bodyRead;
    expect(timeout).toHaveBeenCalledWith(SUPABASE_REQUEST_TIMEOUT_MS);
    timeoutController.abort();
    await expect(pending).rejects.toThrow('Supabase getObject request failed');
    expect(signal?.aborted).toBe(true);
  });

  it('does not expose credentials from a rejected external request', async () => {
    const serviceKey = 'sb_secret_must_not_leak';
    const store = new SupabaseObjectStorage({ ...config, serviceKey });
    globalThis.fetch = (async () => {
      throw new Error(`network failure included ${serviceKey}`);
    }) as typeof fetch;

    const error = await store.getObject('media/x.jpg').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Supabase getObject request failed');
    expect((error as Error).message).not.toContain(serviceKey);
  });

  it.each(['put', 'get', 'delete'] as const)(
    'does not copy an upstream %s error body into the thrown error',
    async (operation) => {
      const serviceKey = 'sb_secret_must_not_leak';
      const signedUrl =
        'https://proj.supabase.co/storage/v1/object/sign/bucket/file?token=secret';
      const store = new SupabaseObjectStorage({ ...config, serviceKey });
      globalThis.fetch = (async () =>
        new Response(`upstream echoed ${serviceKey} ${signedUrl}`, {
          status: 500,
        })) as typeof fetch;

      const result =
        operation === 'put'
          ? store.putObject({
              key: 'media/x.jpg',
              body: Buffer.from('IMG'),
              contentType: 'image/jpeg',
            })
          : operation === 'get'
            ? store.getObject('media/x.jpg')
            : store.deleteObject('media/x.jpg');
      const error = await result.catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        `Supabase ${operation}Object failed (500)`,
      );
    },
  );
});
