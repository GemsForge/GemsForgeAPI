# React Console authentication — #299

The React Console is the supported browser entry point for private Gem Life
records. The API requires an API-issued bearer session for protected routes;
the Console does not accept or send account, hub, or operator identifiers.
Sign in with Apple creates an API challenge, sends its nonce through Apple's
web authorization popup, and exchanges the returned identity token and
challenge ID at `POST /auth/apple`. The API response's opaque session token is
kept in the current tab's `sessionStorage`, attached as a bearer token to
protected API requests, and never placed in a URL, application log, or
`localStorage`. Sign out calls `POST /auth/logout` and clears cached records.
An expired or revoked session clears the browser session and returns the user
to the sign-in screen.

## Configuration

1. In the Apple Developer account, configure Sign in with Apple for the web
   Services ID. Register the Console's domain and an HTTPS return URL as
   required by Apple's web setup. Apple's Sign in with Apple JS rejects
   `localhost` and IP addresses as registered redirect domains, so a local
   browser smoke test needs a registered HTTPS development host or tunnel.
2. Configure the React build/dev server with these public client settings
   (for local development, keep them in an ignored `Console/.env.local` file):

   ```dotenv
   VITE_APPLE_CLIENT_ID=com.example.gemlife.web
   VITE_APPLE_REDIRECT_URI=https://console.example.com/app/
   VITE_API_TARGET=http://127.0.0.1:8081
   ```

   `VITE_APPLE_CLIENT_ID` is a public Apple Services ID, not a secret. The
   redirect URI must exactly match the Apple Developer configuration and use
   HTTPS with a registered domain.

3. Set the same identifier on the API process:

   ```bash
   APPLE_CLIENT_ID=com.example.gemlife.web swift run GemLife
   ```

   The API returns an actionable unavailable response when `APPLE_CLIENT_ID`
   is absent. Do not put Apple private keys, client secrets, or Apple account
   passwords in the browser build or repository.

4. Start the Console with `cd Console && npm run dev`. The Console's Vite
   proxy forwards `/auth` and resource API paths to `VITE_API_TARGET`.
   In a packaged local run, `/` is a guidance page and `/app/` is the
   authenticated Console; in development use the Vite URL shown in the
   terminal.

## Security boundary and verification

This login UI does not make deployment public. The API must remain private
until route authorization and per-account hub ownership are implemented and
verified. The existing deployment/security guidance remains authoritative.

Run the Console checks from `Console/`:

```bash
npm run format:check
npm run lint
npm run test
npm run build
```

Authentication tests cover the nonce/state exchange, token storage boundary,
bearer header attachment, expiry/revocation clearing, and provider/setup
failures. A live Apple sign-in smoke test additionally requires the configured
Apple Services ID, registered HTTPS domain/return URL, and API `APPLE_CLIENT_ID`.

Apple references:

- [Configuring your webpage for Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple)
- [Configuring your environment for Sign in with Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)
