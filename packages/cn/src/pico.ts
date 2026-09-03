import type { ClassNameValue, ClassValue, CnFunction } from "./types.js"

// Size-first merger based on my work on tw-merge from three years ago (2023).
// It deliberately trades configurable, exhaustive Tailwind semantics for a
// small static classifier covering common utilities. Advanced users can keep
// using cn/config or cn/engine, which retain the full compiled implementation.

const exactGroups = new Map<string, string>()

const exact = (group: string, values: string) => {
  for (const value of values.split("|")) exactGroups.set(value, group)
}

exact(
  "display",
  "block|inline-block|inline|flex|inline-flex|table|inline-table|table-caption|table-cell|table-column|table-column-group|table-footer-group|table-header-group|table-row-group|table-row|flow-root|grid|inline-grid|contents|list-item|hidden"
)
exact("position", "static|fixed|absolute|relative|sticky")
exact("visibility", "visible|invisible|collapse")
exact("isolation", "isolate|isolation-auto")
exact("font-style", "italic|not-italic")
exact("font-smoothing", "antialiased|subpixel-antialiased")
exact("text-decoration", "underline|overline|line-through|no-underline")
exact("text-transform", "uppercase|lowercase|capitalize|normal-case")
exact("text-overflow", "truncate|text-ellipsis|text-clip")
exact("sr", "sr-only|not-sr-only")
exact("box-sizing", "box-border|box-content")
exact("transform", "transform|transform-cpu|transform-gpu|transform-none")
exact("border-collapse", "border-collapse|border-separate")
exact("table-layout", "table-auto|table-fixed")
exact("caption-side", "caption-top|caption-bottom")
exact("resize", "resize|resize-x|resize-y|resize-none")
exact("appearance", "appearance-none|appearance-auto")
exact("pointer-events", "pointer-events-none|pointer-events-auto")
exact("flex-direction", "flex-row|flex-row-reverse|flex-col|flex-col-reverse")
exact(
  "object-fit",
  "object-contain|object-cover|object-fill|object-none|object-scale-down"
)
exact(
  "object-position",
  "object-bottom|object-center|object-left|object-left-bottom|object-left-top|object-right|object-right-bottom|object-right-top|object-top"
)
exact("list-position", "list-inside|list-outside")
exact("snap-type", "snap-none|snap-x|snap-y|snap-both")
exact("snap-align", "snap-start|snap-end|snap-center|snap-align-none")
exact("snap-stop", "snap-normal|snap-always")
exact("field-sizing", "field-sizing-content|field-sizing-fixed")
exact(
  "scheme",
  "scheme-normal|scheme-light|scheme-dark|scheme-light-dark|scheme-only-light|scheme-only-dark"
)
exact("wrap", "wrap-break-word|wrap-anywhere|wrap-normal")
exact("container", "@container")
exact("text-wrap", "text-wrap|text-nowrap|text-balance|text-pretty")

const simpleStems =
  "accent align animate aspect auto-cols auto-rows backdrop-blur backdrop-brightness backdrop-contrast backdrop-grayscale backdrop-hue-rotate backdrop-invert backdrop-opacity backdrop-saturate backdrop-sepia basis bg-blend bg-clip bg-origin blur bottom break-after break-before break-inside break brightness caret clear col-end col-span col-start columns content contrast cursor delay divide-x-reverse divide-y-reverse drop-shadow duration ease end fill flex float grayscale grid-cols grid-flow grid-rows grow hue-rotate hyphens indent inset-shadow invert items justify justify-items justify-self leading left line-clamp list-image mask-b-to mask-radial mask-t-from max-h max-w min-h min-w mix-blend object opacity order origin outline-offset perspective resize right rotate rotate-x rotate-y row-end row-span row-start saturate scale select self sepia shadow shrink skew-x skew-y snap snap-align snap-stop space-x-reverse space-y-reverse start stroke table top touch tracking transition translate-x translate-y underline-offset whitespace will-change z"
    .split(" ")
    .sort((a, b) => b.length - a.length)

