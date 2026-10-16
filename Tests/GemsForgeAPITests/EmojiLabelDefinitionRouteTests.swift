import FluentSQLiteDriver
import VaporTesting
import XCTest
@testable import GemsForgeAPI

final class EmojiLabelDefinitionRouteTests: XCTestCase {
    func testEmojiLabelDefinitionCRUDAndActiveFilter() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateEmojiLabelDefinitions())
            try await app.autoMigrate()
            registerEmojiLabelDefinitionRoutes(app)
        }) { app in
            let activePayload = EmojiLabelDefinitionRequest(
                id: nil,
                label: "Home",
                emoji: "🏠",
                description: "Housing-related presentation label.",
                isActive: true
            )
            try await app.test(.POST, "emoji-labels", beforeRequest: { request in
                try request.content.encode(activePayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let definition = try response.content.decode(EmojiLabelDefinition.self)
                XCTAssertEqual(definition.id, 1)
                XCTAssertEqual(definition.emoji, "🏠")
            }

            let duplicateID = EmojiLabelDefinitionRequest(
                id: 1, label: "Another label", emoji: "🏡", description: nil, isActive: true
            )
            try await app.test(.POST, "emoji-labels", beforeRequest: { request in
                try request.content.encode(duplicateID)
            }) { response async throws in
                XCTAssertEqual(response.status, .conflict)
                let definitions = try await EmojiLabelDefinitionService(database: app.db).list(includeInactive: true)
                XCTAssertEqual(definitions.count, 1)
            }

            let inactivePayload = EmojiLabelDefinitionRequest(
                id: 2,
                label: "Archive",
                emoji: "🗄️",
                description: nil,
                isActive: false
            )
            try await app.test(.POST, "emoji-labels", beforeRequest: { request in
                try request.content.encode(inactivePayload)
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }

            try await app.test(.GET, "emoji-labels") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let definitions = try response.content.decode([EmojiLabelDefinition].self)
                XCTAssertEqual(definitions.map(\.label), ["Home"])
            }

            try await app.test(.GET, "emoji-labels?includeInactive=true") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let definitions = try response.content.decode([EmojiLabelDefinition].self)
                XCTAssertEqual(definitions.map(\.label), ["Archive", "Home"])
            }

            let updatedPayload = EmojiLabelDefinitionRequest(
                id: 1,
                label: "Living",
                emoji: "🛋️",
                description: "Updated presentation label.",
                isActive: true
            )
            try await app.test(.PUT, "emoji-labels/1", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let definition = try response.content.decode(EmojiLabelDefinition.self)
                XCTAssertEqual(definition.label, "Living")
                XCTAssertEqual(definition.emoji, "🛋️")
            }

            try await app.test(.DELETE, "emoji-labels/1") { response in
                XCTAssertEqual(response.status, .noContent)
            }
        }
    }

    func testEmojiLabelDefinitionRejectsInvalidAndDuplicateLabels() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateEmojiLabelDefinitions())
            try await app.autoMigrate()
            registerEmojiLabelDefinitionRoutes(app)
        }) { app in
            let emptyLabel = EmojiLabelDefinitionRequest(
                id: nil,
                label: "   ",
                emoji: "✨",
                description: nil,
                isActive: true
            )
            try await app.test(.POST, "emoji-labels", beforeRequest: { request in
                try request.content.encode(emptyLabel)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }

            let emptyEmoji = EmojiLabelDefinitionRequest(
                id: nil,
                label: "Sparkle",
                emoji: " ",
                description: nil,
                isActive: true
            )
            try await app.test(.POST, "emoji-labels", beforeRequest: { request in
                try request.content.encode(emptyEmoji)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }

            let payload = EmojiLabelDefinitionRequest(
                id: 3,
                label: "Finance",
                emoji: "💰",
                description: nil,
                isActive: true
            )
            try await app.test(.POST, "emoji-labels", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response in
                XCTAssertEqual(response.status, .ok)
            }

            let duplicate = EmojiLabelDefinitionRequest(
                id: nil,
                label: "finance",
                emoji: "📈",
                description: nil,
                isActive: true
            )
            try await app.test(.POST, "emoji-labels", beforeRequest: { request in
                try request.content.encode(duplicate)
            }) { response in
                XCTAssertEqual(response.status, .conflict)
            }

            try await app.test(.GET, "emoji-labels/999") { response in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
