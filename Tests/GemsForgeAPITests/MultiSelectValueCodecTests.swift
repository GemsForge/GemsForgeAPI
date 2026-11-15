import Foundation
import XCTest

@testable import GemsForgeAPI

final class MultiSelectValueCodecTests: XCTestCase {
    private struct Vector: Decodable {
        let input: String
        let decoded: [String]
        let encoded: String
    }

    func testSharedCodecVectors() throws {
        let fixture = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("Console/src/table-kit/multiSelectCodecVectors.json")
        let vectors = try JSONDecoder().decode([Vector].self, from: Data(contentsOf: fixture))
        for vector in vectors {
            XCTAssertEqual(MultiSelectValueCodec.decode(vector.input), vector.decoded)
            XCTAssertEqual(MultiSelectValueCodec.encode(vector.decoded), vector.encoded)
        }
    }

    func testMatcherUsesWholeTagsAndCanonicalUnicode() {
        XCTAssertTrue(MultiSelectValueCodec.matchesOption(value: "🏡 Home;💳 Credit", option: "🏡 Home"))
        XCTAssertFalse(MultiSelectValueCodec.matchesOption(value: "🏡 Homework", option: "🏡 Home"))
        XCTAssertTrue(MultiSelectValueCodec.matchesOption(value: "Cafe\u{301}", option: "Café"))
    }
}
