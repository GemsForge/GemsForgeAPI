import SwiftUI
import WebKit
import UniformTypeIdentifiers

/// Hosts the existing React Console without duplicating its feature UI in SwiftUI.
struct GemLifeWebView: NSViewRepresentable {
    private let consoleURL: URL

    init(consoleURL: URL? = nil) {
        let configuredURL = ProcessInfo.processInfo.environment["GEM_LIFE_CONSOLE_URL"]
        #if DEBUG
        let defaultURL = "http://localhost:5173/"
        #else
        let defaultURL = "http://127.0.0.1:8080/app/"
        #endif
        let candidate = consoleURL ?? URL(string: configuredURL ?? defaultURL)
        self.consoleURL = candidate.flatMap { HostPolicy.isLocalConsole($0) ? $0 : nil }
            ?? URL(string: defaultURL)!
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(policy: HostPolicy(origin: consoleURL))
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(context.coordinator.bridgeHandler, name: "gemLife")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        context.coordinator.webView = webView
        webView.setValue(false, forKey: "drawsBackground")
        webView.load(URLRequest(url: consoleURL))
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard webView.url == nil else { return }
        webView.load(URLRequest(url: consoleURL))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        let bridgeHandler = GemLifeBridgeHandler()
        let policy: HostPolicy
        weak var webView: WKWebView?
        private var picker: NSOpenPanel?

        init(policy: HostPolicy) {
            self.policy = policy
            super.init()
            bridgeHandler.policy = policy
            bridgeHandler.onMessage = { [weak self] message in self?.receive(message) }
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction) async -> WKNavigationActionPolicy {
            // Keep the bridge unavailable to remote pages, subframes and local paths.
            return action.targetFrame?.isMainFrame == true && policy.trusts(action.request.url) ? .allow : .cancel
        }

        private func reply(_ type: GemLifeBridgeMessageType, requestID: String, payload: [String: String]) {
            guard let webView, policy.trusts(webView.url) else { return }
            webView.sendToReact(GemLifeBridgeMessage(type: type, requestID: requestID, payload: payload))
        }

        private func receive(_ message: GemLifeBridgeMessage) {
            guard HostPolicy.validRequestID(message.requestID), let requestID = message.requestID else { return }
            guard message.type == .requestImage || message.type == .requestFile,
                  message.payload?.isEmpty != false else {
                reply(.error, requestID: requestID, payload: ["message": "Unsupported native request. Paths are not accepted."])
                return
            }
            guard picker == nil else {
                reply(.error, requestID: requestID, payload: ["message": "A file picker is already open."])
                return
            }
            let panel = NSOpenPanel()
            panel.canChooseDirectories = false
            panel.canChooseFiles = true
            panel.allowsMultipleSelection = false
            panel.resolvesAliases = false
            panel.allowedContentTypes = message.type == .requestImage ? [.image] : [.commaSeparatedText]
            picker = panel
            panel.begin { [weak self] response in
                guard let self else { return }
                self.picker = nil
                guard response == .OK, let url = panel.url else {
                    self.reply(.localFile, requestID: requestID, payload: ["cancelled": "true"])
                    return
                }
                let scoped = url.startAccessingSecurityScopedResource()
                defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                do {
                    let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
                    guard values.isRegularFile == true, values.isSymbolicLink != true,
                          let size = values.fileSize, size > 0, size <= HostPolicy.maxFileBytes else {
                        throw CocoaError(.fileReadTooLarge)
                    }
                    let data = try Data(contentsOf: url)
                    guard !data.isEmpty, data.count <= HostPolicy.maxFileBytes else { throw CocoaError(.fileReadTooLarge) }
                    let type = UTType(filenameExtension: url.pathExtension)
                    if message.type == .requestImage {
                        guard type?.conforms(to: .image) == true, NSImage(data: data) != nil else { throw CocoaError(.fileReadCorruptFile) }
                    } else {
                        guard type?.conforms(to: .commaSeparatedText) == true else { throw CocoaError(.fileReadCorruptFile) }
                    }
                    self.reply(.localFile, requestID: requestID, payload: ["name": url.lastPathComponent,
                        "mimeType": type?.preferredMIMEType ?? "application/octet-stream", "base64": data.base64EncodedString()])
                } catch {
                    self.reply(.error, requestID: requestID, payload: ["message": "Choose a supported, non-empty file no larger than 10 MB."])
                }
            }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation?, withError error: Error) {
            NSLog("Gem Life Console navigation failed: %@", error.localizedDescription)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation?, withError error: Error) {
            NSLog("Gem Life Console could not load: %@", error.localizedDescription)
        }

    }
}