const directional = new Set(
  "p m inset scroll-m scroll-p rounded gap overflow overscroll border divide space".split(
    " "
  )
)

const directionConflicts: Record<string, string[]> = {
  "": ["", "x", "y", "t", "r", "b", "l", "s", "e", "tl", "tr", "br", "bl"],
  x: ["x", "l", "r"],
  y: ["y", "t", "b"],
  t: ["t", "tl", "tr"],
  r: ["r", "tr", "br"],
  b: ["b", "br", "bl"],
  l: ["l", "bl", "tl"],
  s: ["s"],
  e: ["e"],
  tl: ["tl"],
  tr: ["tr"],
  br: ["br"],
  bl: ["bl"],
}

type Match = { group: string; conflicts?: string[] }

const directionalMatch = (utility: string): Match | undefined => {
  const match =
    /^([pm])([trblxyse])?(?:-|$)/.exec(utility) ??
    /^(scroll-[mp])([trblxyse])?(?:-|$)/.exec(utility) ??
    /^(overscroll|overflow|rounded|border|divide|space|inset|gap)(?:-([trblxyse]|tl|tr|br|bl))?(?:-|$)/.exec(
      utility
    )
  if (!match || !directional.has(match[1]!)) return
  const stem = match[1]!
  const dir = match[2] ?? ""
  const value = utility.slice(match[0].length)
  const numeric = /^(?:\d+(?:\.\d+)?|px|auto|full|\[.*\]|\(.*\))$/
  const valid =
    stem === "rounded"
      ? (!dir && !value) ||
        /^(?:none|xs|sm|md|lg|xl|2xl|3xl|full|\[.*\]|\(.*\))$/.test(value)
      : stem === "overflow"
        ? /^(?:auto|hidden|clip|visible|scroll)$/.test(value)
        : stem === "overscroll"
          ? /^(?:auto|contain|none)$/.test(value)
          : stem === "border"
            ? (!dir && !value) ||
              /^(?:\d+(?:\.\d+)?|px|\[length:.*\])$/.test(value)
            : numeric.test(value)
  if (!valid) return
  const group = `${stem}:${dir}`
  const cross =
    stem === "inset"
      ? dir === ""
        ? ["top", "right", "bottom", "left", "start", "end"]
        : dir === "x"
          ? ["left", "right"]
          : dir === "y"
            ? ["top", "bottom"]
            : []
      : []
  return {
    group,
    conflicts: [
      ...(directionConflicts[dir] ?? [dir]).map((d) => `${stem}:${d}`),
      ...cross,
    ],
  }
}

