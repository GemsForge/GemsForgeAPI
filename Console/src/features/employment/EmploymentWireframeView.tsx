import type { Employment } from "../../types";
import { WireframeCollectionView } from "../workspace/WireframeCollectionView";

export function EmploymentWireframeView({ records }: { records: readonly Employment[] }) {
  return <WireframeCollectionView config={{ title: "Employment", description: "Employers, roles, dates, and professional history.", activeCollection: "Employment", records, searchValues: (record) => [record.employerName, record.positionTitle, record.industry ?? "", record.employmentStatus], cardTitle: (record) => record.employerName, cardSubtitle: (record) => record.positionTitle, cardStatus: (record) => record.employmentStatus, cardMeta: (record) => record.startDate ?? "No start date", inspector: (record) => <dl><div><dt>Employer</dt><dd>{record.employerName}</dd></div><div><dt>Position</dt><dd>{record.positionTitle}</dd></div><div><dt>Industry</dt><dd>{record.industry ?? "—"}</dd></div><div><dt>Employment type</dt><dd>{record.employmentType}</dd></div><div><dt>Status</dt><dd>{record.employmentStatus}</dd></div><div><dt>Dates</dt><dd>{record.startDate ?? "—"} → {record.endDate ?? "Present"}</dd></div><div><dt>Notes</dt><dd>{record.notes ?? "No notes yet."}</dd></div></dl> }} />;
}

