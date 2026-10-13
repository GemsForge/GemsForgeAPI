import SwiftUI
import WebKit

/// Hosts the existing React Console without duplicating its feature UI in SwiftUI.
struct GemLifeWebView: NSViewRepresentable {
    private let consoleURL: URL

    init(consoleURL: URL? = nil) {
        let configuredURL = ProcessInfo.processInfo.environment["GEM_LIFE_CONSOLE_URL"]
        self.consoleURL = consoleURL
            ?? URL(string: configuredURL ?? "http://localhost:5173/")!
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.setValue(false, forKey: "drawsBackground")
        webView.load(URLRequest(url: consoleURL))
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        guard webView.url == nil else { return }
        webView.load(URLRequest(url: consoleURL))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, didFail navigation: WKNavigation?, withError error: Error) {
            NSLog("Gem Life Console navigation failed: %@", error.localizedDescription)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation?, withError error: Error) {
            NSLog("Gem Life Console could not load: %@", error.localizedDescription)
        }
    }
}