const classify = (utility: string): Match | undefined => {
  const slash = utility.indexOf("/")
  const base = slash < 0 ? utility : utility.slice(0, slash)
  const exactGroup = exactGroups.get(base)
  if (exactGroup) return { group: exactGroup }

  if (base === "normal-nums")
    return {
      group: "fvn-normal",
      conflicts: ["fvn-normal", "fvn-ordinal", "fvn-zero"],
    }
  if (base === "ordinal")
    return { group: "fvn-ordinal", conflicts: ["fvn-ordinal", "fvn-normal"] }
  if (base === "slashed-zero")
    return { group: "fvn-zero", conflicts: ["fvn-zero", "fvn-normal"] }
  if (base.startsWith("@container-size")) return { group: "container-size" }

  if (utility[0] === "[" && utility.endsWith("]")) {
    const colon = utility.indexOf(":")
    if (colon > 1) return { group: `arbitrary:${utility.slice(1, colon)}` }
  }

  const border = /^border(?:-([xytrblse]))?-(.+)$/.exec(utility)
  if (border) {
    const direction = border[1] ?? ""
    const value = border[2]!
    if (/^(?:solid|dashed|dotted|double|hidden|none)$/.test(value))
      return { group: `border-style:${direction}` }
    if (
      /^(?:transparent|current|black|white|inherit|[a-z]+-\d|\[color:|\[#|\(--)/.test(
        value
      )
    )
      return { group: `border-color:${direction}` }
    if (!/^(?:\d|px$|\[length:)/.test(value))
      return { group: `border-color:${direction}` }
  }

  const directionalGroup = directionalMatch(base)
  if (directionalGroup) return directionalGroup

  if (
    /^(w|h)-(?:\d|px$|auto$|full$|screen$|min$|max$|fit$|\[|\(--)/.test(utility)
  )
    return { group: utility[0]! }
  if (utility.startsWith("size-"))
    return { group: "size", conflicts: ["size", "w", "h"] }

  if (utility.startsWith("text-shadow-")) return { group: "text-shadow" }

  if (/^text-(left|center|right|justify|start|end)$/.test(utility))
    return { group: "text-align" }
  if (
    /^text-(2?xs|sm|base|lg|xl|[0-9]+xl|\[length:|\[[0-9.]+(?:px|rem|em))/.test(
      utility
    )
  )
    return { group: "font-size", conflicts: ["font-size", "leading"] }
  if (utility.startsWith("text-")) return { group: "text-color" }

  if (
    /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[[0-9]+\])$/.test(
      utility
    )
  )
    return { group: "font-weight" }
  if (utility.startsWith("font-")) return { group: "font-family" }

  if (utility.startsWith("bg-blend-")) return { group: "bg-blend" }

  if (/^bg-(fixed|local|scroll)$/.test(utility))
    return { group: "bg-attachment" }
  if (/^bg-(auto|cover|contain)$/.test(utility)) return { group: "bg-size" }
  if (
    /^bg-(bottom|center|left|left-bottom|left-top|right|right-bottom|right-top|top)$/.test(
      utility
    )
  )
    return { group: "bg-position" }
  if (
    /^bg-(repeat|no-repeat|repeat-x|repeat-y|repeat-round|repeat-space)$/.test(
      utility
    )
  )
    return { group: "bg-repeat" }
  if (utility.startsWith("bg-[position:")) return { group: "bg-position" }
  if (utility.startsWith("bg-[size:")) return { group: "bg-size" }
  if (utility.startsWith("bg-[image:") || utility.startsWith("bg-[url("))
    return { group: "bg-image" }
  if (/^bg-(linear|radial|conic|gradient|none)/.test(utility))
    return { group: "bg-image" }
  if (utility.startsWith("bg-")) return { group: "bg-color" }

  if (/^shadow(?:$|-(?:none|xs|sm|md|lg|xl|2xl|inner|\[|\(--))/.test(utility))
    return { group: "shadow" }
  if (utility.startsWith("shadow-")) return { group: "shadow-color" }
  if (utility === "ring" || /^ring-(?:\d|px$|\[length:)/.test(utility))
    return { group: "ring" }
  if (utility.startsWith("ring-")) return { group: "ring-color" }
  if (/^stroke-(?:\d|\[length:)/.test(utility)) return { group: "stroke-width" }
  if (utility.startsWith("stroke-")) return { group: "stroke-color" }
  if (/^decoration-(?:\d|auto$|from-font$|\[length:)/.test(utility))
    return { group: "decoration-thickness" }
  if (utility.startsWith("divide-")) return { group: "divide-color" }
  if (/^list-(?:disc|decimal|none|\[)/.test(utility))
    return { group: "list-style" }
  if (utility === "touch-auto" || utility === "touch-none")
    return {
      group: "touch-all",
      conflicts: ["touch-all", "touch-x", "touch-y", "touch-pinch"],
    }
  if (/^touch-pan-(?:x|left|right)$/.test(utility))
    return { group: "touch-x", conflicts: ["touch-x", "touch-all"] }
  if (/^touch-pan-(?:y|up|down)$/.test(utility))
    return { group: "touch-y", conflicts: ["touch-y", "touch-all"] }
  if (utility === "touch-pinch-zoom")
    return {
      group: "touch-pinch",
      conflicts: ["touch-pinch", "touch-all"],
    }

  if (/^flex-(?:\d|auto$|initial$|none$|\[)/.test(utility))
    return {
      group: "flex",
      conflicts: ["flex", "basis", "grow", "shrink"],
    }
  if (utility.startsWith("line-clamp-"))
    return {
      group: "line-clamp",
      conflicts: ["line-clamp", "display", "overflow:"],
    }

  if (utility === "outline" || /^outline-(?:\d|px$|\[length:)/.test(utility))
    return { group: "outline" }
  if (utility.startsWith("translate-none"))
    return {
      group: "translate",
      conflicts: ["translate", "translate-x", "translate-y"],
    }
  if (/^@container(?:\/|$)/.test(utility)) return { group: "container" }

  for (const stem of simpleStems)
    if (base === stem || base.startsWith(stem + "-")) return { group: stem }
  return
}

const contextOf = (token: string) => {
  const variants: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < token.length; i++) {
    const char = token.charCodeAt(i)
    if (char === 91) depth++
    else if (char === 93) depth--
    else if (char === 58 && depth === 0) {
      variants.push(token.slice(start, i))
      start = i + 1
    }
  }
  const utility = token.slice(start)
  if (!variants.length) return { context: "", utility }

  let ordered = false
  for (const variant of variants)
    if (
      variant[0] === "[" ||
      variant === "before" ||
      variant === "after" ||
      variant === "file" ||
      variant === "*" ||
      variant === "**"
    ) {
      ordered = true
      break
    }
  if (!ordered) variants.sort()
  return { context: variants.join(":"), utility }
}

const cache = new Map<string, string>()

export const mergeString = (input: string): string => {
  const cached = cache.get(input)
  if (cached !== undefined) return cached

  const tokens = input.match(/\S+/g)
  if (!tokens) return ""
  const seen = new Set<string>()
  const kept: string[] = []

  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i]!
    const parsed = contextOf(token)
    let utility = parsed.utility
    const important = utility[0] === "!" || utility.endsWith("!")
    if (utility[0] === "!") utility = utility.slice(1)
    if (utility.endsWith("!")) utility = utility.slice(0, -1)
    if (utility[0] === "-") utility = utility.slice(1)
    const match = classify(utility)
    if (!match) {
      kept.push(token)
      continue
    }
    const prefix = `${parsed.context}|${important ? "!" : ""}`
    const key = prefix + match.group
    if (seen.has(key)) continue
    kept.push(token)
    for (const conflict of match.conflicts ?? [match.group])
      seen.add(prefix + conflict)
  }

  const result = kept.reverse().join(" ")
  if (cache.size >= 256) cache.clear()
  cache.set(input, result)
  return result
}

const resolveValue = (value: ClassValue, clsxMode: boolean): string => {
  if (!value) return ""
  if (typeof value === "string") return value
  if (
    typeof (value as { length?: unknown }).length === "number" &&
    (clsxMode ? Array.isArray(value) : true)
  ) {
    let result = ""
    const values = value as ArrayLike<ClassValue>
    for (let i = 0; i < values.length; i++) {
      const part = resolveValue(values[i]!, clsxMode)
      if (part) result += (result ? " " : "") + part
    }
    return result
  }
  if (clsxMode && typeof value === "number") return String(value)
  if (clsxMode && typeof value === "object") {
    let result = ""
    for (const key in value)
      if ((value as Record<string, unknown>)[key])
        result += (result ? " " : "") + key
    return result
  }
  return ""
}

const join = (args: IArguments, clsxMode: boolean) => {
  let result = ""
  for (let i = 0; i < args.length; i++) {
    const part = resolveValue(args[i] as ClassValue, clsxMode)
    if (part) result += (result ? " " : "") + part
  }
  return result
}

export const clsx = function (): string {
  return join(arguments, true)
} as (...inputs: ClassValue[]) => string

export const twJoin = function (): string {
  return join(arguments, false)
} as (...inputs: ClassNameValue[]) => string

export const twMerge = function (): string {
  return mergeString(join(arguments, false))
} as (...inputs: ClassNameValue[]) => string

export const cn = function (): string {
  return mergeString(join(arguments, true))
} as CnFunction
