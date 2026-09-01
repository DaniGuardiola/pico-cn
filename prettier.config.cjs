// Mirrors shadcn-ui/ui's prettier.config.cjs, minus the Tailwind plugin and
// the app-specific import-order aliases (no Next.js/React code here).
/** @type {import('prettier').Config} */
module.exports = {
  endOfLine: "lf",
  semi: false,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "es5",
  printWidth: 80,
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  overrides: [
    {
      files: "**/*",
      excludeFiles: "packages/cn/src/**",
      options: {
        importOrder: [
          "<BUILTIN_MODULES>",
          "<THIRD_PARTY_MODULES>",
          "",
          "^[./]",
        ],
        importOrderParserPlugins: ["typescript"],
      },
    },
    {
      // engine sources: import order is part of the size budget — reordering
      // modules changes bundle layout and costs ~40 gzipped bytes against a
      // gate with ~13 bytes of headroom. Format, but don't sort.
      files: "packages/cn/src/**/*.ts",
      options: {
        plugins: [],
      },
    },
  ],
}
