import { Link } from "react-router-dom";
import { usePagesQuery, usePageMutation } from "../../data/workflowQueries";
import { QueryFeedback } from "../../components/QueryFeedback";
import { ForgeKeeperView } from "../forgekeeper/ForgeKeeperView";
import { GemButton, GemCard, GemSectionHeader } from "../../components/ui";

/** Entry surface for the no-code workspace MVP. */
export function WorkspaceView({ onSuccess }: { onSuccess: (message: string) => void }) {
  const pages = usePagesQuery({ kind: "roots" }, true);
  const patchPage = usePageMutation();

  return (
    <section aria-labelledby="workspace-title">
      <GemSectionHeader
        eyebrow="Demo MVP · no-code workspace"
        title="Your data, arranged as pages"
        description="Edit pages directly, create structured tables, and connect your personal records into one private wiki."
        trailing={
          <GemButton asChild tone="secondary">
            <Link to="/schema-builder">Create table</Link>
          </GemButton>
        }
      />
      <div className="page-list" aria-label="Workspace tools">
        <Link className="page-card" to="/domains">
          <GemCard interactive className="page-card-main">
            <h3>Pages and domains</h3>
            <p>Organize your knowledge and open pages without changing code.</p>
          </GemCard>
        </Link>
        <Link className="page-card" to="/schema-builder">
          <GemCard interactive className="page-card-main">
            <h3>Create a table</h3>
            <p>Define a typed table from the app, preview it, and approve its creation.</p>
          </GemCard>
        </Link>
        <Link className="page-card" to="/forgekeeper">
          <GemCard interactive className="page-card-main">
            <h3>Browse your wiki</h3>
            <p>Open ForgeKeeper pages and move through the connected page hierarchy.</p>
          </GemCard>
        </Link>
      </div>
      <QueryFeedback query={pages} />
      {pages.data ? (
        <ForgeKeeperView
          domain={null}
          pages={pages.data}
          onLoadRoots={() => void pages.refetch()}
          onLoadChildren={() => undefined}
          onPatch={async (id, patch) => {
            await patchPage.mutateAsync({ id, patch });
            onSuccess("Page updated.");
          }}
        />
      ) : null}
    </section>
  );
}
