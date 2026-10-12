export interface Domain {
  id: string;
  title: string;
  description: string;
}

export interface Address {
  id: string;
  addressType: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  startDate: string | null;
  endDate: string | null;
  addressStatus: string;
  notes?: string | null;
  imageFileMetadataID?: string | null;
}

export interface ForgeKeeperPage {
  id: number;
  parentID: number | null;
  domainID: string;
  title: string;
  description: string;
}

export interface GemHue {
  id: string;
  colorName: string;
  colorFamily: string | null;
  hexCode: string;
  mood: string | null;
  palette: string | null;
  description: string | null;
  createdDate: string | null;
  notes: string | null;
}

export interface Education {
  id: string;
  educationType: string;
  institutionName: string;
  program: string | null;
  fieldOfStudy: string | null;
  credential: string | null;
  credentialID: string | null;
  startDate: string | null;
  endDate: string | null;
  awardedDate: string | null;
  status: string;
  address: Address | null;
  website: string | null;
  notes: string | null;
}

export interface Employment {
  id: string;
  employerName: string;
  employerType: string;
  industry: string | null;
  website: string | null;
  positionTitle: string;
  employmentType: string;
  startDate: string | null;
  endDate: string | null;
  employmentStatus: string;
  address: Address | null;
  employerContact: string | null;
  employerContactNumber: string | null;
  employerContactEmail: string | null;
  notes: string | null;
}

export interface ExpenseTransaction {
  id: string;
  receiptID: string | null;
  item: string;
  firstReceiptItem: boolean;
  categoryID: number;
  subcategoryID: number | null;
  merchantCode: string | null;
  transactionDate: string | null;
  quantity: number;
  regularPrice: number | null;
  paidPrice: number | null;
  total: number | null;
  discount: number | null;
  notes: string | null;
  image?: string | null;
}

export interface FileMetadata {
  id: string;
  relativePath: string;
  fileName: string | null;
  fileKind: string;
  mimeType: string;
  byteSize: number | null;
  ownerType: string | null;
  ownerID: string | null;
}

export interface ForgeKeeperPatch {
  title: string;
  description: string;
  parentID: number | null;
}

export interface LocalDatabaseProfile {
  id: string;
  name: string;
  migrations: string[];
}

export interface LocalDatabaseCapabilities {
  enabled: boolean;
  ready: boolean;
  profiles: LocalDatabaseProfile[];
  safetyRules: string[];
}

export interface LocalDatabaseCreationResult {
  databaseName: string;
  profile: string;
  migrationCount: number;
  status: string;
}

export interface LiveSchemaColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue: string | null;
}

export interface LiveSchemaForeignKey {
  column: string;
  referencedTable: string;
  referencedColumn: string;
  onUpdate: string;
  onDelete: string;
}

export interface LiveSchemaIndex {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface LiveSchemaTable {
  name: string;
  columns: LiveSchemaColumn[];
  foreignKeys: LiveSchemaForeignKey[];
  indexes: LiveSchemaIndex[];
}

export interface LiveSchema {
  databaseName: string;
  tableCount: number;
  tables: LiveSchemaTable[];
}

export interface TableBuilderColumn {
  name: string;
  dataType: "ANY" | "BLOB" | "INTEGER" | "NUMERIC" | "REAL" | "TEXT";
  nullable: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
  unique: boolean;
}

export interface TableBuilderRequest {
  tableName: string;
  columns: TableBuilderColumn[];
}

export interface UserTablePreview {
  definition: TableBuilderRequest;
  warnings: string[];
  confirmationToken: string;
  expiresAt: string;
  status: string;
}

export interface UserTableCreationResult {
  table: string;
  backupFileName: string;
  backupSizeBytes: number;
  status: string;
}

export interface HomeInventoryCSVRowPreview {
  rowNumber: number;
  values: Record<string, string>;
  errors: string[];
}

export interface HomeInventoryCSVPreview {
  headers: string[];
  validRows: HomeInventoryCSVRowPreview[];
  invalidRows: HomeInventoryCSVRowPreview[];
  readyToImport: boolean;
  warnings: string[];
}

export interface HomeInventoryCSVImportResult {
  importedCount: number;
  identifiers: string[];
  status: string;
}
