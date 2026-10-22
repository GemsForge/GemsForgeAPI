import type { FileMetadata } from "../../types";
import { AttachmentControl } from "../../components/AttachmentControl";
import { EditableRecordFields, type EditableRecordField } from "../../components/EditableRecordFields";

interface RecordDetailProps {
  /** Human-readable resource name used for headings and attachment ownership. */
  recordType: string;
  /** Record-specific heading shown above the editable fields. */
  title: string;
  recordId: string;
  status: string;
  fields: EditableRecordField[];
  fileMetadataID?: string | null;
  onAttachment: (metadata: FileMetadata | null) => Promise<void>;
}

/** Shared editable detail form used by record-type views inside their detail modal. */
export function RecordDetail({
  recordType,
  title,
  recordId,
  status,
  fields,
  fileMetadataID,
  onAttachment,
}: RecordDetailProps) {
  return (
    <article className={`${recordType.toLowerCase()}-detail`}>
      <div className="detail-heading">
        <div>
          <p className="eyebrow">{recordType} record</p>
          <h3>{title}</h3>
          <p className={`${recordType.toLowerCase()}-code`}>{recordId}</p>
        </div>
        <span className="status-pill">{status}</span>
      </div>
      <EditableRecordFields className={`${recordType.toLowerCase()}-fields`} fields={fields} />
      <AttachmentControl
        fileMetadataID={fileMetadataID}
        ownerType={recordType}
        ownerID={recordId}
        label={`${recordType} image`}
        onAttach={onAttachment}
      />
    </article>
  );
}
