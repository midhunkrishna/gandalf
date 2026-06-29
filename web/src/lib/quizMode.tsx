import { createContext, useContext, useState, type ReactNode } from "react";

const KEY = "gandalf:quiz";

interface QuizCtx {
  quiz: boolean;
  setQuiz: (v: boolean) => void;
}

const Ctx = createContext<QuizCtx>({ quiz: true, setQuiz: () => {} });

function initial(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * Quiz mode gates answers behind predict-then-reveal (Trace Cards, contract verdicts).
 * Default ON (active processing); persisted per-user so passive readers can opt out once.
 */
export function QuizModeProvider({ children }: { children: ReactNode }) {
  const [quiz, setQuizState] = useState<boolean>(initial);
  const setQuiz = (v: boolean) => {
    setQuizState(v);
    try {
      localStorage.setItem(KEY, v ? "on" : "off");
    } catch {
      /* ignore (private mode / SSR) */
    }
  };
  return <Ctx.Provider value={{ quiz, setQuiz }}>{children}</Ctx.Provider>;
}

export const useQuizMode = () => useContext(Ctx);
