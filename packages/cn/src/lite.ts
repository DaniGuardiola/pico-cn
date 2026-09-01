// `clsx/lite` parity entry (`cn/lite`): strings-only join, everything else
// ignored — so a bundler alias of `clsx` → `cn` also covers code importing
// the `/lite` subpath. Join-only by design: this stands in for clsx's role
// (joining), not cn's (merging).

export function clsx(): string {
  let str = ""
  for (let i = 0; i < arguments.length; i++) {
    const tmp = arguments[i]
    if (tmp && typeof tmp === "string") {
      if (str) str += " "
      str += tmp
    }
  }
  return str
}

export default clsx
