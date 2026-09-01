#!/usr/bin/env node
// cn build — compile project-fitted merge tables from your source files.
//
//   npx cn build                                  scan default globs, write ./cn-tables.mjs
//   npx cn build --content "src/**/*.{ts,tsx}"    scan specific globs (repeatable / comma-separated)
//   npx cn build -o src/lib/cn-tables.ts          output path (.ts or .mjs/.js)
//   npx cn build --safelist safelist.txt          extra class names (file, whitespace-separated)
//   npx cn build --config cn.config.mjs           config extension (default export: { extend, override, prefix } or (config) => config)
//   npx cn build --full                           skip subsetting (all groups; custom config still applies)
//   npx cn build --tokens tokens.txt              use a pre-extracted token file instead of scanning
//
// Subsetting contract (same as Tailwind's content scanning): every class that
// appears in the scanned sources merges byte-identically to the full tables;
// classes never seen in your sources may instead pass through unmerged — they
// have no CSS in your build anyway. Don't build class names by string
// concatenation, or add them to the safelist if you must.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { join, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"
import { gzipSync } from "node:zlib"

const args = process.argv.slice(2)
const HELP = `Usage: cn build [options]

Options:
  --content <glob>     source globs to scan (repeatable or comma-separated)
                       default: **/*.{js,jsx,ts,tsx,html,vue,svelte,astro,mdx}
  -o, --out <path>     output module path (default: cn-tables.mjs; .ts emits TS)
  --safelist <file>    extra class names, whitespace-separated
  --config <file>      config extension module (default export)
  --tokens <file>      pre-extracted tokens (skips scanning)
  --full               keep all class groups (no subsetting)
  --cwd <dir>          base directory (default: process.cwd())
  -q, --quiet          suppress summary output
  -h, --help           show this help
  -v, --version        show version
`

const fail = (msg) => {
  console.error("cn: " + msg)
  process.exit(1)
}

if (args.includes("-h") || args.includes("--help") || args.length === 0) {
  console.log(HELP)
  process.exit(0)
}
if (args.includes("-v") || args.includes("--version")) {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  )
  console.log(pkg.version)
  process.exit(0)
}
if (args[0] !== "build") fail(`unknown command "${args[0]}" (expected: build)`)

const opts = {
  content: [],
  out: "cn-tables.mjs",
  safelist: null,
  config: null,
  tokens: null,
  full: false,
  cwd: process.cwd(),
  quiet: false,
}
for (let i = 1; i < args.length; i++) {
  const a = args[i]
  const next = () => {
    if (i + 1 >= args.length) fail(`missing value for ${a}`)
    return args[++i]
  }
  if (a === "--content") opts.content.push(...next().split(","))
  else if (a === "-o" || a === "--out") opts.out = next()
  else if (a === "--safelist") opts.safelist = next()
  else if (a === "--config") opts.config = next()
  else if (a === "--tokens") opts.tokens = next()
  else if (a === "--full") opts.full = true
  else if (a === "--cwd") opts.cwd = next()
  else if (a === "-q" || a === "--quiet") opts.quiet = true
  else fail(`unknown option "${a}"`)
}

