# Deployment Plan: Chatwoot for GreenCity

## 1. Goal

Add a support chat bubble to the GreenCity Next.js website and give support
agents a Chatwoot inbox at a separate HTTPS hostname.

Target topology:

```text
Visitor
  |
  +--> https://green-city-web.vercel.app  (existing Next.js/Vercel)
  |       |
  |       +--> Chatwoot widget SDK
  |               |
  +---------------+--> https://chat.<production-domain>
                            |
                            +-- Nginx / TLS
                            +-- Chatwoot Rails
                            +-- Chatwoot Sidekiq
                            +-- PostgreSQL
                            +-- Redis
                            +-- attachment storage

Support agents --> https://chat.<production-domain>/app
```

Chatwoot is not deployed "inside" the GreenCity website. It is an independent
application; GreenCity embeds only its website widget.

## 2. Decision gate

### Recommended default

Use Chatwoot Cloud unless self-hosting is required for data residency,
customization, or cost control at a known agent volume. Cloud removes the Rails,
Sidekiq, PostgreSQL, Redis, backup, patching, and availability burden.

### Self-host path covered by this plan

If self-hosting is required:

- run Chatwoot Community Edition on one dedicated Ubuntu VPS;
- use the official Docker Compose deployment as the baseline;
- pin an exact stable `vX.Y.Z-ce` image, never `latest`;
- expose only Nginx on ports 80/443;
- keep Rails, PostgreSQL, and Redis bound to localhost/private networking;
- do not fork or copy the Chatwoot source into the GreenCity monorepo.

The single-VPS layout is deliberate. Split Rails, Sidekiq, PostgreSQL, and Redis
only after measured load or an uptime requirement justifies it.

## 3. Current GreenCity context

- Web: Next.js 15 / React 19 on Vercel.
- API: NestJS 11 on Render.
- Browser API traffic remains same-origin through `/api/*`.
- The current web app has no Content Security Policy, so no CSP source change is
  required for the first widget deployment.
- The repository already has unrelated payment and UI changes. They must not be
  modified or bundled into the Chatwoot change.

## 4. Assumptions

1. The first release needs the Website inbox only; WhatsApp, Facebook, email
   ingestion, AI agents, and help center are out of scope.
2. Public visitors may start anonymous chats.
3. Logged-in users may discuss account or transaction data, so their identity
   must be HMAC-validated before agents trust it.
4. A production hostname such as `chat.greencity.vn` can be created.
5. SMTP credentials are available for invitations, password reset, and
   notifications.
6. Initial traffic is low enough for one VPS.

## 5. Capacity baseline

For a demo or low-volume pilot:

- 2 vCPU, 4 GB RAM, 20+ GB SSD;
- at least 1 GB swap;
- daily off-host backups.

For a production starting point:

- 4 vCPU, 8 GB RAM, 50+ GB SSD;
- object storage for attachments;
- provider snapshots plus tested PostgreSQL backups.

Chatwoot documents 4 GB RAM as the minimum and recommends 4 CPU cores for up to
10,000 conversations/day. Do not put this workload on the existing free Render
API instance.

## 6. Secrets and configuration

### Public browser configuration

These values are expected in the Vercel web project and may appear in the
browser bundle:

- `NEXT_PUBLIC_CHATWOOT_BASE_URL`
- `NEXT_PUBLIC_CHATWOOT_WEBSITE_TOKEN`

The website token identifies an inbox; it is not the HMAC secret.

### Server-only configuration

These values must never use a `NEXT_PUBLIC_` prefix:

- Chatwoot `SECRET_KEY_BASE`
- Active Record encryption keys
- PostgreSQL password
- Redis password
- SMTP credentials
- object-storage credentials
- website inbox HMAC token used for identity validation

Store VPS secrets in a root-readable environment file or the provider's secret
store. Store the widget HMAC token only in the GreenCity API service.

Minimum Chatwoot production settings include:

