// Builds the claude.ai-hosted copy of the hub: one self-contained HTML page
// (app code and CSS inlined) published with the Artifact tool.
//
//   npm run build:artifact   ->   artifact-dist/content-hub.html
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "artifact-dist");
mkdirSync(out, { recursive: true });

const js = await build({
  entryPoints: [join(root, "src/artifact/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  jsx: "automatic",
  write: false,
  logLevel: "error",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_TARGET": '"artifact"',
  },
  alias: {
    "next/link": join(root, "src/artifact/shims/next-link.tsx"),
    "next/navigation": join(root, "src/artifact/shims/next-navigation.ts"),
  },
});
// Keep the inlined bundle from closing its own <script> tag early.
const script = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");

const cssFile = join(out, ".hub.css");
execFileSync(
  join(root, "node_modules/.bin/tailwindcss"),
  ["-i", join(root, "src/app/globals.css"), "-o", cssFile, "--minify"],
  { cwd: root, stdio: "pipe" },
);
const css = readFileSync(cssFile, "utf8");
rmSync(cssFile);

const html = `<title>Content Hub</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap">
<style>
:root{--font-geist-sans:"Geist",system-ui,-apple-system,"Segoe UI",sans-serif;--font-geist-mono:"Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
html,body,#hub{height:100%}
${css}
</style>
<div id="hub"></div>
<script>${script}</script>
`;
writeFileSync(join(out, "content-hub.html"), html);
console.log(`artifact-dist/content-hub.html  ${(html.length / 1024).toFixed(0)} KB`);
