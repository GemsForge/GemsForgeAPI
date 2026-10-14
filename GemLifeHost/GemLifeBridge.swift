import Foundation
import WebKit

/// Stable message names shared by the native host and the React Console.
enum GemLifeBridgeMessageType: String, Codable {
    case navigate
    case requestFile
    case requestImage
    case localFile
    case share
    case session
    case error
}

/// Transport envelope for all SwiftUI ↔ React messages.
struct GemLifeBridgeMessage: Codable, Equatable {
    let type: GemLifeBridgeMessageType
    let requestID: String?
    let payload: [String: String]?
}

/// Decodes messages from React and keeps native handling behind one boundary.
final class GemLifeBridgeHandler: NSObject, WKScriptMessageHandler {
    var onMessage: ((GemLifeBridgeMessage) -> Void)?
    var policy: HostPolicy?

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "gemLife", message.frameInfo.isMainFrame,
              let policy, policy.trusts(message.frameInfo.request.url), policy.trusts(message.webView?.url),
              let body = message.body as? [String: Any],
              JSONSerialization.isValidJSONObject(body),
              let data = try? JSONSerialization.data(withJSONObject: body), data.count <= 16 * 1024,
              let decoded = try? JSONDecoder().decode(GemLifeBridgeMessage.self, from: data)
        else {
            NSLog("Gem Life bridge rejected an invalid message.")
            return
        }

        onMessage?(decoded)
    }
}

extension WKWebView {
    /// Sends a typed native event to the React window.
    func sendToReact(_ message: GemLifeBridgeMessage) {
        guard let data = try? JSONEncoder().encode(message),
              let json = String(data: data, encoding: .utf8)
        else { return }

        let script = "window.dispatchEvent(new CustomEvent('gem-life-native-message', { detail: \(json) }));"
        evaluateJavaScript(script)
    }
}
