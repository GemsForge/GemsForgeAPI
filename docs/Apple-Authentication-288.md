# Apple authentication foundation (#288)

The API accepts Sign in with Apple identity tokens at `POST /auth/apple` and
issues an opaque, expiring bearer session. Clients first request a short-lived
one-time nonce from `POST /auth/apple/challenges`, pass that nonce to Apple's
authorization request, and send the returned identity token with the challenge
ID. `POST /auth/logout` revokes the bearer session.

Set `APPLE_CLIENT_ID` to the exact Apple app or Services ID configured for the
client. Authentication endpoints remain unavailable when this setting is
missing or invalid. `APPLE_SESSION_LIFETIME_SECONDS` is optional (default
30 days; accepted range 60 seconds through 90 days). Do not put Apple account
passwords, Apple private keys, or client secrets in the app or repository.

The API verifies the Apple issuer, RS256 signature and key ID from Apple's
published JWKS, the configured audience, expiration, issue time, and the
one-time nonce. The API stores only a digest of each challenge nonce and
session token. Apple accounts are keyed by Apple's stable subject identifier;
no Apple credential or profile data is needed for this foundation.

The migration `CreateAuthenticationSchema` creates the account, challenge, and
session tables. It is included in the approved repository migration profile.
For an existing Gem Life database, use the documented live migration preview,
backup, explicit confirmation, and verification flow before relying on these
endpoints.

This story does **not** yet protect existing resource routes or isolate records
by user/hub. Keep the API private and do not enable public or multi-user access
until the follow-up authorization and tenant-isolation stories are implemented
and verified.
