# Cloudflare Pages deployment

`site/` deploys to Cloudflare Pages via the dashboard's Git integration —
push-to-deploy, same setup as shaktiman.dev. The directory is **fully static**:
the sample lesson is a committed `gandalf build` export (regenerating it drives
Claude usage, so it is never rebuilt in CI — re-export locally and commit to
update it).

## One-time setup (maintainer)

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.**
2. Select the `midhunkrishna/gandalf` repo.
3. **Framework preset:** None.
4. **Build settings:**

   | Setting | Value |
   |---|---|
   | Build command | *(leave empty)* |
   | Build output directory | `site` |
   | Root directory (advanced) | *(leave as repo root)* |

5. **Production branch:** `main`. Other branches produce preview deployments.
6. After the first deploy, add the custom domain under **Custom domains**
   (e.g. `gandalf.midhunkrishna.in`). Cloudflare provisions TLS automatically.

## Updating the sample lesson

```bash
npm run gandalf -- generate --from <sha>^ --to <sha> --cwd <repo>
npm run gandalf -- build --cwd <repo> --out site/lessons/<name>.html
# edit site/index.html if the featured lesson changes, then commit + push
```

Keep exports under Cloudflare Pages' 25 MB per-file limit (current sample: ~7 MB).