- `FRONTEND_URL=https://chat.<production-domain>`
- `FORCE_SSL=true`
- `ENABLE_ACCOUNT_SIGNUP=false`
- `RAILS_ENV=production`
- strong PostgreSQL and Redis credentials
- real `MAILER_SENDER_EMAIL` and SMTP configuration
- `ACTIVE_STORAGE_SERVICE=local` for a pilot, or an isolated supported object
  store for production
- `RAILS_LOG_TO_STDOUT=true`
- `ENABLE_RACK_ATTACK=true`
- `ENABLE_RACK_ATTACK_WIDGET_API=true`

Do not reuse the GreenCity application database or storage bucket. The
lifecycle, credentials, backup, and restore boundaries are different.

## 7. Phased implementation

### Phase 0 — Confirm the operating model

#### Task 0.1: Resolve the four open decisions

Decide:

1. Chatwoot Cloud or self-hosted Community Edition.
2. Final GreenCity and Chatwoot hostnames.
3. Anonymous-only chat or HMAC-verified logged-in identity.
4. VPS/provider, budget, expected agents, and expected conversation volume.

Acceptance criteria:

- [ ] One deployment model and one hostname are written down.
- [ ] A named person owns Chatwoot upgrades, backups, and incident response.
- [ ] Data retention and attachment requirements are known.

Verification:

- [ ] Human approval before provisioning or code changes.

Dependencies: None.

Estimated scope: XS.

### Phase 1 — Prepare self-hosted infrastructure

Skip this phase for Chatwoot Cloud.

#### Task 1.1: Create the deployment boundary

Create a small, Chatwoot-specific deployment directory instead of changing the
existing GreenCity Compose stack:

```text
infra/chatwoot/
  compose.yml
  .env.example
  README.md
```

Start from Chatwoot's official production Compose file, then make only these
intentional changes:

- pin the Chatwoot Rails and Sidekiq image to the same exact CE release;
- keep Rails on `127.0.0.1:3000`;
- keep PostgreSQL and Redis on localhost/private networking;
- add service health checks where the upstream template lacks them;
- use named volumes;
- do not put real secrets in Git.

Acceptance criteria:

- [ ] `docker compose config` succeeds with placeholder values.
- [ ] No `latest` or floating Chatwoot tag remains.
- [ ] No database, Redis, or Rails port is publicly bound.

Verification:

- [ ] Review the resolved Compose config.
- [ ] Run a secret scan or `git diff` review before commit.

Dependencies: Task 0.1.

Estimated scope: S, 3 files.

#### Task 1.2: Provision VPS, DNS, firewall, and TLS

- Provision supported Linux with the agreed capacity.
- Create `A/AAAA` records for `chat.<production-domain>`.
- Restrict SSH to administrator IPs or a VPN.
- Allow public inbound 80/443 only.
- Install current Docker Engine and Compose plugin.
- Configure Nginx as the TLS reverse proxy to `127.0.0.1:3000`.
- Obtain and auto-renew a Let's Encrypt certificate.

Acceptance criteria:

- [ ] `https://chat.<production-domain>` has a valid certificate.
- [ ] Ports 3000, 5432, and 6379 are unreachable from the internet.
- [ ] Certificate renewal is enabled and testable.

Verification:

- [ ] External port check.
- [ ] `curl -I https://chat.<production-domain>` reaches Nginx.
- [ ] `nginx -t` succeeds.

Dependencies: Task 1.1 and DNS access.

Estimated scope: M, infrastructure only.

### Checkpoint A — Infrastructure boundary

- [ ] Exact image release is recorded.
- [ ] Only 80/443 are publicly exposed.
- [ ] Secrets are absent from Git.
- [ ] Rollback/snapshot exists before first database initialization.

### Phase 2 — Deploy and bootstrap Chatwoot

#### Task 2.1: Configure production services

- Generate `SECRET_KEY_BASE` and Active Record encryption keys using Chatwoot's
  own Rails commands.
