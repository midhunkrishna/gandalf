import { createContext, useContext, useState, type ReactNode } from "react";
import type { DepthTier } from "@engine/core/schemas.ts";

interface DepthCtx {
  depth: DepthTier;
  setDepth: (d: DepthTier) => void;
}

const Ctx = createContext<DepthCtx>({ depth: "junior", setDepth: () => {} });

/** Audience-tier (ELI5→Architect) shared across every lens; switched client-side. */
export function DepthProvider({ children }: { children: ReactNode }) {
  const [depth, setDepth] = useState<DepthTier>("junior");
  return <Ctx.Provider value={{ depth, setDepth }}>{children}</Ctx.Provider>;
}

export const useDepth = () => useContext(Ctx);
