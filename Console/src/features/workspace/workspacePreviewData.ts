import type { ForgeKeeperPage } from "../../types";

/** Local-only content used when the explicit Vite inspection bypass is enabled. */
export const workspacePreviewPages: ForgeKeeperPage[] = [
  {
    id: 51601,
    parentID: null,
    domainID: "Life",
    title: "Field notes",
    description: "Observations, ideas, and connections in progress.",
    updatedAt: "2026-11-09T12:00:00.000Z",
  },
  {
    id: 51602,
    parentID: null,
    domainID: "Life",
    title: "Personal systems",
    description: "Small systems that make room for a thoughtful life.",
  },
  {
    id: 51603,
    parentID: null,
    domainID: "Projects",
    title: "Chromalock",
    description: "A cooperative puzzle game in progress.",
  },
  {
    id: 51604,
    parentID: null,
    domainID: "Knowledge",
    title: "Database handbook",
    description: "Reference notes and examples.",
  },
];

export interface WorkspacePreviewRow {
  id: string;
  name: string;
  type: string;
  status: string;
  nextThought: string;
}

export const workspacePreviewRows: WorkspacePreviewRow[] = [
  {
    id: "chromalock",
    name: "Chromalock",
    type: "Project",
    status: "In progress",
    nextThought: "Refine the core logic and daily use.",
  },
  {
    id: "personal-systems",
    name: "Personal systems",
    type: "System",
    status: "Active",
    nextThought: "Review what’s working, simplify what isn’t.",
  },
  {
    id: "handbook",
    name: "Database handbook",
    type: "Reference",
    status: "Draft",
    nextThought: "Outline key structures and examples.",
  },
];
