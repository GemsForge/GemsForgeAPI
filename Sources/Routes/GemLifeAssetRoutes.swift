import Foundation
import Vapor

/// Serves only the generated, packaged UI. API routes remain at the root.
func registerGemLifeAssetRoutes(
    _ app: Application,
    directory: String? = Environment.get("GEM_LIFE_ASSETS_DIRECTORY"),
    supabaseURL: String? = Environment.get("SUPABASE_URL")
) {
    let supabaseOrigin = supabaseURL.flatMap { rawValue -> String? in
        guard let url = URL(string: rawValue),
            url.host != nil,
            url.scheme == "https"
                || ((url.host == "localhost" || url.host == "127.0.0.1") && url.scheme == "http")
        else { return nil }
        guard let scheme = url.scheme, let host = url.host else { return nil }
        let port = url.port.map { ":\($0)" } ?? ""
        return "\(scheme)://\(host)\(port)"
    }
    let root = directory.map { URL(fileURLWithPath: $0, isDirectory: true).resolvingSymlinksInPath().standardizedFileURL }
    let handler: @Sendable (Request) async throws -> Response = { request in
        guard let root, FileManager.default.fileExists(atPath: root.appendingPathComponent("index.html").path) else {
            return Response(status: .serviceUnavailable, headers: ["Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store"], body: .init(string: "Gem Life assets are unavailable. Run node Scripts/build-gem-life.mjs, then restart the production launcher."))
        }
        let parts = request.parameters.getCatchall();
        guard !parts.contains(where: { $0 == ".." || $0 == "." || $0.contains("\\") || $0.contains("\0") }) else { throw Abort(.notFound) }
        let relative = parts.joined(separator: "/")
        let requested = root.appendingPathComponent(relative).resolvingSymlinksInPath().standardizedFileURL
        guard requested.path == root.path || requested.path.hasPrefix(root.path + "/") else { throw Abort(.notFound) }
        let isAsset = relative.hasPrefix("assets/")
        let file: URL
        if isAsset {
            file = requested
        } else if relative.isEmpty || relative == "index.html" || request.headers.first(name: .accept)?.contains("text/html") == true {
            file = root.appendingPathComponent("index.html")
        } else { throw Abort(.notFound) }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: file.path, isDirectory: &isDirectory), !isDirectory.boolValue else { throw Abort(.notFound) }
        let response = try await request.fileio.asyncStreamFile(at: file.path)
        response.headers.replaceOrAdd(name: .cacheControl, value: isAsset ? "public, max-age=31536000, immutable" : "no-cache")
        response.headers.replaceOrAdd(name: "X-Content-Type-Options", value: "nosniff")
        let connectSource = supabaseOrigin.map { " " + $0 } ?? ""
        response.headers.replaceOrAdd(name: "Content-Security-Policy", value: "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'\(connectSource); font-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
        return response
    }
    app.get("app", use: handler)
    app.get("app", .catchall, use: handler)
}
