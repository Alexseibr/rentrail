import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import jsxA11yPlugin from "eslint-plugin-jsx-a11y";
import reactPlugin from "eslint-plugin-react";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.expo/**",
      "**/build/**",
      "**/*.generated.*",
      "lib/api-client/**",
      "lib/api-client-react/**",
      "lib/api-zod/**",
      // Skill templates and platform tooling — not our application code
      ".local/**",
      // Playwright Python runtime installed by Replit — not our application code
      ".pythonlibs/**",
      // Replit auth templates — not our application code
      ".replit-auth/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
    },
  },
  {
    files: [
      "artifacts/api-server/src/**/*.ts",
      "lib/db/src/**/*.ts",
      "lib/api-spec/**/*.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: [
      "artifacts/platform-admin/src/**/*.ts",
      "artifacts/platform-admin/src/**/*.tsx",
      "artifacts/staff-app/app/**/*.ts",
      "artifacts/staff-app/app/**/*.tsx",
    ],
    plugins: {
      "react-hooks": reactHooksPlugin,
      react: reactPlugin,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react/jsx-key": "error",
    },
  },
  {
    files: [
      "artifacts/platform-admin/src/**/*.tsx",
      "artifacts/platform-admin/src/**/*.jsx",
    ],
    plugins: {
      "jsx-a11y": jsxA11yPlugin,
    },
    rules: {
      ...jsxA11yPlugin.flatConfigs.recommended.rules,
    },
  },
];
