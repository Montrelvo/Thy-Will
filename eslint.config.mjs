import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/web-dist/**", "playwright-report/**", "test-results/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["tests/browser/**/*.mjs"], languageOptions: { globals: { window: "readonly", navigator: "readonly", Event: "readonly" } } },
  { files: ["**/*.mjs"], languageOptions: { globals: { console: "readonly", process: "readonly", URL: "readonly" } } },
);
