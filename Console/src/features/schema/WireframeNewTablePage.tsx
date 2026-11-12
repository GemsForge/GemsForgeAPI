import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  usePreviewTableMutation,
  useCreateTableMutation,
  useCreateSchemaPageMutation,
} from "../../data/workflowQueries";
import { WireframePageView } from "../workspace/WireframePageView";

const TABLE_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;

export function WireframeNewTablePage() {
  const navigate = useNavigate();
  const [tableName, setTableName] = useState("NewCollection");
  const [phase, setPhase] = useState<"idle" | "busy" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const previewTable = usePreviewTableMutation();
  const createTable = useCreateTableMutation();
  const createPage = useCreateSchemaPageMutation();

  const isValid = TABLE_NAME_RE.test(tableName.trim());

  async function handleCreate() {
    if (!isValid || phase === "busy") return;
    setPhase("busy");
    setErrorMessage(null);
    try {
      const preview = await previewTable.mutateAsync({ tableName: tableName.trim(), columns: [] });
      await createTable.mutateAsync(preview.confirmationToken);
      await createPage.mutateAsync(tableName.trim());
      void navigate(`/schema/${encodeURIComponent(tableName.trim())}`);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : "Table could not be created.");
    }
  }

  return (
    <WireframePageView
      title={tableName}
      description="Name your collection using UpperCamelCase, then create it."
      recordCount={0}
      showCount={false}
      onTitleChange={(value) => {
        setTableName(value);
        setPhase("idle");
        setErrorMessage(null);
      }}
    >
      <div className="wireframe-new-table-empty">
        {!isValid && tableName !== "NewCollection" ? (
          <p className="wireframe-new-table-hint error">
            Collection name must start with an uppercase letter and contain only letters and numbers — for example,{" "}
            <em>HomeInventory</em>.
          </p>
        ) : null}
        {phase === "error" && errorMessage ? (
          <p className="wireframe-new-table-hint error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <button
          className="wireframe-design-button wireframe-new-table-create"
          type="button"
          disabled={!isValid || phase === "busy"}
          onClick={() => void handleCreate()}
        >
          {phase === "busy" ? "Creating…" : "Create collection"}
        </button>
        <p className="wireframe-new-table-hint">
          Click the title above to rename it, then create the collection.
        </p>
      </div>
    </WireframePageView>
  );
}