- Configure PostgreSQL, Redis, SMTP, `FRONTEND_URL`, SSL, locale, and storage.
- Keep public account signup disabled.
- For production attachments, create a separate least-privilege bucket and
  lifecycle policy. A pilot may use the local volume only if daily off-host
  backup includes `/app/storage`.

Acceptance criteria:

- [ ] Rails and Sidekiq use identical configuration and image versions.
- [ ] SMTP sends a password-reset email.
- [ ] No default or blank database/Redis password remains.
- [ ] Encryption keys are backed up outside the VPS.

Verification:

- [ ] Review redacted environment variable names, not values.
- [ ] Confirm Rails and Sidekiq can connect to PostgreSQL and Redis.
- [ ] Send one non-sensitive test email.

Dependencies: Checkpoint A.

Estimated scope: M.

#### Task 2.2: Initialize and start Chatwoot

- Run `rails db:chatwoot_prepare` once for the initial database.
- Start all services.
- Create the first administrator account through the documented onboarding
  flow.
- Disable any temporary onboarding exposure after the admin exists.

Acceptance criteria:

- [ ] Rails, Sidekiq, PostgreSQL, and Redis are healthy after restart.
- [ ] Admin can sign in over HTTPS.
- [ ] No service depends on an interactive shell staying open.

Verification:

- [ ] Check `docker compose ps`.
- [ ] Check Rails and Sidekiq logs for boot/database/Redis errors.
- [ ] Reboot the VPS and verify automatic recovery.

Dependencies: Task 2.1.

Estimated scope: S.

#### Task 2.3: Configure the GreenCity Website inbox

In Chatwoot:

- create one Website inbox for the exact GreenCity production origin;
- set Vietnamese locale, brand color, welcome copy, business hours, and offline
  expectations;
- assign only required agents;
- enable pre-chat fields only if the support process needs them;
- copy the public website token;
- enable identity validation and copy its secret to the GreenCity API secret
  store if logged-in identity is in scope.

Acceptance criteria:

- [ ] One inbox exists for production; staging uses a different inbox/token.
- [ ] At least one assigned agent can receive and reply.
- [ ] The widget domain matches the deployed GreenCity origin.

Verification:

- [ ] Use Chatwoot's generated snippet on a temporary local page.
- [ ] Send and reply to one test conversation.

Dependencies: Task 2.2.

Estimated scope: XS.

### Checkpoint B — Chatwoot works independently

- [ ] Admin login, agent assignment, SMTP, and one conversation work.
- [ ] Service survives a VPS reboot.
- [ ] No GreenCity code has changed yet.

### Phase 3 — Embed the widget in Next.js

#### Task 3.1: Add one widget loader

Add one client component, mounted once from
`apps/web/src/app/layout.tsx`, that:

- reads the public base URL and website token;
- does nothing when either value is absent;
- loads `<baseUrl>/packs/js/sdk.js` asynchronously once;
- initializes Chatwoot after the script loads;
- uses Vietnamese locale and the agreed position/design;
- listens for `chatwoot:ready` before calling SDK methods;
- reports load failure without breaking the GreenCity page.

Do not add a package. The Chatwoot SDK is the external script.

Likely files:

- `apps/web/src/components/chatwoot-widget.tsx`
- `apps/web/src/app/layout.tsx`
- `.env.example`
- `apps/web/scripts/smoke.mjs`

Acceptance criteria:

- [ ] Missing configuration produces no widget and no page error.
- [ ] Valid configuration loads exactly one widget across App Router navigation.
- [ ] The widget does not obscure primary mobile controls.
- [ ] No Chatwoot server secret appears in the browser bundle.

Verification:

- [ ] `pnpm --filter web test`
- [ ] `pnpm --filter web typecheck`
- [ ] `pnpm --filter web build`
- [ ] Manual desktop/mobile check on staging.

Dependencies: Task 2.3.

