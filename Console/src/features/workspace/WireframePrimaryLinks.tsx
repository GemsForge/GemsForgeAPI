import { NavLink } from "react-router-dom";
import { Boxes, House, Network, ShieldCheck } from "lucide-react";
import { GemButton } from "@gemsforge/ui";

const primaryNavigation = [
  { label: "Home", icon: House, to: "/home-wireframe" },
  { label: "Workspace", icon: Boxes, to: "/workspace" },
  { label: "Domains", icon: Network, to: "/domains" },
  { label: "ForgeKeeper", icon: ShieldCheck, to: "/forgekeeper" },
] as const;

export function WireframePrimaryLinks({ search }: { search: string }) {
  const normalizedSearch = search.trim().toLowerCase();
  const visibleLinks = primaryNavigation.filter((item) => item.label.toLowerCase().includes(normalizedSearch));

  return (
    <nav aria-label="Primary navigation" className="demo-nav">
      {visibleLinks.map((item) => (
        <GemButton asChild variant="quiet" tone="secondary" className="wireframe-primary-link" key={item.label}>
          <NavLink to={item.to} end={item.label === "Home"} title={item.label} aria-label={item.label}>
            <span className="wireframe-primary-link-name">
              <item.icon size={17} aria-hidden="true" />
              <span className="wireframe-navigation-label">{item.label}</span>
            </span>
          </NavLink>
        </GemButton>
      ))}
    </nav>
  );
}
