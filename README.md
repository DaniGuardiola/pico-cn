# pico-cn

Experimental, size-first alternative to `clsx` + `tailwind-merge`, based on
[`shadcn-ui/cn`](https://github.com/shadcn-ui/cn) and my size-first work on
[`tw-merge`](https://github.com/DaniGuardiola/tw-merge) from three years ago
(2023).

`pico-cn` keeps the familiar API while replacing the default compiled-table
engine with a compact static classifier. Goal: minimum shipped JavaScript,
accepting slower cold calls and a small number of compatibility gaps.

```ts
import { cn } from "pico-cn"

cn("px-2 py-1", active && "bg-blue-500", { "text-white": active })
```

## Current results

Measured with Node 24 on 2026-09-03. Run `pnpm size` and `pnpm bench` to measure
your machine.

| implementation        | minified | minified + gzip |
| --------------------- | -------: | --------------: |
| pico-cn               |  ~9.5 KB |         ~3.6 KB |
| upstream cn           |   ~27 KB |          ~11 KB |
| clsx + tailwind-merge |   ~27 KB |         ~8.6 KB |

## Performance

Like upstream `cn`, each implementation and workload runs in an isolated
process with its own warmup. Results use the best of five timed blocks.

| scenario                              | pico-cn | clsx + tailwind-merge | pico vs pair | upstream cn | pico vs cn  |
| ------------------------------------- | ------: | --------------------: | ------------ | ----------: | ----------- |
| common component call¹                |  104 ns |               55.5 ns | 1.9× slower  |      5.9 ns | 18× slower  |
| same classes as last render           |  8.5 ns |                9.8 ns | 1.2× faster  |      4.8 ns | 1.8× slower |
| 256 recurring strings (cache fits)    | 11.9 ns |               12.6 ns | 1.1× faster  |      4.9 ns | 2.4× slower |
| 257 recurring strings (cache cliff)   | 3.25 µs |               10.6 ns | 307× slower  |      5.0 ns | 650× slower |
| 8k recurring strings                  | 3.43 µs |               1.69 µs | 2.0× slower  |     11.1 ns | 309× slower |
| cold render, many arbitrary values    | 3.90 µs |               2.40 µs | 1.6× slower  |      690 ns | 5.6× slower |
| cold render, SSR-style unique strings | 3.47 µs |               1.75 µs | 2.0× slower  |      283 ns | 12× slower  |

¹ `cn(base, variant, condition && extra)` with stable class strings.

These numbers show the intended trade-off: pico-cn dramatically cuts shipped
JavaScript and remains competitive while its 256-entry cache fits the working
set. Crossing that boundary causes wholesale cache churn; upstream `cn` also
has a much faster uncached engine and a larger cache. Component calls, cold
inputs, and large working sets therefore expose substantial slowdowns.
Microbenchmark timings vary by machine; run `pnpm bench` for local results.

Upstream conformance suite remains intact:

- 56,351 / 56,353 main differential checks pass (99.996%).
- clsx, clsx/lite, and twJoin parity: 60,005 / 60,005.
- custom config: 5,061 / 5,061.
- CLI: 57 / 57.
- hardening and bounds regressions: 5 / 5.
- 300,000-case grammar fuzz suite stays visible in CI and currently reports
  expected mismatches for unsupported or deliberately simplified edge cases.

## Trade-offs vs full `cn`

`pico-cn` optimizes shipped size, not raw speed or exhaustive compatibility.
Compared with full upstream `cn`:

- its default bundle is about 3.5 KB gzip instead of 11 KB;
- its compact classifier is slower, especially for cold inputs or working sets
  larger than its 256-entry cache;
- it covers common Tailwind v4 utilities and passes 99.996% of the main
  differential suite, but full `cn` covers the remaining edge cases too;
- its default path does not expose full configuration. Importing
  `pico-cn/config` or `pico-cn/engine` restores the full engine and its advanced
  configuration support, along with its larger size.

## Commands

```sh
pnpm install
pnpm build
pnpm test
pnpm size
pnpm bench
pnpm report
```

`pnpm test` intentionally preserves upstream's strict parity behavior and can
fail when a documented size trade-off is exercised. GitHub Actions runs core
gates separately and presents full compatibility failures without hiding them.

## CI

- core tests run on Node 20, 22, and 24;
- compatibility suites run as visible, non-blocking reports;
- every pull request gets bundle-size and performance output in its workflow
  summary;
- scheduled runs replay 144,265 real calls from 58 repositories.

## License and credits

MIT. Original `cn` engine and test infrastructure by shadcn-ui contributors.
Size-first classifier approach based on my work on `tw-merge` from three years
ago (2023). See repository history and `LICENSE` for details.
