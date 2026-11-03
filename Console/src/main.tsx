import { StrictMode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { TamaguiProvider } from "tamagui";
import { App } from "./App";
import { tamaguiConfig } from "@gemsforge/ui";
import { queryClient } from "./data/queryClient";
import "./styles.css";
import "./design-system/global-density.css";
import "./design-system/wireframe-mvp.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TamaguiProvider config={tamaguiConfig} defaultTheme="dark">
        <App />
      </TamaguiProvider>
    </QueryClientProvider>
  </StrictMode>,
);
