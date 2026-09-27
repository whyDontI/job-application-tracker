import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const outdir = "dist";

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

// Background is declared as a module service worker in the manifest, so it can use ESM.
await build({
  entryPoints: { background: "src/shell/background/index.ts" },
  bundle: true,
  outdir,
  format: "esm",
  target: "chrome120",
  sourcemap: true,
});

// Content scripts and popup/dashboard pages run as classic scripts, not modules.
await build({
  entryPoints: {
    content: "src/shell/content/index.ts",
    popup: "src/shell/popup/popup.ts",
    dashboard: "src/shell/dashboard/dashboard.ts",
  },
  bundle: true,
  outdir,
  format: "iife",
  target: "chrome120",
  sourcemap: true,
});

cpSync("public/manifest.json", `${outdir}/manifest.json`);
cpSync("src/shell/popup/popup.html", `${outdir}/popup.html`);
cpSync("src/shell/dashboard/dashboard.html", `${outdir}/dashboard.html`);

console.log(`Built extension into ./${outdir}`);
