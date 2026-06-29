import { createContext, useContext, useState, type ReactNode } from "react";
import { isHidden } from "@/lib/fileKind.ts";

const KEY = "gandalf:show-all";

interface FileFilterCtx {
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  /** Whether a path should be shown given the current filter. */
  visible: (path: string) => boolean;
}

const Ctx = createContext<FileFilterCtx>({
  showAll: false,
  setShowAll: () => {},
  visible: () => true,
});

function init(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

/**
 * Hides non-code files (configs/lockfiles/dotfiles) across the lenses by default; a header
 * toggle reveals them. Persisted per-user. Default OFF = hide non-code.
 */
export function FileFilterProvider({ children }: { children: ReactNode }) {
  const [showAll, setState] = useState<boolean>(init);
  const setShowAll = (v: boolean) => {
    setState(v);
    try {
      localStorage.setItem(KEY, v ? "on" : "off");
    } catch {
      /* private mode — non-fatal */
    }
  };
  const visible = (path: string) => showAll || !isHidden(path);
  return <Ctx.Provider value={{ showAll, setShowAll, visible }}>{children}</Ctx.Provider>;
}

export const useFileFilter = () => useContext(Ctx);