Estimated scope: M, 4 files.

#### Task 3.2: Add HMAC-verified logged-in identity

Required before agents use chat for account, payment, or transaction support.

Backend:

- expose one authenticated endpoint that returns the current user's stable
  GreenCity user ID, allowed contact fields, and
  `HMAC-SHA256(key=website-inbox-HMAC-token, message=identifier)`;
- use Node's built-in `crypto`;
- never return or log the HMAC secret;
- return no identity for anonymous sessions.

Frontend:

- wait for both the authenticated GreenCity user and `chatwoot:ready`;
- call `setUser` with the stable ID and `identifier_hash`;
- call `window.$chatwoot.reset()` on logout or account change;
- do not pass roles, payment state, or sensitive profile data unless a support
  workflow explicitly requires it.

Likely files:

- one API controller/service path following existing auth patterns;
- one focused API unit/integration test;
- `apps/web/src/components/chatwoot-widget.tsx`;
- the existing auth provider only if it lacks a safe logout hook;
- `.env.example`.

Acceptance criteria:

- [ ] The HMAC token is server-only.
- [ ] Another user cannot request an identity payload for a different user ID.
- [ ] Login binds the correct verified identity.
- [ ] Logout resets Chatwoot before another account can use the browser.

Verification:

- [ ] Test valid/anonymous/unauthorized identity responses.
- [ ] Search built assets for the HMAC secret.
- [ ] Browser test: login A, chat, logout, login B; B cannot see A's session.

Dependencies: Task 3.1 and identity validation enabled in Task 2.3.

Estimated scope: M.

### Checkpoint C — GreenCity integration

- [ ] Anonymous chat works.
- [ ] Logged-in identity is verified or agents are explicitly prohibited from
      discussing account-specific data.
- [ ] Logout resets the Chatwoot session.
- [ ] Web quality gates pass.

### Phase 4 — Production readiness

#### Task 4.1: Backups and restore drill

Back up:

- PostgreSQL;
- attachment storage;
- environment configuration and encryption keys;
- the pinned Compose and Nginx configuration.

Store backups off the VPS with restricted access. Perform one restore into a
disposable host before launch.

Acceptance criteria:

- [ ] Recovery point objective and retention are recorded.
- [ ] A fresh instance can restore database and attachments.
- [ ] Backup monitoring alerts on failure.

Verification:

- [ ] Timestamped restore evidence and one test conversation/attachment after
      restore.

Dependencies: Task 2.2.

Estimated scope: M.

#### Task 4.2: Monitoring and security baseline

- alert on HTTPS failure, Rails availability, Sidekiq queue failure, disk,
  memory, and backup age;
- keep Chatwoot's Rack Attack protection enabled;
- use MFA for administrator/agent accounts once encryption keys are safely
  configured;
- review telemetry choice and privacy notice;
- define a conversation/attachment retention policy;
- keep logs free of message bodies where possible.

Acceptance criteria:

- [ ] An alert reaches the owner when Chatwoot is unavailable.
- [ ] Disk and memory thresholds are set before exhaustion.
- [ ] Admin accounts use strong unique passwords and MFA where supported.

Verification:

- [ ] Stop Rails in a maintenance window and observe the alert.
- [ ] Review public headers, TLS, and exposed ports.

Dependencies: Task 2.2.

Estimated scope: S.

#### Task 4.3: Release and rollback

Release order:

1. Deploy Chatwoot and verify it independently.
2. Create/configure the production Website inbox.
3. Deploy the GreenCity widget disabled or with staging values.
4. Enable production public values in Vercel and redeploy.
5. Run anonymous and logged-in smoke checks.

Fast widget rollback:

- remove/unset the two public Chatwoot variables and redeploy GreenCity.

Chatwoot rollback:

- snapshot before upgrades;
- read release notes;
- pin the new exact version;
- run the documented database preparation/migrations;
- verify Rails, Sidekiq, inbox, and widget;
- restore the pre-upgrade database/storage snapshot if migration fails.

