const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function resolveDemoPassword(databaseUrl: string, configured?: string): string {
  const host = new URL(databaseUrl).hostname;
  if (configured) return configured;
  if (LOCAL_HOSTS.has(host)) return 'GreenCity-Demo-2026';
  throw new Error('DEMO_PASSWORD is required when seeding a non-loopback DATABASE_URL');
}
