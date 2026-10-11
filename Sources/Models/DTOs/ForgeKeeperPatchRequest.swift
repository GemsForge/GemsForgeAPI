import Vapor

/// The fields that may be changed on an existing ForgeKeeper page.
struct ForgeKeeperPatchRequest: Content {
    let title: String?
    let description: String?

    // A nested optional distinguishes an omitted parentID from an explicit null.
    // Omitted means "leave the current parent unchanged"; null clears the parent.
    let parentID: Int??

    private enum CodingKeys: String, CodingKey {
        case title
        case description
        case parentID
    }

    init(
        title: String? = nil,
        description: String? = nil,
        parentID: Int?? = nil
    ) {
        self.title = title
        self.description = description
        self.parentID = parentID
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description)

        if container.contains(.parentID) {
            parentID = try container.decodeNil(forKey: .parentID)
                ? .some(nil)
                : .some(container.decode(Int.self, forKey: .parentID))
        } else {
            parentID = nil
        }
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(title, forKey: .title)
        try container.encodeIfPresent(description, forKey: .description)

        if let parentID {
            try container.encode(parentID, forKey: .parentID)
        }
    }
}
