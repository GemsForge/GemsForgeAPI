import { NavLink } from "react-router-dom";
import { GemButton } from "../../components/ui/GemButton";

const primaryNavigation = [
  { label: "Home", icon: "⌂", to: "/" },
  { label: "Workspace", icon: "✦", to: "/workspace" },
  { label: "Domains", icon: "◇", to: "/domains" },
  { label: "ForgeKeeper", icon: "⌁", to: "/forgekeeper" },
] as const;

export function WireframePrimaryLinks({ search }: { search: string }) {
  const normalizedSearch = search.trim().toLowerCase();
  const visibleLinks = primaryNavigation.filter((item) => item.label.toLowerCase().includes(normalizedSearch));

  return (
    <nav aria-label="Primary navigation" className="demo-nav">
      {visibleLinks.map((item) => (
        <GemButton asChild variant="quiet" tone="secondary" className="wireframe-primary-link" key={item.label}>
          <NavLink to={item.to} end={item.to === "/"}>
            <span className="wireframe-primary-link-name">
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </span>
          </NavLink>
        </GemButton>
      ))}
    </nav>
  );
}
