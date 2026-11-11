import type { LucideIcon } from "lucide-react";
import type { RecordNumberFormat, RecordPropertyKind } from "../../table-kit/recordContracts";
import {
  Asterisk,
  ArrowUpRight,
  Badge,
  Bell,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CalendarClock,
  CheckSquare,
  CircleCheck,
  CircleDot,
  Clock3,
  CreditCard,
  DollarSign,
  File,
  FileText,
  Fingerprint,
  Folder,
  Globe2,
  GraduationCap,
  Hash,
  Heart,
  House,
  Image,
  Landmark,
  Link,
  Link2,
  List,
  ListChecks,
  ListFilter,
  Lock,
  LockKeyhole,
  Mail,
  MapPin,
  Palette,
  Paperclip,
  Percent,
  Phone,
  Settings2,
  Search,
  ShieldCheck,
  Star,
  Tag,
  Tags,
  ToggleLeft,
  Type,
  Upload,
  User,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";

export type PropertyIconDefinition = {
  name: string;
  icon: LucideIcon;
  keywords: readonly string[];
};

/** Shared icon catalog for schema-driven record properties. */
export const PROPERTY_ICON_LIBRARY = [
  { name: "Name", icon: Asterisk, keywords: ["name", "title", "institution"] },
  { name: "ID", icon: Badge, keywords: ["id", "identifier"] },
  { name: "Lock", icon: Lock, keywords: ["lock", "locked", "read only"] },
  { name: "Lock Keyhole", icon: LockKeyhole, keywords: ["lock", "key", "protected"] },
  { name: "Fingerprint", icon: Fingerprint, keywords: ["fingerprint", "identity", "secure"] },
  { name: "Text", icon: Type, keywords: ["text", "description"] },
  { name: "Select", icon: ListFilter, keywords: ["select", "type", "due", "occurrence", "filter", "dropdown"] },
  { name: "Multi-select", icon: Tag, keywords: ["multi", "tag"] },
  { name: "Status", icon: CircleDot, keywords: ["status"] },
  { name: "Number", icon: Hash, keywords: ["number", "quantity", "count", "decimal"] },
  { name: "Date", icon: CalendarDays, keywords: ["date", "time"] },
  { name: "URL", icon: Link, keywords: ["url", "website", "web"] },
  { name: "Notes", icon: FileText, keywords: ["note"] },
  { name: "Address", icon: House, keywords: ["address", "location"] },
  { name: "Checkbox", icon: CheckSquare, keywords: ["checkbox", "boolean"] },
  { name: "User", icon: User, keywords: ["person", "user", "owner"] },
  { name: "Users", icon: Users, keywords: ["people", "team", "group"] },
  { name: "Email", icon: Mail, keywords: ["email", "mail"] },
  { name: "Phone", icon: Phone, keywords: ["phone", "telephone", "mobile"] },
  { name: "Location", icon: MapPin, keywords: ["map", "place", "location"] },
  { name: "Building", icon: Building2, keywords: ["building", "company", "office"] },
  { name: "Work", icon: BriefcaseBusiness, keywords: ["work", "job", "employment"] },
  { name: "Education", icon: GraduationCap, keywords: ["education", "school", "degree"] },
  { name: "Folder", icon: Folder, keywords: ["folder", "collection", "category"] },
  { name: "File", icon: File, keywords: ["file", "document"] },
  { name: "Image", icon: Image, keywords: ["image", "photo", "picture"] },
  { name: "Palette", icon: Palette, keywords: ["palette", "color", "colour", "theme", "art"] },
  { name: "Attachment", icon: Paperclip, keywords: ["attachment", "file", "paperclip"] },
  { name: "Globe", icon: Globe2, keywords: ["globe", "world", "website"] },
  { name: "List", icon: List, keywords: ["list", "items"] },
  { name: "Checklist", icon: ListChecks, keywords: ["checklist", "tasks", "todo"] },
  { name: "Tags", icon: Tags, keywords: ["tags", "labels"] },
  { name: "Toggle", icon: ToggleLeft, keywords: ["toggle", "switch"] },
  { name: "Percent", icon: Percent, keywords: ["percent", "percentage", "rate", "apr"] },
  { name: "Currency", icon: DollarSign, keywords: ["currency", "money", "finance", "amount", "price"] },
  { name: "Wallet", icon: WalletCards, keywords: ["wallet", "payment", "account"] },
  { name: "Credit Card", icon: CreditCard, keywords: ["credit", "card", "payment"] },
  { name: "Bank", icon: Landmark, keywords: ["bank", "financial"] },
  { name: "Clock", icon: Clock3, keywords: ["clock", "time", "duration"] },
  { name: "Calendar", icon: CalendarClock, keywords: ["calendar", "schedule", "appointment"] },
  { name: "Complete", icon: CircleCheck, keywords: ["complete", "done", "success"] },
  { name: "Alert", icon: BellRing, keywords: ["alert", "warning", "attention"] },
  { name: "Notification", icon: Bell, keywords: ["notification", "reminder"] },
  { name: "Security", icon: ShieldCheck, keywords: ["security", "safe", "protected"] },
  { name: "Favorite", icon: Star, keywords: ["favorite", "star", "important"] },
  { name: "Heart", icon: Heart, keywords: ["heart", "like"] },
  { name: "Link", icon: Link2, keywords: ["link", "relation", "reference"] },
  { name: "Relation", icon: ArrowUpRight, keywords: ["relation", "linked record", "arrow"] },
  { name: "Lookup", icon: Search, keywords: ["lookup", "search", "magnify", "magnifier"] },
  { name: "Upload", icon: Upload, keywords: ["upload", "import"] },
  { name: "Settings", icon: Settings2, keywords: ["settings", "configuration"] },
  { name: "Action", icon: Zap, keywords: ["action", "automation", "power"] },
] as const satisfies readonly PropertyIconDefinition[];

export const PROPERTY_ICON_OPTIONS = PROPERTY_ICON_LIBRARY.map(({ name }) => name);

// TODO: Add custom icon uploads and user-defined icon collections.

/** Infer the property type from its semantic field metadata, with label fallbacks. */
export function inferWireframePropertyType(
  label: string,
  kind?: RecordPropertyKind | string,
  numberFormat?: RecordNumberFormat,
): string {
  const normalized = label.trim().toLowerCase();
  if (kind === "select") return "Select";
  if (kind === "status") return "Status";
  if (kind === "checkbox") return "Checkbox";
  if (kind === "date") return "Date";
  if (kind === "url") return "URL";
  if (kind === "image") return "Image";
  if (kind === "media") return "Media";
  if (kind === "relation") return "Relation";
  if (kind === "lookup") return "Lookup";

  if (numberFormat === "currency") return "Currency";
  if (numberFormat === "percent") return "Percent";
  if (numberFormat === "decimal") return "Number";
  if (kind === "number") {
    if (/\b(amount|price)\b/.test(normalized)) return "Currency";
    if (/\b(rate|apr)\b/.test(normalized)) return "Percent";
    return "Number";
  }

  if (/\b(due|occurrence|type)\b/.test(normalized)) return "Select";
  if (/\b(url|website)\b/.test(normalized)) return "URL";
  if (/\bstatus\b/.test(normalized)) return "Status";
  if (/\b(date|time)\b/.test(normalized)) return "Date";
  if (/\b(amount|price)\b/.test(normalized)) return "Currency";
  if (/\b(rate|apr|percent|percentage)\b/.test(normalized)) return "Percent";
  if (/\b(number|quantity|count)\b/.test(normalized)) return "Number";
  if (/\b(name|title)\b/.test(normalized)) return "Name";
  if (/\b(multi[-\s]?select|tags?)\b/.test(normalized)) return "Multi-select";
  if (/\b(notes?|description)\b/.test(normalized)) return "Notes";
  return "Text";
}

export function getPropertyIconDefinition(label: string, kind?: string, propertyType?: string): PropertyIconDefinition {
  const exactType =
    propertyType && PROPERTY_ICON_LIBRARY.find((icon) => icon.name.toLowerCase() === propertyType.toLowerCase());
  if (exactType) return exactType;
  const inferredType = inferWireframePropertyType(label, kind);
  const inferredIcon = PROPERTY_ICON_LIBRARY.find((icon) => icon.name === inferredType);
  if (inferredIcon && inferredType !== "Text") return inferredIcon;
  const normalized = `${kind ?? ""} ${label}`.toLowerCase();
  return (
    PROPERTY_ICON_LIBRARY.find((icon) => icon.keywords.some((keyword) => normalized.includes(keyword))) ??
    PROPERTY_ICON_LIBRARY.find((icon) => icon.name === "Text")!
  );
}

export function getPropertyIconByName(name: string): PropertyIconDefinition {
  return PROPERTY_ICON_LIBRARY.find((definition) => definition.name === name) ?? getPropertyIconDefinition("Text");
}
