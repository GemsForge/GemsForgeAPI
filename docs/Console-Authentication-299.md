# React Console authentication — #299

The React Console signs in through Supabase Auth with email and password, then
exchanges the short-lived Supabase access token for a revocable, opaque Gem Life
API session. Only the API session is kept in the current tab's `sessionStorage`
and sent to protected API routes. Supabase passwords and access tokens are not
persisted by the Console. Sign out revokes the API session and clears cached
records. Expired/revoked sessions return the user to sign-in.

This first release is deliberately owner-only. Configure Supabase to disable
new user signups and configure the API with the single permitted Supabase
subject and its existing Gem Life account ID. The API rejects every other
identity. Apple sign-in is not part of this implementation; it remains a
possible future identity provider and must not be required to use Gem Life.

## Supabase setup

1. Create a Supabase project and an email/password user for the owner. Disable
   public signups in the Supabase Auth settings. Create the owner account
   manually in the Supabase dashboard; password recovery/public signup flows
   are outside this private-console release.
2. In ignored `Console/.env.local`, configure the project URL and publishable
   key (these are public browser configuration, not secrets):

   ```dotenv
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
   VITE_API_TARGET=http://127.0.0.1:8180
   ```

3. Configure the API process with the same project URL, the owner's stable
   Supabase Auth user ID (JWT `sub`), and the existing Gem Life account ID:

   ```dotenv
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_OWNER_SUBJECT=your-supabase-auth-user-uuid
   GEM_LIFE_OPERATOR_ACCOUNT_ID=your-existing-gem-life-account-id
   ```

   The API obtains the project's asymmetric signing keys from its Supabase JWKS
   endpoint and verifies signature, issuer, audience, issue time, and expiry.
   Never put a Supabase secret/service-role key in the Console or a `VITE_`
   variable. `SUPABASE_OWNER_SUBJECT` and `GEM_LIFE_OPERATOR_ACCOUNT_ID` are
   server-only configuration.
4. Start the API and Console as described in [Local Development](Local-Development.md).
   In a packaged run, `/` is a guidance page and `/app/` is the authenticated
   Console. In development, use the Vite URL shown in the terminal.

The authentication migration moves existing account IDs into provider-neutral
`Accounts` records, maps existing Apple subjects into `AccountIdentities`,
repoints hubs to the new account table, and removes the obsolete Apple
challenge/account tables. Existing resource rows are not reassigned by this
migration. The configured account ID must match the existing account/hub so
the owner continues to access only explicitly owned data.

## Security boundary and verification

The API remains private. This owner-only login is not authorization for a
public or multi-tenant launch: account creation, user lifecycle, route-level
permissions, and tenant isolation require their own reviewed work.

Run the Console checks from `Console/`:

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

Automated tests cover Supabase token exchange, API bearer-session use,
owner-only identity mapping, missing configuration, invalid/expired tokens,
session revocation, and migration preservation. A live sign-in smoke test
requires the configured Supabase project and owner user.
