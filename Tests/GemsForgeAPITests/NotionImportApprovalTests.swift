import XCTest
@testable import GemsForgeAPI

final class NotionImportApprovalTests: XCTestCase {
    func testPreviewApprovalIsHubBoundAndSingleUse() async {
        let store = NotionImportApprovals()
        let approval = await store.issue(hubID: "hub-a", fingerprint: "snapshot")

        let wrongHub = await store.consume(token: approval.token, hubID: "hub-b")
        let correctHub = await store.consume(token: approval.token, hubID: "hub-a")
        let reused = await store.consume(token: approval.token, hubID: "hub-a")
        XCTAssertNil(wrongHub)
        XCTAssertEqual(correctHub, "snapshot")
        XCTAssertNil(reused)
    }

    func testExpiredPreviewApprovalCannotBeConsumed() async {
        let store = NotionImportApprovals()
        let now = Date(timeIntervalSince1970: 1_000)
        let approval = await store.issue(hubID: "hub-a", fingerprint: "snapshot", now: now)

        let result = await store.consume(
            token: approval.token,
            hubID: "hub-a",
            now: now.addingTimeInterval(NotionImportApprovals.lifetime + 1)
        )
        XCTAssertNil(result)
    }

    func testSnapshotFingerprintIgnoresRotatingHostedFileURLs() {
        func snapshot(fileURL: String) -> NotionImportSnapshot {
            NotionImportSnapshot(
                pages: [],
                dataSources: [],
                rowsByDataSourceID: ["source": [
                    .object([
                        "id": .string("row"),
                        "cover": .object(["type": .string("file"), "file": .object([
                            "url": .string(fileURL), "expiry_time": .string("rotating")
                        ])]),
                    ])
                ]]
            )
        }

        XCTAssertEqual(snapshot(fileURL: "https://files.example/a").fingerprint,
                       snapshot(fileURL: "https://files.example/b").fingerprint)
    }
}
