import type { ReactNode } from "react";
import { cn } from "@/lib/cn.ts";

/**
 * The one uppercase section label. A single size and tracking everywhere —
 * replaces the per-file `H3` consts (which had drifted across four different
 * letter-spacings). `hint` renders a normal-case explainer under the label,
 * replacing the old "HEADING — explainer" em-dash pattern.
 */
export function SectionHeading({
  children,
  hint,
  className,
}: {
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn(hint && "space-y-0.5", className)}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-ink">{children}</h3>
      {hint && <p className="text-xs font-normal normal-case text-muted-ink/90">{hint}</p>}
    </div>
  );
}
