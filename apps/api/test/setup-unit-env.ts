import { ensureUnitTestDatabaseUrl } from './setup-env';

// Unit tests parse configuration but must not connect to a database. The
// integration config intentionally omits this file and requires a real URL.
ensureUnitTestDatabaseUrl();
