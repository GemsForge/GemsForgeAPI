import type { LucideIcon } from "lucide-react";
import { Asterisk, Badge, Bell, BellRing, BriefcaseBusiness, Building2, CalendarDays, CalendarClock, CheckSquare, CircleCheck, CircleDollarSign, CircleDot, Clock3, CreditCard, DollarSign, File, FileText, Fingerprint, Folder, Globe2, GraduationCap, Heart, House, Image, Landmark, Link, Link2, List, ListChecks, ListFilter, Lock, LockKeyhole, Mail, MapPin, Paperclip, Percent, Phone, Settings2, ShieldCheck, Star, Tag, Tags, ToggleLeft, Type, Upload, User, Users, WalletCards, Zap } from "lucide-react";

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
  { name: "Select", icon: ListFilter, keywords: ["select", "type"] },
  { name: "Multi-select", icon: Tag, keywords: ["multi", "tag"] },
  { name: "Status", icon: CircleDot, keywords: ["status"] },
  { name: "Number", icon: DollarSign, keywords: ["number", "amount", "price", "quantity"] },
  { name: "Date", icon: CalendarDays, keywords: ["date", "time"] },
  { name: "URL", icon: Link, keywords: ["url", "website"] },
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
  { name: "Attachment", icon: Paperclip, keywords: ["attachment", "file", "paperclip"] },
  { name: "Globe", icon: Globe2, keywords: ["globe", "world", "website"] },
  { name: "List", icon: List, keywords: ["list", "items"] },
  { name: "Checklist", icon: ListChecks, keywords: ["checklist", "tasks", "todo"] },
  { name: "Tags", icon: Tags, keywords: ["tags", "labels"] },
  { name: "Toggle", icon: ToggleLeft, keywords: ["toggle", "switch"] },
  { name: "Percent", icon: Percent, keywords: ["percent", "percentage", "rate"] },
  { name: "Currency", icon: CircleDollarSign, keywords: ["currency", "money", "finance"] },
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
  { name: "Upload", icon: Upload, keywords: ["upload", "import"] },
  { name: "Settings", icon: Settings2, keywords: ["settings", "configuration"] },
  { name: "Action", icon: Zap, keywords: ["action", "automation", "power"] },
] as const satisfies readonly PropertyIconDefinition[];

export const PROPERTY_ICON_OPTIONS = PROPERTY_ICON_LIBRARY.map(({ name }) => name);

// TODO: Add custom icon uploads and user-defined icon collections.

export function getPropertyIconDefinition(label: string, kind?: string): PropertyIconDefinition {
  const normalized = `${kind ?? ""} ${label}`.toLowerCase();
  return (
    PROPERTY_ICON_LIBRARY.find((icon) => icon.keywords.some((keyword) => normalized.includes(keyword))) ??
    PROPERTY_ICON_LIBRARY.find((icon) => icon.name === "Text")!
  );
}

export function getPropertyIconByName(name: string): PropertyIconDefinition {
  return PROPERTY_ICON_LIBRARY.find((definition) => definition.name === name) ?? getPropertyIconDefinition("Text");
}
