import { useEffect, useState } from "react";

/**
 * Tracks the `.dark` class on <html> and re-renders consumers when the theme toggles.
 * Components that bake the theme into rendered output at draw time (Shiki HTML, Mermaid
 * SVG) must depend on this so they re-render on a dark/light switch — CSS-variable theming
 * updates automatically, but pre-rendered markup does not.
 */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}
