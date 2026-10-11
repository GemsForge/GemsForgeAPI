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
}

export interface ForgeKeeperPatch {
  title: string;
  description: string;
  parentID: number | null;
}
