# Chatwoot deployment checklist

## Decision

- [ ] Choose Chatwoot Cloud or self-hosted Community Edition.
- [ ] Confirm production GreenCity and Chatwoot hostnames.
- [ ] Confirm anonymous-only or HMAC-verified logged-in support.
- [ ] Confirm provider, budget, agent count, and expected volume.
- [ ] Assign an owner for upgrades, backups, and incidents.

## Self-hosted infrastructure

- [ ] Create isolated `infra/chatwoot/` deployment files.
- [ ] Pin an exact stable CE image for Rails and Sidekiq.
- [ ] Provision Linux VPS with adequate CPU/RAM/disk/swap.
- [ ] Configure DNS, Nginx, TLS, firewall, and restricted SSH.
- [ ] Prove ports 3000, 5432, and 6379 are not public.
- [ ] Generate and store application/encryption/database/Redis secrets.
- [ ] Configure SMTP and attachment storage.
- [ ] Run `rails db:chatwoot_prepare` and start services.
- [ ] Verify service recovery after VPS reboot.

## Chatwoot account and inbox

- [ ] Create first administrator and disable public signup.
- [ ] Create a production Website inbox for the exact GreenCity origin.
- [ ] Configure Vietnamese copy, business hours, and assigned agents.
- [ ] Create a separate staging inbox/token.
- [ ] Enable identity validation if account-specific support is allowed.
- [ ] Complete one standalone test conversation.

## GreenCity widget

- [ ] Add public base URL and website token placeholders.
- [ ] Add one fail-open widget loader mounted in the root layout.
- [ ] Guard against duplicate SDK/script initialization.
- [ ] Wait for `chatwoot:ready` before SDK calls.
- [ ] Verify missing configuration does not affect GreenCity.
- [ ] Verify desktop and 320/390 px mobile layouts.
- [ ] Run web smoke, typecheck, and build.

## Verified user identity

- [ ] Store the website inbox HMAC token only in the API secret store.
- [ ] Add one authenticated identity endpoint using Node `crypto`.
- [ ] Use a stable internal user ID, not user-entered email, as identifier.
- [ ] Call `setUser` with `identifier_hash` after SDK and auth are ready.
- [ ] Call `$chatwoot.reset()` on logout/account change.
- [ ] Test anonymous, unauthorized, login, logout, and account-switch flows.
- [ ] Search the client build for the HMAC secret.

## Operations and launch

- [ ] Back up PostgreSQL, attachments, environment, and encryption keys off-host.
- [ ] Restore a backup into a disposable instance.
- [ ] Configure uptime, Sidekiq, disk, memory, and backup-age alerts.
- [ ] Enable administrator/agent MFA where supported.
- [ ] Approve privacy, retention, and agent verification policy.
- [ ] Snapshot before every Chatwoot upgrade.
- [ ] Document exact update, verification, and restore commands.
- [ ] Deploy Chatwoot before enabling the Vercel widget variables.
- [ ] Complete anonymous and logged-in production smoke tests.
- [ ] Rehearse widget rollback by removing its public variables.

## Deferred

- [ ] Additional social/messaging channels.
- [ ] Captain/AI and help center.
- [ ] Kubernetes or multi-node HA.
- [ ] Custom Chatwoot fork or white-label build.
- [ ] GreenCity-to-Chatwoot webhooks/automations.
