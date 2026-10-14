import Foundation

let policy = HostPolicy(origin: URL(string: "http://localhost:5173/")!)
for path in ["http://localhost:5173/", "http://localhost:5173/education"] {
    precondition(policy.trusts(URL(string: path)), "Trusted app route rejected")
}
for path in ["https://example.com", "file:///etc/passwd", "http://localhost:9999/", "http://localhost.evil.test:5173/", "http://user@localhost:5173/", "javascript:alert(1)"] {
    precondition(!policy.trusts(URL(string: path)), "Untrusted origin accepted")
}
precondition(HostPolicy.validRequestID("request-123"))
precondition(!HostPolicy.validRequestID("../file"))
precondition(!HostPolicy.validRequestID(nil))
precondition(!HostPolicy.validRequestID(String(repeating: "a", count: 65)))
print("Host policy: 12 assertions passed")
