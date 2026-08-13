# Cloudflare deployment (Workers Builds, static assets)

`site/` deploys to Cloudflare via Workers Builds Git integration:
push-to-deploy, same setup as shaktiman.dev. The `wrangler.jsonc` at the repo
root points `assets.directory` at `site/`. There is no Worker script; Cloudflare
just serves the static files. The directory is fully static: the sample
lesson is a committed `gandalf build` export (regenerating it drives Claude
usage, so it is never rebuilt in CI; re-export locally and commit to update it).

## One-time setup (maintainer)

1. **Cloudflare dashboard → Workers & Pages → Create → Import a repository.**
2. Select the `midhunkrishna/gandalf` repo.
3. **Build settings:**

   | Setting | Value |
   |---|---|
   | Build command | *(leave empty)* |
   | Deploy command | `npx wrangler deploy` |
   | Path (root directory) | `/` |

4. **Production branch:** `main`. Other branches produce preview deployments.
5. After the first deploy, add the custom domain on the Worker
   (e.g. `gandalf.midhunkrishna.in`). Cloudflare provisions TLS automatically.

## Updating the sample lesson

```bash
npm run gandalf -- generate --from <sha>^ --to <sha> --cwd <repo>
npm run gandalf -- build --cwd <repo> --out site/lessons/<name>.html
# edit site/index.html if the featured lesson changes, then commit + push
```

Keep exports under Cloudflare Pages' 25 MB per-file limit (current sample: ~7 MB).
