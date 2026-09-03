import { execFileSync } from "node:child_process"
import { appendFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const run = (relative) =>
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL(relative, import.meta.url))],
    {
      encoding: "utf8",
    }
  )

const size = run("./size.mjs")
const bench = run("../bench/bench.mjs")
process.stdout.write(size + "\n" + bench)

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## pico-cn size + performance\n\n### bundle size\n\n\`\`\`text\n${size.trim()}\n\`\`\`\n\n### benchmark\n\n\`\`\`text\n${bench.trim()}\n\`\`\`\n`
  )
}
