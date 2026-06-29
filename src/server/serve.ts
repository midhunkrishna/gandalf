import { Hono } from "hono";
import { serve as nodeServe } from "@hono/node-server";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { listLessons, loadLesson } from "../core/lesson.ts";

const WEB_DIR = resolve(import.meta.dirname, "../../dist/web");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
  ".ico": "image/x-icon",
};

export interface ServeOptions {
  lessonsDir: string;
  port: number;
}

export function webBuilt(): boolean {
  return existsSync(join(WEB_DIR, "index.html"));
}

export async function startServer(opts: ServeOptions): Promise<void> {
  const app = new Hono();

  app.get("/api/lessons", async (c) => c.json(await listLessons(opts.lessonsDir)));

  app.get("/api/lesson/:id", async (c) => {
    try {
      return c.json(await loadLesson(opts.lessonsDir, c.req.param("id")));
    } catch {
      return c.json({ error: "lesson not found" }, 404);
    }
  });

  // latest lesson (default view)
  app.get("/api/lesson", async (c) => {
    const metas = await listLessons(opts.lessonsDir);
    if (!metas.length) return c.json({ error: "no lessons yet" }, 404);
    return c.json(await loadLesson(opts.lessonsDir, metas[0]!.id));
  });

  // static viewer + SPA fallback
  app.get("*", async (c) => {
    const pathname = decodeURIComponent(new URL(c.req.url).pathname);
    const rel = pathname === "/" || !extname(pathname) ? "/index.html" : pathname;
    const file = normalize(join(WEB_DIR, rel));
    if (!file.startsWith(WEB_DIR)) return c.text("forbidden", 403);
    try {
      const buf = await readFile(file);
      return new Response(new Uint8Array(buf), {
        headers: { "content-type": MIME[extname(file)] ?? "application/octet-stream" },
      });
    } catch {
      const idx = await readFile(join(WEB_DIR, "index.html"));
      return new Response(new Uint8Array(idx), { headers: { "content-type": MIME[".html"]! } });
    }
  });

  await new Promise<void>((res) => {
    nodeServe({ fetch: app.fetch, port: opts.port }, (info) => {
      process.stderr.write(`gandalf serving on http://localhost:${info.port}\n`);
      res();
    });
  });
}
