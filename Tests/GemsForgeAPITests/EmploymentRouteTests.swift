import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class EmploymentRouteTests: XCTestCase {
    func testEmploymentCRUD() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateEmployment())
            try await app.autoMigrate()
            registerEmploymentRoutes(app)
        }) { app in
            let payload = EmploymentRequest(
                id: "EMP-0001",
                employerName: "GemsForge",
                employerType: "Self-Employed",
                industry: "Technology",
                website: "https://example.com",
                positionTitle: "Founder",
                employmentType: "Self-Employed",
                startDate: "2024-10-01",
                endDate: nil,
                employmentStatus: "Current",
                workAddressID: nil,
                employerContact: nil,
                employerContactNumber: nil,
                employerContactEmail: nil,
                notes: "Test employment record."
            )

            try await app.test(.POST, "employment", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(EmploymentResponse.self)
                XCTAssertEqual(record.id, "EMP-0001")
                XCTAssertEqual(record.positionTitle, "Founder")
            }

            try await app.test(.GET, "employment") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let records = try response.content.decode([EmploymentResponse].self)
                XCTAssertEqual(records.count, 1)
            }

            try await app.test(.GET, "employment/EMP-0001") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(EmploymentResponse.self)
                XCTAssertEqual(record.employerName, "GemsForge")
            }

            let updatedPayload = EmploymentRequest(
                id: "EMP-0001",
                employerName: "GemsForge",
                employerType: "Self-Employed",
                industry: "Technology",
                website: "https://example.com",
                positionTitle: "Founder and Analyst",
                employmentType: "Self-Employed",
                startDate: "2024-10-01",
                endDate: nil,
                employmentStatus: "Current",
                workAddressID: nil,
                employerContact: nil,
                employerContactNumber: nil,
                employerContactEmail: nil,
                notes: "Updated test employment record."
            )

            try await app.test(.PUT, "employment/EMP-0001", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(EmploymentResponse.self)
                XCTAssertEqual(record.positionTitle, "Founder and Analyst")
            }

            try await app.test(.DELETE, "employment/EMP-0001") { response async throws in
                XCTAssertEqual(response.status, .noContent)
            }

            try await app.test(.GET, "employment/EMP-0001") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }

    func testEmploymentRejectsInvalidPayloadAndMissingRecords() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateEmployment())
            try await app.autoMigrate()
            registerEmploymentRoutes(app)
        }) { app in
            let invalidPayload = EmploymentRequest(
                id: "EMP-0001",
                employerName: "",
                employerType: "Organization",
                industry: nil,
                website: nil,
                positionTitle: "",
                employmentType: "Employee",
                startDate: nil,
                endDate: nil,
                employmentStatus: "",
                workAddressID: nil,
                employerContact: nil,
                employerContactNumber: nil,
                employerContactEmail: nil,
                notes: nil
            )

            try await app.test(.POST, "employment", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .badRequest)
            }

            try await app.test(.GET, "employment/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.PUT, "employment/MISSING", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.DELETE, "employment/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
