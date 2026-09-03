export { clsx, cn, twJoin, twMerge } from "./pico.js"
export { createEngine } from "./engine.js"

// Custom configs live at "cn/config" (createCn, createTwMerge, fromTheme,
// validators) — a separate entry so the compiler and default-config data
// never enter this one's bundle graph. Compiled project tables pair with
// createCn from "cn/engine". Types come from compiler.ts, not config.ts:
// importing config.ts here would split its declarations into a shared chunk
// whose filename can collide with the `cn/config` entry's own d.ts.
export type { CnConfig, ConfigExtension, CreateCnInput } from "./compiler.js"

export type {
  ClassArray,
  ClassDictionary,
  ClassNameArray,
  ClassNameValue,
  ClassValue,
  CnFunction,
  Engine,
  EngineOptions,
  Tables,
  ValidatorImpls,
} from "./types.js"
