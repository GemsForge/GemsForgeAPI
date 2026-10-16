import FluentSQLiteDriver
import XCTest
import VaporTesting
@testable import GemsForgeAPI

final class EducationRouteTests: XCTestCase {
    func testEducationCRUD() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAddresses())
            app.migrations.add(AddAddressAttachmentReference())
            app.migrations.add(CreateEducation())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(AddEducationAttachmentReference())
            try await app.autoMigrate()
            try await Address(
                id: "ADDR-0001",
                addressType: "Residence",
                addressLine1: "123 Test Street",
                city: "Atlanta",
                state: "GA",
                postalCode: "30301",
                addressStatus: "Current"
            ).create(on: app.db)
            registerEducationRoutes(app)
        }) { app in
            let payload = EducationRequest(
                id: "EDU-0001",
                educationType: "College",
                institutionName: "Georgia State University",
                program: "Computer Science",
                fieldOfStudy: "Computer Science",
                credential: "Bachelor's Degree",
                credentialID: nil,
                startDate: "2020-08-01",
                endDate: "2024-05-01",
                awardedDate: "2024-05-01",
                status: "Completed",
                locationAddressID: "ADDR-0001",
                website: "https://example.edu",
                notes: "Test education record."
            )

            try await app.test(.POST, "education", beforeRequest: { request in
                try request.content.encode(payload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(EducationResponse.self)
                XCTAssertEqual(record.id, "EDU-0001")
                XCTAssertEqual(record.institutionName, "Georgia State University")
                XCTAssertEqual(record.address?.city, "Atlanta")
            }

            try await app.test(.GET, "education") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let records = try response.content.decode([EducationResponse].self)
                XCTAssertEqual(records.count, 1)
            }

            try await app.test(.GET, "education/EDU-0001") { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(EducationResponse.self)
                XCTAssertEqual(record.program, "Computer Science")
                XCTAssertEqual(record.address?.postalCode, "30301")
            }

            let updatedPayload = EducationRequest(
                id: "EDU-0001",
                educationType: "College",
                institutionName: "Georgia State University",
                program: "Information Systems",
                fieldOfStudy: "Information Systems",
                credential: "Bachelor's Degree",
                credentialID: nil,
                startDate: "2020-08-01",
                endDate: "2024-05-01",
                awardedDate: "2024-05-01",
                status: "Completed",
                locationAddressID: "ADDR-0001",
                website: "https://example.edu",
                notes: "Updated test education record."
            )

            try await app.test(.PUT, "education/EDU-0001", beforeRequest: { request in
                try request.content.encode(updatedPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(EducationResponse.self)
                XCTAssertEqual(record.program, "Information Systems")
            }

            try await app.test(.PATCH, "education/EDU-0001", beforeRequest: { request in
                try request.content.encode(["status": "Completed"])
            }) { response async throws in
                XCTAssertEqual(response.status, .ok)
                let record = try response.content.decode(EducationResponse.self)
                XCTAssertEqual(record.status, "Completed")
                XCTAssertEqual(record.institutionName, "Georgia State University")
            }

            try await app.test(.PATCH, "education/EDU-0001", beforeRequest: { request in
                try request.content.encode(["id": "OTHER"])
            }) { response async throws in
                XCTAssertEqual(response.status, .unprocessableEntity)
            }

            try await app.test(.DELETE, "education/EDU-0001") { response async throws in
                XCTAssertEqual(response.status, .noContent)
            }

            try await app.test(.GET, "education/EDU-0001") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }

    func testEducationRejectsInvalidPayloadAndMissingRecords() async throws {
        try await withApp(configure: { app in
            app.databases.use(.sqlite(.memory), as: .sqlite)
            app.migrations.add(CreateAddresses())
            app.migrations.add(AddAddressAttachmentReference())
            app.migrations.add(CreateEducation())
            app.migrations.add(CreateFileMetadata())
            app.migrations.add(AddEducationAttachmentReference())
            try await app.autoMigrate()
            registerEducationRoutes(app)
        }) { app in
            try await app.test(.POST, "education", beforeRequest: { request in
                request.headers.contentType = .json
                request.body = ByteBuffer(string: #"{"id":"EDU-INJECTED","educationType":"College","institutionName":"Example","status":"Current","dateCreated":"2099-01-01"}"#)
            }) { response in
                XCTAssertEqual(response.status, .badRequest)
            }

            let invalidPayload = EducationRequest(
                id: "EDU-0001",
                educationType: "",
                institutionName: "",
                program: nil,
                fieldOfStudy: nil,
                credential: nil,
                credentialID: nil,
                startDate: nil,
                endDate: nil,
                awardedDate: nil,
                status: "",
                locationAddressID: nil,
                website: nil,
                notes: nil
            )

            try await app.test(.POST, "education", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .badRequest)
            }

            try await app.test(.GET, "education/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.PUT, "education/MISSING", beforeRequest: { request in
                try request.content.encode(invalidPayload)
            }) { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }

            try await app.test(.DELETE, "education/MISSING") { response async throws in
                XCTAssertEqual(response.status, .notFound)
            }
        }
    }
}
