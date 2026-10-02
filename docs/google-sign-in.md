# Google sign-in configuration

GreenCity uses Google's authorization-code flow with PKCE and OpenID Connect. The backend verifies the Google ID token and creates the existing opaque HttpOnly GreenCity session. Google access/refresh tokens are not stored. A Google identity is keyed by its `sub`, not its email.

An existing email/password account must be signed in before linking Google from the account page. Linking requires a matching email and the same active session that started the flow. Google-only accounts have no password; they sign in with Google. New users receive the `USER` role. Disabled accounts cannot sign in through Google.

## Create the Google OAuth client

1. Open [Google Auth Platform](https://console.cloud.google.com/auth/overview) and select/create your GreenCity project.
2. Complete Branding and Audience. For a public GreenCity pilot choose External; while Testing, add the Google accounts that will test it under Test users. Add your actual app/support contact information.
3. Under Clients choose Create client → Web application.
4. Add the exact authorized redirect URI:

   `https://green-city-web.vercel.app/api/auth/google/callback`

   For local development with the same client, also add the exact URL matching `PUBLIC_WEB_URL`, for example:

   `http://localhost:3000/api/auth/google/callback`

   Or, for this repository's browser-test port:

   `http://127.0.0.1:3100/api/auth/google/callback`

5. Save the Client ID and Client Secret securely. Put credentials directly in the hosting environment or the ignored repository-root `.env`; do not send the secret in chat or commit Google's downloaded JSON.

This server redirect flow does not load the browser Google SDK and does not require Authorized JavaScript origins. It requests only `openid email profile`, not Drive/Gmail access. See Google's [web-server OAuth instructions](https://developers.google.com/identity/protocols/oauth2/web-server) and [OpenID Connect guide](https://developers.google.com/identity/openid-connect/openid-connect).

## Enable GreenCity

Set these three backend variables on the existing Render `greencity-api` service:

```dotenv
GOOGLE_CLIENT_ID=<your Web application client ID>
GOOGLE_CLIENT_SECRET=<your client secret>
PUBLIC_WEB_URL=https://green-city-web.vercel.app
```

Keep all existing environment variables. No Google credentials belong in Vercel or `NEXT_PUBLIC_*`. Use the website domain for the callback so the OAuth cookie and final session stay on the same origin through the existing `/api` proxy. Do not use the Render API domain as Google's redirect URI.

Apply `20261002000002_google_sign_in` to production after a backup, then deploy the API before the web UI. The migration adds a nullable unique `googleSubject` column and a short-lived OAuth-attempt table; it changes no existing credentials or roles. Local `pnpm db:migrate` uses the root `.env`; never replace that local database URL with production credentials just to run tests.

Without credentials the API starts normally, `/auth/google/status` reports `enabled: false`, and Google buttons are hidden. For a public pilot, switch Google Audience from Testing to In production once branding/configuration are ready; don't claim a live Google login until the real consent/callback smoke test succeeds.

## Verify

- Sign in with a fresh Google account; check `/api/auth/me`, reload, and logout.
- For an existing GreenCity email, Google login should instruct the user to sign in with their password and link from Account. Linking the same Google email should retain the existing user's history and roles.
- Cancel Google consent: show a localized retry message, with no GreenCity session created.
- Replaying a callback, mismatched browser state, expired state or a revoked linking session must fail. OAuth state expires after ten minutes; starting a second flow in the same browser replaces the first flow's cookie.
- Run `pnpm --filter api test:unit`, `pnpm --filter api test:integration`, and `pnpm --filter web exec playwright test e2e/google-auth.spec.ts` against local/disposable data. Provider-network boundaries are replaced in automated tests; the SDK's actual signature/issuer/audience/expiry verification is exercised with RSA-signed test ID tokens.

The Google button uses the official [Google brand asset](https://developers.google.com/identity/branding-guidelines). Existing Google account links are preserved if credentials are temporarily unset; re-enable the same client to restore Google sign-in.
