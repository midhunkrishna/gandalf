import { createContext, useContext, useState, type ReactNode } from "react";
import type { DepthTier } from "@engine/core/schemas.ts";

interface DepthCtx {
  depth: DepthTier;
  setDepth: (d: DepthTier) => void;
}

const Ctx = createContext<DepthCtx>({ depth: "junior", setDepth: () => {} });

const TIERS: DepthTier[] = ["eli5", "junior", "senior", "architect"];
const DEPTH_KEY = "gandalf:depth";

function depthInit(): DepthTier {
  try {
    const stored = localStorage.getItem(DEPTH_KEY) as DepthTier | null;
    if (stored && TIERS.includes(stored)) return stored;
  } catch {
    /* private mode */
  }
  return "junior";
}

/** Audience-tier (ELI5→Architect) shared across every lens; persisted across lessons/sessions. */
export function DepthProvider({ children }: { children: ReactNode }) {
  const [depth, setDepthState] = useState<DepthTier>(depthInit);
  const setDepth = (d: DepthTier) => {
    setDepthState(d);
    try {
      localStorage.setItem(DEPTH_KEY, d);
    } catch {
      /* private mode */
    }
  };
  return <Ctx.Provider value={{ depth, setDepth }}>{children}</Ctx.Provider>;
}

export const useDepth = () => useContext(Ctx);