// ---- mini-glob: pattern → {base, regex}; recursive walk, no deps ------------
const globToRegex = (pattern) => {
  let re = ""
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        // '**' (+ optional '/') matches any depth including none
        re += "(?:.*)"
        i++
        if (pattern[i + 1] === "/") {
          re += "/?"
          i++
        }
      } else re += "[^/]*"
    } else if (c === "?") re += "[^/]"
    else if (c === "{") {
      const end = pattern.indexOf("}", i)
      if (end === -1) fail("unclosed { in glob: " + pattern)
      re +=
        "(?:" +
        pattern
          .slice(i + 1, end)
          .split(",")
          .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|") +
        ")"
      i = end
    } else if (".+^$()|[]\\".includes(c)) re += "\\" + c
    else re += c
  }
  return new RegExp("^" + re + "$")
}
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "out",
  "coverage",
  ".svelte-kit",
  ".astro",
  ".vercel",
  ".output",
])
const walk = (dir, rel, out) => {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (IGNORED_DIRS.has(e.name) || e.name.startsWith(".")) continue
      walk(join(dir, e.name), rel ? rel + "/" + e.name : e.name, out)
    } else if (e.isFile()) {
      out.push(rel ? rel + "/" + e.name : e.name)
    }
  }
}
const expandGlobs = (patterns, cwd) => {
  const files = new Set()
  let allFiles = null
  for (const raw of patterns) {
    const pattern = raw.replace(/\\/g, "/").replace(/^\.\//, "")
    if (!/[*?{]/.test(pattern)) {
      // literal path: file or directory
      const p = resolve(cwd, pattern)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isFile()) files.add(p)
      else if (st.isDirectory()) {
        const sub = []
        walk(p, "", sub)
        for (const f of sub) files.add(join(p, f.split("/").join(sep)))
      }
      continue
    }
    if (allFiles === null) {
      allFiles = []
      walk(cwd, "", allFiles)
    }
    const re = globToRegex(pattern)
    for (const f of allFiles)
      if (re.test(f)) files.add(resolve(cwd, f.split("/").join(sep)))
  }
  return [...files]
}

// ---- candidate extraction (over-approximation is safe: unknown tokens only
// classify as "not a Tailwind class"; missing tokens are the danger) ---------
const CANDIDATE_RE = /[^<>"'`\s]*[^<>"'`\s:]/g
const extractTokens = (text, into) => {
  const matches = text.match(CANDIDATE_RE)
  if (!matches) return
  for (const m of matches) {
    if (m.length > 0 && m.length < 256) into.add(m)
  }
}

// ---- main --------------------------------------------------------------------
const { compileToSource, subsetConfig, mergeConfigs } =
  await import("../dist/compiler.js")
const { defaultConfig } = await import("../dist/config.js")

let config = defaultConfig()
if (opts.config) {
  const mod = await import(pathToFileURL(resolve(opts.cwd, opts.config)).href)
  const ext = mod.default ?? mod.config
  if (!ext) fail(`config file ${opts.config} has no default export`)
  config = typeof ext === "function" ? ext(config) : mergeConfigs(config, ext)
}

const tokens = new Set()
let scannedFiles = 0
if (!opts.full) {
  if (opts.tokens) {
    for (const t of readFileSync(resolve(opts.cwd, opts.tokens), "utf8").split(
      /\s+/
    )) {
      if (t) tokens.add(t)
    }
  } else {
    const patterns = opts.content.length
      ? opts.content
      : ["**/*.{js,jsx,ts,tsx,html,vue,svelte,astro,mdx}"]
    const files = expandGlobs(patterns, opts.cwd)
    if (files.length === 0)
      fail("no files matched the content globs; pass --content or use --full")
    for (const f of files) {
      try {
        extractTokens(readFileSync(f, "utf8"), tokens)
        scannedFiles++
      } catch {
        /* unreadable file: skip */
      }
    }
  }
  if (opts.safelist) {
    for (const t of readFileSync(
      resolve(opts.cwd, opts.safelist),
      "utf8"
    ).split(/\s+/)) {
      if (t) tokens.add(t)
    }
  }
}

let usedGroups = null
let totalGroups = null
if (!opts.full) {
  const r = subsetConfig(config, tokens)
  config = r.config
  usedGroups = r.usedGroups
  totalGroups = r.totalGroups
}

const outPath = resolve(opts.cwd, opts.out)
const lang = outPath.endsWith(".ts") ? "ts" : "js"
const banner = `// GENERATED by \`cn build\` — do not edit.
// Pair with createCn from "cn/engine":
//   import tables from "./${opts.out.split("/").pop()}"
//   import { createCn } from "cn/engine"
//   export const cn = createCn(tables)`
let source
try {
  source = compileToSource(config, { lang, banner })
} catch (err) {
  fail(String(err && err.message ? err.message : err))
}
writeFileSync(outPath, source)

if (!opts.quiet) {
  const gz = gzipSync(source, { level: 9 }).length
  const parts = []
  if (!opts.full) {
    parts.push(
      `${scannedFiles ? `scanned ${scannedFiles} files, ` : ""}${tokens.size} candidate tokens`
    )
    parts.push(`${usedGroups}/${totalGroups} class groups kept`)
  } else {
    parts.push("all class groups kept (--full)")
  }
  console.log(`cn build: ${parts.join(", ")}`)
  console.log(
    `  → ${opts.out} (${(source.length / 1024).toFixed(1)} KB source, ${(gz / 1024).toFixed(1)} KB gzip)`
  )
}
