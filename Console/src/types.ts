export interface Domain {
  id: string;
  title: string;
  description: string;
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
  locationAddressID: string | null;
  website: string | null;
  notes: string | null;
}

export interface ForgeKeeperPatch {
  title: string;
  description: string;
  parentID: number | null;
}
