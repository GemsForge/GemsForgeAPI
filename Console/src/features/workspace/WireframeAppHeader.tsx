import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Menu, X } from "lucide-react";
import { GemLogo } from "@gemsforge/ui";
import "./wireframe-app-header.css";

interface WireframeNavigationContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
  toggleRef: RefObject<HTMLButtonElement | null>;
}

const WireframeNavigationContext = createContext<WireframeNavigationContextValue | null>(null);

export function WireframeNavigationProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeWhenDesktop = () => {
      if (window.innerWidth <= 1100) return;
      setOpen(false);
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(".wireframe-demo-sidebar .demo-sidebar-toggle-desktop")?.focus();
      });
    };
    closeWhenDesktop();
    window.addEventListener("resize", closeWhenDesktop);
    return () => window.removeEventListener("resize", closeWhenDesktop);
  }, [open]);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => toggleRef.current?.focus());
  };
  const value = useMemo(() => ({ open, setOpen, close, toggleRef }), [open]);

  return <WireframeNavigationContext.Provider value={value}>{children}</WireframeNavigationContext.Provider>;
}

export function useWireframeNavigation() {
  return useContext(WireframeNavigationContext);
}

export function WireframeAppHeader() {
  const navigation = useWireframeNavigation();
  if (!navigation) return null;

  return (
    <header className="wireframe-app-header">
      <button
        type="button"
        ref={navigation.toggleRef}
        className="wireframe-app-navigation-toggle"
        aria-label={navigation.open ? "Close navigation" : "Open navigation"}
        aria-expanded={navigation.open}
        aria-controls="wireframe-navigation"
        onClick={() => navigation.setOpen(!navigation.open)}
      >
        {navigation.open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
      </button>
      <span className="wireframe-app-header-brand"><GemLogo /></span>
    </header>
  );
}
