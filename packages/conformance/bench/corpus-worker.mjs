// one repo corpus, three impls, best-of-3 replays/sec
import { readFileSync } from "node:fs"

const [, , corpusPath] = process.argv
const groups = JSON.parse(readFileSync(corpusPath, "utf8"))
const { twMerge } = await import("tailwind-merge")
const { clsx } = await import("clsx")
const { cn: cnfast } = await import("cnfast")
const { cn } = await import("cn")
const pair = (...a) => twMerge(clsx(...a))

const replay = (fn) => {
  let sink = 0
  for (let i = 0; i < groups.length; i++) sink += fn(...groups[i]).length
  return sink
}
const measure = (fn) => {
  let _sink = replay(fn) + replay(fn) // warmup
  let best = 0
  for (let t = 0; t < 3; t++) {
    const t0 = performance.now()
    let passes = 0
    while (performance.now() - t0 < 200) {
      _sink += replay(fn)
      passes++
    }
    const ops = passes / ((performance.now() - t0) / 1000)
    if (ops > best) best = ops
  }
  return best
}
const out = {
  pair: measure(pair),
  cnfast: measure(cnfast),
  cn: measure(cn),
  calls: groups.length,
}
console.log(JSON.stringify(out))
