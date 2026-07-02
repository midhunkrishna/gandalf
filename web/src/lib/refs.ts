/** Abbreviate 40-char blob hashes; leave symbolic refs (HEAD, tags, WORKTREE) alone. */
export function shortRef(ref: string): string {
  return /^[0-9a-f]{12,40}$/i.test(ref) ? ref.slice(0, 7) : ref;
}
