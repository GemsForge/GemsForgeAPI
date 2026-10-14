// swift-tools-version: 6.1
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "GemsForgeAPI",
    platforms: [
        .macOS(.v14)
    ],
    dependencies: [
        .package(url: "https://github.com/vapor/vapor.git", from: "4.115.0"),
        .package(url: "https://github.com/vapor/fluent.git", from: "4.9.0"),
        .package(url: "https://github.com/vapor/fluent-sqlite-driver.git", from: "4.8.0")
    ],
    targets: [
        .executableTarget(
            name: "GemsForgeAPI",
            dependencies: [
                .product(name: "Vapor", package: "vapor"),
                .product(name: "Fluent", package: "fluent"),
                .product(name: "FluentSQLiteDriver", package: "fluent-sqlite-driver")
            ],
            path: "Sources",
            exclude: ["GemLife"]
        ),
        .executableTarget(
            name: "GemLifeHost",
            path: "GemLifeHost",
            exclude: ["README.md"]
        ),
        .executableTarget(
            name: "GemLife",
            path: "Sources/GemLife"
        ),
        .testTarget(
            name: "GemsForgeAPITests",
            dependencies: [
                "GemsForgeAPI",
                .product(name: "XCTVapor", package: "vapor"),
                .product(name: "VaporTesting", package: "vapor")
            ],
            path: "Tests/GemsForgeAPITests"
        )
    ]
)
