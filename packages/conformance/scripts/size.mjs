// Bundle-size gate: min+gzip of each entry's full import graph, compared
// against the incumbents. Budget: default cn entry must stay under cnfast.
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"
import { build } from "esbuild"

// resolve through this package so 'cn' and the incumbents load from its own
// install (pnpm does not hoist), regardless of the invoking cwd; keep the
// workspace root as a fallback for hoisting package managers
const pkgRoot = fileURLToPath(new URL("..", import.meta.url))
const wsRoot = fileURLToPath(new URL("../../..", import.meta.url))

const tmp = mkdtempSync(join(tmpdir(), "cn-size-"))
const measure = async (label, entrySource) => {
  const entry = join(tmp, label.replace(/[^a-z0-9]/gi, "_") + ".mjs")
  writeFileSync(entry, entrySource)
  const r = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    write: false,
    target: "es2022",
    absWorkingDir: pkgRoot,
    nodePaths: [join(pkgRoot, "node_modules"), join(wsRoot, "node_modules")],
  })
  const bytes = r.outputFiles[0].contents
  return { label, min: bytes.length, gz: gzipSync(bytes, { level: 9 }).length }
}

const rows = [
  await measure("pico-cn", `export { cn } from 'cn'`),
  await measure("pico-cn (twMerge)", `export { twMerge } from 'cn'`),
  await measure(
    "upstream cn engine",
    `import { createCn } from 'cn/engine'; import tables from 'cn/tables'; export const cn = createCn(tables)`
  ),
  await measure("tailwind-merge", `export { twMerge } from 'tailwind-merge'`),
  await measure(
    "clsx+tailwind-merge",
    `import { clsx } from 'clsx'; import { twMerge } from 'tailwind-merge'; export const cn = (...a) => twMerge(clsx(a))`
  ),
  await measure("cnfast", `export { cn } from 'cnfast'`),
]
for (const r of rows)
  console.log(
    r.label.padEnd(22),
    String(r.min).padStart(7),
    "min",
    String(r.gz).padStart(7),
    "min+gz"
  )

const ours = rows[0]
const pair = rows.find((row) => row.label === "clsx+tailwind-merge")
let fail = false
if (ours.gz >= pair.gz) {
  console.error(`SIZE GATE FAIL: pico-cn ${ours.gz} >= pair ${pair.gz}`)
  fail = true
}
if (ours.gz > 4500) {
  console.error(`SIZE GATE FAIL: pico-cn ${ours.gz} > 4500 byte budget`)
  fail = true
}
if (fail) process.exit(1)
console.log(`size gate ok: ${ours.gz} gzip < ${pair.gz} pair; budget 4500`)

// ---------------------------------------------------------------------------
// Size experiments log (metric: min+gzip of the default entry). Kept here so
// nobody re-runs these blind — gzip is already near-optimal on the table
// text, which kills most clever encodings.
//
// Reverted:
// - interned unique-tail pool + per-set id streams: +700 B
// - lexicographic set reordering for gzip locality: +189 B
// - span-scanning numeric validators to kill slices: +144 B, no speed gain
//   (the token memo already absorbs repeat validation)
//
// Kept:
// - unifying the twJoin/clsx join layers into one resolver: −60 B
// - exporting tables as one default object instead of named exports: −90 B
//   of bundler glue
// - second-chance memo + adaptive cache logic: +40 B for the cold-path
//   speed wins (the adaptive off-window was later replaced by doorkeeper
//   admission, which fixed its failure mode — off-windows blocked large
//   recurring working sets from ever warming the cache)
// - sequence-predicting arg cache + doorkeeper-admitted whole-string cache
//   + run-slice emission: +460 B for 30× on the dominant component call and
//   49×/11.7× on the 53-repo corpus replay
// - fused FNV token hash + tagged doorkeeper + direct claim array: −22 B
//   and 1.6×/1.3× on the cold workloads — but a single-generation tagged
//   filter starved recurring working sets bigger than itself (6–15× slower
//   on real-repo replays; caught by speedlab, not the row benches — hence
//   the `workset` workload). Kept only with the two-generation filter below.
// - two-generation doorkeeper + 8192-entry cache + arity fronts for the arg
//   cache: +206 B for a reproducible 30× headline (10.4 ns predicted call),
//   restored corpus replays, and best-yet cold rows
// ---------------------------------------------------------------------------