Never downgrade only the container image after a database migration.

Acceptance criteria:

- [ ] Widget can be disabled without taking GreenCity offline.
- [ ] Upgrade and rollback commands are documented and peer-reviewed.
- [ ] One production test conversation is received and replied to.

Verification:

- [ ] GreenCity remains usable while Chatwoot is stopped.
- [ ] Disable/re-enable rehearsal on staging.

Dependencies: Checkpoints B and C, Tasks 4.1–4.2.

Estimated scope: S.

## 8. End-to-end acceptance criteria

- [ ] GreenCity works normally when Chatwoot is unavailable.
- [ ] The widget appears once on supported desktop and mobile browsers.
- [ ] A visitor can send a message and receive an agent reply.
- [ ] Logged-in users are HMAC-verified before account-specific support.
- [ ] Logout/account switching cannot leak the prior chat session.
- [ ] Rails, PostgreSQL, Redis, and Sidekiq are not directly internet-exposed.
- [ ] SMTP, backup, restore, monitoring, and upgrade ownership are in place.
- [ ] No secret is committed or included in the Vercel client bundle.

## 9. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Treating Chatwoot as a small widget-only service | High | Budget for Rails, Sidekiq, PostgreSQL, Redis, storage, SMTP, backup, and patching. |
| Running on the existing free Render API | High | Dedicated VPS or Chatwoot Cloud. |
| Floating `latest` image | High | Pin exact stable CE version and snapshot before upgrade. |
| Lost database, attachments, or encryption keys | High | Off-host backup plus restore drill. |
| User impersonation through browser-provided email | High | Stable user ID plus server-generated HMAC; reset on logout. |
| Widget outage breaks GreenCity | Medium | Loader must fail open; GreenCity never depends on Chatwoot to render. |
| Duplicate widget after client navigation | Medium | Mount once in root layout and guard script initialization. |
| Chat bubble obscures mobile actions | Medium | Test 320/390 px widths and adjust widget position/settings. |
| Support data retained indefinitely | Medium | Agree retention/privacy policy before production. |
| Upgrade migration fails | Medium | Pin version, snapshot first, test on staging, restore rather than blind image downgrade. |

## 10. Explicitly deferred

- WhatsApp, Facebook, Instagram, SMS, and email channel ingestion.
- Captain/AI features.
- Help center and knowledge-base migration.
- Kubernetes, multi-node high availability, and managed Redis/PostgreSQL.
- Custom Chatwoot source fork, white-label build, and plugin development.
- Syncing GreenCity transactions into Chatwoot custom attributes.
- Webhooks/automation until a concrete support workflow needs them.

## 11. Official references

- [Chatwoot repository](https://github.com/chatwoot/chatwoot)
- [Production architecture](https://developers.chatwoot.com/self-hosted/deployment/architecture)
- [Docker production deployment](https://developers.chatwoot.com/self-hosted/deployment/docker)
- [System requirements](https://developers.chatwoot.com/self-hosted/deployment/requirements)
- [Environment variables](https://developers.chatwoot.com/self-hosted/configuration/environment-variables)
- [Backups and restore](https://developers.chatwoot.com/self-hosted/deployment/backup)
- [Upgrades](https://developers.chatwoot.com/self-hosted/deployment/upgrade)
- [Supported attachment storage](https://developers.chatwoot.com/self-hosted/deployment/storage/supported-providers)
- [Next.js widget installation](https://www.chatwoot.com/hc/user-guide/articles/1677676986-how-to-install-live_chat-on-a-next-js-app)
- [Website SDK and user identity](https://www.chatwoot.com/hc/user-guide/articles/1677587234-how-to-send-additional-user-information-to-chatwoot-using-sdk)
- [Identity validation](https://www.chatwoot.com/hc/user-guide/articles/1677587479-how-to-enable-identity-validation-in-chatwoot)
