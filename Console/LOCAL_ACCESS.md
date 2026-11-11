# Device-local access

The Console has two separate concerns: the native device-local workspace and
the API account session. The native workspace remains device-local, while the
Console's local sign-in uses the API session contract. Do not treat one as
proof of the other.

The UI must not collect passwords itself, invent credentials, or persist
session or personal query data in browser storage. Account identity,
authorization, token handling, and expiration are server/session concerns; see
`Local-Authentication.md` for that contract.

A workspace opens locally when the app loads. Its banner checks `/health` and
distinguishes checking, available, and unavailable API state, with a retry.
Availability is not identity or authorization. The old static green API marker
is not used as proof of a connection.

End local session cancels reads, clears the in-memory query/mutation cache, and
unmounts feature screens so unsaved drafts and preview URLs are released. It
is unavailable while saves are pending rather than pretending to cancel a committed write.
Resume remounts fresh screens and refetches records. Reloading the app starts a
new local workspace automatically; ending it is not a password-protected lock.
No native-workspace flag or personal query data is persisted in browser storage.

The native host uses an ephemeral WebKit store. The trusted main-frame session
end message cancels its picker and clears that web view's website data. The
message contains no credentials or paths. Late picker results cannot start an
upload after their owning view unmounts. API requests opt out of the HTTP cache;
TanStack Query manages the intentional in-memory cache instead.

This does **not** stop another process from calling the API, undo writes, delete
stored files/records, clear other browsers, or make network exposure safe. Keep
the local API bound to loopback. Native cleanup acknowledgement is
informational; it is not a server logout acknowledgement. API sign-out and
credential expiry follow the account-session contract and must not be simulated
by ending the native workspace.
