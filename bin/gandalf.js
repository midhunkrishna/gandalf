#!/usr/bin/env node
// npm bin entry: the CLI is shipped as TypeScript (bin/gandalf.ts + src/) and
// run through tsx, so the published package needs no compile step and stays
// byte-identical to the repo. tsx is a runtime dependency for exactly this.
import { register } from "tsx/esm/api";

register();
await import("./gandalf.ts");
