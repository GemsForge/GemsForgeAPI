import SwiftUI

/// Native macOS shell for the Gem Life React application.
@main
struct GemLifeHostApp: App {
    var body: some Scene {
        WindowGroup {
            GemLifeWebView()
                .frame(minWidth: 960, minHeight: 640)
        }
    }
}
