import { NavLink } from "react-router-dom";
import { Settings2, Trash2 } from "lucide-react";
import { GemButton } from "@gemsforge/ui";

export function WireframeUtilityLinks() {
  return (
    <div className="wireframe-utility-links" role="group" aria-label="Workspace utilities">
      <GemButton asChild variant="quiet" tone="secondary" className="wireframe-utility-link">
        <NavLink to="/trash-wireframe" title="Trash" aria-label="Trash">
          <span className="wireframe-utility-link-label">
            <Trash2 size={16} aria-hidden="true" />
            <span className="wireframe-navigation-label">Trash</span>
          </span>
        </NavLink>
      </GemButton>
      <GemButton asChild variant="quiet" tone="secondary" className="wireframe-utility-link">
        <NavLink to="/application-settings-wireframe" title="Application Settings" aria-label="Application Settings">
          <span className="wireframe-utility-link-label">
            <Settings2 size={16} aria-hidden="true" />
            <span className="wireframe-navigation-label">Application Settings</span>
          </span>
        </NavLink>
      </GemButton>
    </div>
  );
}
