#!/usr/bin/env node
// Copy vendored .cjs and .d.cts files from src/{client,cryptography-utils,types,hd-wallet}/
// to dist/<subpath>/. Preserves relative directory structure; skips .ts files (tsc compiles those).
//
// For .cjs files, rewrites bare `require("./X")` / `require("../X")` calls to
// add an explicit `.cjs` (or `/index.cjs`) suffix. Node's CJS resolver
// auto-resolves only `.js`, `.json`, `.node` extensions for relative bare
// requires, so the rebrand from `.js` -> `.cjs` (Phase 2 T2.1-T2.5, Phase 3 T3.2-T3.4)
// breaks runtime resolution unless extensions are added explicitly.
//
// Source files under src/ remain byte-identical to upstream; the rewrite happens
// only at the dist/ boundary. This is documented under the "Modifications from
// upstream" section of LICENSE-attribution.md.

const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");

const SUBPATHS = ["client", "cryptography-utils", "types", "hd-wallet"];
const SRC_ROOT = path.resolve(__dirname, "..", "src");
const DST_ROOT = path.resolve(__dirname, "..", "dist");

// Returns the rewritten require path with explicit suffix, or null if the
// path should be left unchanged (peer dep, already-suffixed, or unresolvable).
function resolveRequireTarget(srcFile, requirePath) {
  if (!requirePath.startsWith("./") && !requirePath.startsWith("../")) return null;
  if (/\.(cjs|json|node|js|mjs)$/.test(requirePath)) return null;
  const srcDir = path.dirname(srcFile);
  const candidate = path.resolve(srcDir, requirePath);
  if (fsSync.existsSync(candidate + ".cjs")) return requirePath + ".cjs";
  if (
    fsSync.existsSync(candidate) &&
    fsSync.statSync(candidate).isDirectory() &&
    fsSync.existsSync(path.join(candidate, "index.cjs"))
  ) {
    return requirePath.replace(/\/$/, "") + "/index.cjs";
  }
  return null;
}

async function copyAndRewriteCjs(src, dst) {
  const content = await fs.readFile(src, "utf8");
  let touched = false;
  const rewritten = content.replace(/require\("(\.\.?\/[^"]+?)"\)/g, (full, rp) => {
    const newRp = resolveRequireTarget(src, rp);
    if (newRp === null) return full;
    touched = true;
    return `require("${newRp}")`;
  });
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.writeFile(dst, rewritten);
  return touched;
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (e.isFile() && (e.name.endsWith(".cjs") || e.name.endsWith(".d.cts"))) files.push(p);
  }
  return files;
}

async function main() {
  let totalFiles = 0;
  let totalRewrites = 0;
  for (const subpath of SUBPATHS) {
    const src = path.join(SRC_ROOT, subpath);
    const dst = path.join(DST_ROOT, subpath);
    if (!fsSync.existsSync(src)) continue;
    await fs.mkdir(dst, { recursive: true });
    const files = await walk(src);
    let rewriteCount = 0;
    for (const f of files) {
      const rel = path.relative(src, f);
      const out = path.join(dst, rel);
      if (f.endsWith(".cjs")) {
        const touched = await copyAndRewriteCjs(f, out);
        if (touched) rewriteCount++;
      } else {
        await fs.mkdir(path.dirname(out), { recursive: true });
        await fs.copyFile(f, out);
      }
    }
    console.log(`copied ${files.length} vendored files to dist/${subpath}/ (${rewriteCount} files had bare-require rewrites)`);
    totalFiles += files.length;
    totalRewrites += rewriteCount;
  }
  console.log(`total: ${totalFiles} files, ${totalRewrites} files with rewrites`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
