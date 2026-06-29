/// <reference types="vite/client" />

import type { LessonBundle, LessonMeta } from "@engine/core/schemas.ts";

declare global {
  /**
   * Injected at build time by `gandalf build` (vite `define`). In the live `serve`/dev
   * builds these are `null`/`[]`, so the app falls back to the lesson API.
   */
  const __GANDALF_LESSON__: LessonBundle | null;
  const __GANDALF_LESSONS__: LessonMeta[];
}

export {};
