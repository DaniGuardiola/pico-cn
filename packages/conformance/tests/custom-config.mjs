// Custom-config differential suite: createCn / createTwMerge (cn/config)
// vs tailwind-merge's extendTailwindMerge with equivalent extensions.
import {
  createCn,
  createTwMerge,
  defaultConfig,
  mergeConfigs,
  validators,
} from "cn/config"
import {
  extendTailwindMerge,
  validators as twmValidators,
} from "tailwind-merge"

let pass = 0
let fail = 0
const report = []
const diff = (label, input, expected, actual) => {
  if (expected === actual) pass++
  else {
    fail++
    if (report.length < 30) report.push({ label, input, expected, actual })
  }
}
const compare = (label, ours, theirs, cases) => {
  for (const input of cases) diff(label, input, theirs(input), ours(input))
}

// 1. extend classGroups with literals
{
  const ext = {
    extend: { classGroups: { "font-size": [{ text: ["hero", "tiny"] }] } },
  }
  compare("extend-literals", createCn(ext), extendTailwindMerge(ext), [
    "text-hero text-lg",
    "text-lg text-hero",
    "text-tiny text-hero",
    "text-hero text-red-500",
    "text-red-500 text-hero leading-6",
    "text-hero/7 text-lg",
    "hover:text-hero hover:text-sm",
    "text-hero text-hero",
  ])
}

// 2. extend a theme scale
{
  const ext = { extend: { theme: { text: ["huge"] } } }
  compare("extend-theme", createCn(ext), extendTailwindMerge(ext), [
    "text-huge text-lg",
    "text-lg text-huge",
    "text-huge text-[#333]",
    "md:text-huge md:text-sm",
    "text-huge/8 leading-4",
  ])
}

// 3. custom validator function (same fn both sides)
{
  const isVw = (v) => v.endsWith("vw")
  const ext = { extend: { classGroups: { "font-size": [{ text: [isVw] }] } } }
  compare("custom-validator-fn", createCn(ext), extendTailwindMerge(ext), [
    "text-12vw text-lg",
    "text-lg text-12vw",
    "text-12vw text-14vw",
    "text-12vw text-red-500",
    "text-vw text-lg",
  ])
}

// 4. marker validators vs tailwind-merge validator functions
{
  const ours = createCn({
    extend: { classGroups: { shadow: [{ shadow: [validators.isNumber] }] } },
  })
  const theirs = extendTailwindMerge({
    extend: { classGroups: { shadow: [{ shadow: [twmValidators.isNumber] }] } },
  })
  compare("marker-validators", ours, theirs, [
    "shadow-99 shadow-lg",
    "shadow-lg shadow-99",
    "shadow-99 shadow-3.5",
    "shadow-99 shadow-red-500",
    "shadow-x shadow-99",
  ])
}

// 5. new groups + conflictingClassGroups extension
{
  const ext = {
    extend: {
      classGroups: { foo: ["foo-a", "foo-b"], bar: ["bar-x", "bar-y"] },
      conflictingClassGroups: { foo: ["bar"] },
    },
  }
  compare("extend-conflicts", createCn(ext), extendTailwindMerge(ext), [
    "bar-x foo-a",
    "foo-a bar-x",
    "foo-a foo-b",
    "bar-x bar-y foo-b",
    "hover:bar-x hover:foo-a",
    "foo-a p-2 bar-y",
  ])
}

// 6. override semantics
{
  const ext = { override: { classGroups: { shadow: ["shadow-custom"] } } }
  compare("override", createCn(ext), extendTailwindMerge(ext), [
    "shadow-custom shadow-lg",
    "shadow-lg shadow-custom",
    "shadow-custom shadow-custom",
    "shadow-sm shadow",
    "shadow-custom text-lg",
  ])
}

// 7. prefix
{
  const ours = createCn({ prefix: "tw" })
  const theirs = extendTailwindMerge({ prefix: "tw" })
  compare("prefix", ours, theirs, [
    "tw:p-2 tw:p-4",
    "p-2 tw:p-4",
    "tw:p-2 p-4",
    "tw:hover:p-2 tw:hover:p-4",
    "tw:p-2! tw:!p-4",
    "tw:hover:md:p-2 tw:md:hover:p-4",
    "tw: tw:p-2",
    "tww:p-2 tw:p-4",
    "tw:foo tw:bar",
    "tw:-mt-2 tw:mt-4",
    "tw:text-lg/7 tw:text-xl",
    "tw:[color:red] tw:[color:blue]",
  ])
}

