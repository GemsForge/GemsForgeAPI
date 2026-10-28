import type { GemPrimitiveType } from "../../components/ui/primitiveFieldContracts";
import type { RecordSelectOption } from "../../table-kit/recordContracts";
import type { GemHueCreate } from "../../types";

const options = (values: string[]): RecordSelectOption[] => values.map((value) => ({ value, label: value }));

export interface GemHueFieldDefinition {
  name: keyof GemHueCreate;
  label: string;
  required?: boolean;
  multiline?: boolean;
  primitive?: GemPrimitiveType;
  options?: readonly RecordSelectOption[];
}

/** One property contract for the Gem Hue add form and inline record editor. */
export const gemHueFieldDefinitions: readonly GemHueFieldDefinition[] = [
  { name: "id", label: "ID", required: true, primitive: "id" },
  { name: "colorName", label: "Color name", required: true, primitive: "text" },
  { name: "colorFamily", label: "Color family", primitive: "select", options: options(["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink", "Brown", "Gray", "Black", "White"]) },
  { name: "hexCode", label: "Hex code", required: true, primitive: "text" },
  { name: "mood", label: "Mood", primitive: "select", options: options(["Calm", "Warm", "Cool", "Energizing", "Grounding", "Romantic", "Playful", "Focused"]) },
  { name: "palette", label: "Palette", primitive: "select", options: options(["Monochromatic", "Analogous", "Complementary", "Triadic", "Neutral", "Pastel", "Earth tones"]) },
  { name: "description", label: "Description", multiline: true },
  { name: "createdDate", label: "Created date", primitive: "date" },
  { name: "notes", label: "Notes", multiline: true },
];
