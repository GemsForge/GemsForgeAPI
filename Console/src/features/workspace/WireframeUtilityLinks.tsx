import { Text } from "tamagui";
import { GemButton } from "../../components/ui/GemButton";

export function WireframeUtilityLinks() {
  return (
    <div className="wireframe-utility-links" role="group" aria-label="Workspace utilities">
      <GemButton variant="quiet" tone="secondary" className="wireframe-utility-link" type="button">
        <span className="wireframe-utility-link-label">
          <span aria-hidden="true">♜</span>Trash
        </span>
        <Text asChild>
          <small>3</small>
        </Text>
      </GemButton>
      <GemButton variant="quiet" tone="secondary" className="wireframe-utility-link" type="button">
        <span className="wireframe-utility-link-label">
          <span aria-hidden="true">⚙</span>Application Settings
        </span>
      </GemButton>
    </div>
  );
}
