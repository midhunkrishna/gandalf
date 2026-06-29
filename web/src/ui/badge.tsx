import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn.ts";

const badge = cva(
  "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-xs font-medium leading-none",
  {
    variants: {
      tone: {
        neutral: "border-line bg-surface-2 text-muted-ink",
        added: "border-added/30 bg-added/10 text-added",
        removed: "border-removed/30 bg-removed/10 text-removed",
        modified: "border-modified/30 bg-modified/10 text-modified",
        safe: "border-sage/30 bg-sage/10 text-sage",
        breaking: "border-danger/40 bg-danger/10 text-danger",
        primary: "border-primary/30 bg-primary/10 text-primary",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}