// 8. function-form config (identity transform must equal default behavior)
{
  const ours = createCn((config) => config)
  const theirs = extendTailwindMerge((config) => config)
  compare("function-form", ours, theirs, [
    "p-2 px-4 p-6",
    "text-lg/7 leading-6",
    "hover:md:p-2 md:hover:p-4",
  ])
}

// 9. createTwMerge variadic shape
{
  const ours = createTwMerge({
    extend: { classGroups: { "font-size": [{ text: ["hero"] }] } },
  })
  const theirs = extendTailwindMerge({
    extend: { classGroups: { "font-size": [{ text: ["hero"] }] } },
  })
  const cases = [
    [["text-hero", "text-lg"]],
    [["p-2", ["px-4", false, ["py-1"]], null, "text-hero"]],
    [[0, undefined, ""]],
  ]
  for (const [argsArr] of cases) {
    diff(
      "createTwMerge",
      JSON.stringify(argsArr),
      theirs(...argsArr),
      ours(...argsArr)
    )
  }
}

// 10. mini-fuzz over an extended config
{
  const ext = {
    extend: {
      classGroups: {
        "font-size": [{ text: ["hero", "tiny"] }],
        foo: ["foo-a", "foo-b"],
      },
      conflictingClassGroups: { foo: ["bar"] },
      theme: { text: ["huge"] },
    },
  }
  const ours = createCn(ext)
  const theirs = extendTailwindMerge(ext)
  const pool = [
    "text-hero",
    "text-tiny",
    "text-huge",
    "text-lg",
    "text-sm",
    "text-[22px]",
    "foo-a",
    "foo-b",
    "p-2",
    "px-4",
    "hover:text-hero",
    "md:text-huge",
    "text-hero/7",
    "leading-6",
    "!text-hero",
    "text-hero!",
    "unknown-x",
  ]
  let seed = 0xabcdef
  const rnd = () => {
    seed ^= seed << 13
    seed >>>= 0
    seed ^= seed >> 17
    seed ^= seed << 5
    seed >>>= 0
    return seed / 0x100000000
  }
  for (let i = 0; i < 5000; i++) {
    const len = 1 + Math.floor(rnd() * 6)
    const parts = []
    for (let k = 0; k < len; k++)
      parts.push(pool[Math.floor(rnd() * pool.length)])
    const s = parts.join(" ")
    diff("ext-fuzz", s, theirs(s), ours(s))
  }
}

// 11. defaultConfig() / mergeConfigs exports behave sanely
{
  const cfg = defaultConfig()
  if (!cfg.classGroups.display) {
    fail++
    report.push({
      label: "defaultConfig",
      input: "-",
      expected: "display group",
      actual: "missing",
    })
  } else pass++
  const merged = mergeConfigs(defaultConfig(), {
    extend: { classGroups: { display: ["zzz"] } },
  })
  const ours = createCn(merged)
  diff(
    "mergeConfigs",
    "zzz block",
    extendTailwindMerge({ extend: { classGroups: { display: ["zzz"] } } })(
      "zzz block"
    ),
    ours("zzz block")
  )
}

// 12. extend with a single class definition instead of an array
{
  const ext = {
    extend: {
      classGroups: { "border-w": { border: ["hairline"] } },
      theme: { text: "huge" },
    },
  }
  compare("extend-single-definition", createCn(ext), extendTailwindMerge(ext), [
    "border-hairline border-2",
    "border-2 border-hairline",
    "border-hairline border-hairline",
    "border-hairline border-x-2",
    "text-huge text-lg",
    "text-lg text-huge",
    "text-huge text-[#333]",
  ])
}

console.log(`custom-config: pass ${pass}  fail ${fail}`)
for (const r of report) {
  console.log(`DIFF [${r.label}] input=${JSON.stringify(r.input)}`)
  console.log(`     twMerge = ${JSON.stringify(r.expected)}`)
  console.log(`     cn      = ${JSON.stringify(r.actual)}`)
}
process.exit(fail > 0 ? 1 : 0)
