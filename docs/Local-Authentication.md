# Local authentication

The private Gem Life Console signs in through `POST /auth/local` using the
username and password configured on the API. The API maps that one configured
credential pair to `GEM_LIFE_OPERATOR_ACCOUNT_ID`, creates the account and Hub
when needed, and returns a revocable opaque session token.

## API configuration

Set these values in the API process environment or the local Xcode Run scheme:

```text
LOCAL_AUTH_USERNAME=<private username>
LOCAL_AUTH_PASSWORD=<private password>
GEM_LIFE_OPERATOR_ACCOUNT_ID=<existing Gem Life account ID>
```

All three values are required. If any value is missing or empty, local sign-in
returns a service-unavailable response. Keep credentials out of the Console
build environment, source control, and shared schemes.

## Session behavior

The Console posts the credentials to the same-origin `/auth/local` endpoint.
The API stores only a hash of the random session token, and the browser keeps
the returned token in session storage. Protected API calls send that token as
a bearer credential. `POST /auth/logout` revokes the current server session;
expired or revoked sessions clear the browser session and return the user to
sign-in.

The local credential pair has no password reset or account creation flow. The
owner updates the API environment configuration when credentials need to
change. This single-owner local setup is not a multi-user identity system and
does not make public hosting safe. Keep the API private until the deployment
security and ownership migration checks in
[`Deployment-Security.md`](Deployment-Security.md) are complete.
