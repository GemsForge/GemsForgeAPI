import { useEffect, useMemo, useState } from "react";
import { QueryFeedback } from "../../components/QueryFeedback";
import { AttachmentControl } from "../../components/AttachmentControl";
import { GemEmptyState } from "../../components/ui";
import { useServiceAccountPatchMutation, useServiceAccountQuery } from "../../data/recordQueries";
import type { ServiceAccount } from "../../types";
import { EditableRecordFields } from "../../components/EditableRecordFields";
import { serviceAccountEditableFields } from "./serviceAccountRecordFields";
import { RecordImport } from "../../components/RecordImport";
import { useServiceLogosQuery } from "../../data/lifeQueries";
import { useRecordUtilities } from "../../hooks/useRecordUtilities";
import { api } from "../../api";
import { DatabaseRecordCollection } from "../../components/DatabaseRecordCollection";
import { createServiceAccountTableAdapter } from "../database/recordTableAdapters";
import { useServiceAccountRecordActions } from "./useServiceAccountRecordActions";

/** Render service-account records through the shared Table Kit consumer adapter. */
export function ServiceAccountsView({ records }: { records: ServiceAccount[] }) {
  const utilities = useRecordUtilities(
    records,
    (record) => [record.id, record.service, record.type, record.status, record.expenseGroup],
    {
      service: (a, b) => a.service.localeCompare(b.service),
      amount: (a, b) => (a.monthlyAmount ?? 0) - (b.monthlyAmount ?? 0),
      type: (a, b) => (a.type ?? "").localeCompare(b.type ?? ""),
      group: (a, b) => (a.expenseGroup ?? "").localeCompare(b.expenseGroup ?? ""),
      status: (a, b) => (a.status ?? "").localeCompare(b.status ?? ""),
      due: (a, b) => (a.due ?? "").localeCompare(b.due ?? ""),
      occurrence: (a, b) => (a.occurrence ?? "").localeCompare(b.occurrence ?? ""),
    },
  );
  const [selectedID, setSelectedID] = useState<number | null>(null);
  const detail = useServiceAccountQuery(selectedID);
  const patch = useServiceAccountPatchMutation();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const { publish, importConfig, actions, createForm } = useServiceAccountRecordActions({
    onCreated: setSelectedID,
  });
  const logos = useServiceLogosQuery(true);
  const [logoImageURLs, setLogoImageURLs] = useState<Record<number, string>>({});
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const objectURLs: string[] = [];
    void Promise.all(
      (logos.data ?? []).map(async (logo) => {
        try {
          const blob = await api.getServiceLogoImage(logo.id, controller.signal);
          const url = URL.createObjectURL(blob);
          objectURLs.push(url);
          return [logo.id, url] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (!active) {
        objectURLs.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setLogoImageURLs(
        Object.fromEntries(entries.filter((entry): entry is readonly [number, string] => entry !== null)),
      );
    });
    return () => {
      active = false;
      controller.abort();
      objectURLs.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [logos.data]);
  const tableAdapter = useMemo(
    () =>
      createServiceAccountTableAdapter(
        (record) => {
          const logo = logos.data?.find((item) => item.logoKey === record.logoKey);
          return logo && logoImageURLs[logo.id] ? (
            <img className="service-account-card-logo" src={logoImageURLs[logo.id]} alt={`${record.service} logo`} />
          ) : (
            "—"
          );
        },
        (record) => {
          const logo = logos.data?.find((item) => item.logoKey === record.logoKey);
          return logo
            ? { src: logoImageURLs[logo.id] ?? "", alt: `${record.service} logo`, fit: "contain" }
            : undefined;
        },
      ),
    [logoImageURLs, logos.data],
  );
  return (
    <>
      <div className="content-heading">
        <div>
          <p className="eyebrow">Life-area records</p>
          <h2>Services</h2>
          <p className="muted">Recurring service accounts and their payment metadata.</p>
        </div>
        <div className="button-row">
          <span className="record-count">{records.length} records</span>
          {records.length === 0 && (
            <button type="button" onClick={() => setCreating(true)}>
              Add service
            </button>
          )}
        </div>
        <RecordImport
          {...importConfig}
          open={importing}
          onOpenChange={setImporting}
          showTrigger={records.length === 0}
          onPublish={publish}
        />
      </div>
      {creating && createForm(() => setCreating(false))}
      {records.length === 0 ? (
        <GemEmptyState
          icon="◎"
          title="No service accounts"
          description="The Services table did not return any records."
        />
      ) : (
        <div className="address-layout">
          <DatabaseRecordCollection
            label="Services"
            records={records}
            utilities={utilities}
            adapter={tableAdapter}
            sortOptions={[
              { value: "service", label: "Service" },
              { value: "amount", label: "Monthly amount" },
              { value: "type", label: "Type" },
              { value: "group", label: "Expense group" },
              { value: "status", label: "Status" },
              { value: "due", label: "Due date" },
              { value: "occurrence", label: "Occurrence" },
            ]}
            filterOptions={Array.from(
              new Set(records.map((record) => record.status).filter((value): value is string => Boolean(value))),
            ).sort()}
            detailId={selectedID == null ? null : String(selectedID)}
            onDetailChange={(id) => setSelectedID(id == null ? null : Number(id))}
            actions={actions}
            onRecordPatch={async (record, field, value) => {
              await patch.mutateAsync({ id: record.id, patch: { [field]: value } as Partial<ServiceAccount> });
            }}
            detail={
              selectedID == null ? null : (
                <>
                  <QueryFeedback query={detail} />
                  {detail.data && (
                    <ServiceAccountDetail
                      key={detail.data.id}
                      record={detail.data}
                      onAttachment={async (metadata) => {
                        await patch.mutateAsync({
                          id: detail.data!.id,
                          patch: { logoFileMetadataID: metadata?.id ?? null },
                        });
                      }}
                      onPatch={async (values) => {
                        await patch.mutateAsync({ id: detail.data!.id, patch: values });
                      }}
                    />
                  )}
                </>
              )
            }
          />
        </div>
      )}
    </>
  );
}

function ServiceAccountDetail({
  record,
  onAttachment,
  onPatch,
}: {
  record: ServiceAccount;
  onAttachment: (metadata: import("../../types").FileMetadata | null) => Promise<void>;
  onPatch: (values: Partial<ServiceAccount>) => Promise<void>;
}) {
  const logos = useServiceLogosQuery(true);
  const legacyLogo = logos.data?.find((logo) => logo.logoKey === record.logoKey);
  return (
    <article className="address-detail">
      <EditableRecordFields className="address-fields" fields={serviceAccountEditableFields(record, onPatch)} />
      <AttachmentControl
        fileMetadataID={record.logoFileMetadataID ?? legacyLogo?.fileMetadataID}
        ownerType="ServiceAccount"
        ownerID={String(record.id)}
        label="Service logo"
        onAttach={onAttachment}
        className="service-logo-attachment"
      />
    </article>
  );
}
