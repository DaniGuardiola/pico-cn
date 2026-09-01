// Ported from shadcn-ui/ui's .eslintrc.json to flat config (ESLint 9).
// The next/turbo/tailwindcss presets there are app-specific and don't apply
// to this repo; what carries over is the TS parser setup and `prettier` last.
import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import globals from "globals"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: [
      "**/dist/",
      "**/node_modules/",
      "**/*.generated.ts",
      ".research/",
      ".plans/",
      ".claude/",
      ".deepsec/",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // allocation-free hot paths: `arguments` avoids the rest-array allocation
    files: ["packages/cn/src/**"],
    rules: {
      "prefer-rest-params": "off",
      "prefer-spread": "off",
    },
  },
  prettier
)
