import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class EmploymentRouteTests: XCTestCase {
    func testEmploymentCRUD() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAddresses())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(AddAddressAttachmentReference())
            app.migrations.add(CreateEmployment())
            try await app.autoMigrate()
            try await Address(
                id: "ADDR-0001",
                addressType: "Work",
                addressLine1: "1 Test Plaza",
                city: "Atlanta",
                state: "GA",
                postalCode: "30301",
                addressStatus: "Current"
            ).create(on: app.db)
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
                workAddressID: "ADDR-0001",
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
                XCTAssertEqual(record.address?.city, "Atlanta")
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
                workAddressID: "ADDR-0001",
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

            try await app.test(.PATCH, "employment/EMP-0001", beforeRequest: { request in
                try request.content.encode(["positionTitle": "Principal Engineer"])
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(EmploymentResponse.self)
                XCTAssertEqual(record.positionTitle, "Principal Engineer")
                XCTAssertEqual(record.employerName, "GemsForge")
            }

            try await app.test(.PATCH, "employment/EMP-0001", beforeRequest: { request in
                try request.content.encode(["id": "OTHER"])
            }) { response async throws in
                XCTAssertEqual(response.status, .unprocessableEntity)
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
            app.migrations.add(CreateAddresses())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(AddAddressAttachmentReference())
            app.migrations.add(CreateEmployment())
            try await app.autoMigrate()
            registerEmploymentRoutes(app)
        }) { app in
            try await app.test(.POST, "employment", beforeRequest: { request in
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"id":"EMP-INJECTED","employerName":"Example","employerType":"Company","positionTitle":"Owner","employmentType":"Full-time","employmentStatus":"Current","dateCreated":"2099-01-01"}"#)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }

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

            let invalidAddressPayload = EmploymentRequest(
                id: "EMP-BAD-ADDRESS",
                employerName: "Example",
                employerType: "Company",
                industry: nil,
                website: nil,
                positionTitle: "Owner",
                employmentType: "Full-time",
                startDate: nil,
                endDate: nil,
                employmentStatus: "Current",
                workAddressID: "ADDR-MISSING",
                employerContact: nil,
                employerContactNumber: nil,
                employerContactEmail: nil,
                notes: nil
            )
            try await app.test(.POST, "employment", beforeRequest: { request in
                try request.content.encode(invalidAddressPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .unprocessableEntity)
                let records = try await EmploymentService(database: app.db).list()
                XCTAssertTrue(records.isEmpty)
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
