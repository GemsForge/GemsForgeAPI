# Device-local access

M3 decision: use device-local access first; defer account sign-in. There are no
API login, token, account session, or expiration endpoints. The UI therefore
does not collect passwords, invent credentials, or present an account login.

A workspace opens locally when the app loads. Its banner checks `/health` and
distinguishes checking, available, and unavailable API state, with a retry.
Availability is not identity or authorization. The old static green API marker
is not used as proof of a connection.

End local session cancels reads, clears the in-memory query/mutation cache, and
unmounts feature screens so unsaved drafts and preview URLs are released. It
is unavailable while saves are pending rather than pretending to cancel a committed write.
Resume remounts fresh screens and refetches records. Reloading the app starts a
new local workspace automatically; ending it is not a password-protected lock.
No session flag or personal query data is persisted in browser storage.

The native host uses an ephemeral WebKit store. The trusted main-frame session
end message cancels its picker and clears that web view's website data. The
message contains no credentials or paths. Late picker results cannot start an
upload after their owning view unmounts. API requests opt out of the HTTP cache;
TanStack Query manages the intentional in-memory cache instead.

This does **not** authenticate API requests, stop another process from calling
the API, undo writes, delete stored files/records, clear other browsers, or make
network exposure safe. Keep the local API bound to loopback. Account access and
credential expiry require a separate server authentication design before any
remote deployment. Native cleanup acknowledgement is informational; there is
no server logout to acknowledge.
