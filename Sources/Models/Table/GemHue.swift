import Fluent
import Vapor

/// A reusable color record in the Gem Life system.
///
/// This model maps to the existing `GemHues` table. Gem Hues are treated as
/// Foundation data by the application, but the current table does not store a
/// `DomainID` relationship. That relationship should not be invented here.
final class GemHue: Model, Content, @unchecked Sendable {
    // Matches the existing table name in GemLife_DB_rebuild.sqlite.
    static let schema = "GemHues"

    // HueID contains stable values such as HUE-0001.
    @ID(custom: "HueID")
    var id: String?

    @Field(key: "ColorName")
    var colorName: String

    @OptionalField(key: "ColorFamily")
    var colorFamily: String?

    @Field(key: "HexCode")
    var hexCode: String

    @OptionalField(key: "Mood")
    var mood: String?

    @OptionalField(key: "Palette")
    var palette: String?

    @OptionalField(key: "Description")
    var description: String?

    // The existing column is nullable text rather than a managed timestamp.
    @OptionalField(key: "CreatedDate")
    var createdDate: String?

    @OptionalField(key: "Notes")
    var notes: String?

    init() {}

    /// Creates a Gem Hue using the columns available in the existing table.
    init(
        id: String? = nil,
        colorName: String,
        colorFamily: String? = nil,
        hexCode: String,
        mood: String? = nil,
        palette: String? = nil,
        description: String? = nil,
        createdDate: String? = nil,
        notes: String? = nil
    ) {
        self.id = id
        self.colorName = colorName
        self.colorFamily = colorFamily
        self.hexCode = hexCode
        self.mood = mood
        self.palette = palette
        self.description = description
        self.createdDate = createdDate
        self.notes = notes
    }
}
