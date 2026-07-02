/** The one empty-library message, shared by the gallery and the header dropdown. */
export function NoLessons({ className }: { className?: string }) {
  return (
    <p className={className}>
      No lessons yet. <code className="font-mono text-xs">gandalf generate</code> writes the first one.
    </p>
  );
}
