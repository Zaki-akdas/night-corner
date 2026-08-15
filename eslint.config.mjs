import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

// Flat config (ESLint 9+). Next 16 removed the `next lint` command, so linting
// runs directly through the ESLint CLI with `npm run lint` (eslint .).
export default [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "react/self-closing-comp": ["warn", { component: true, html: true }],
      // App Router project — this rule only applies to the legacy pages/ dir.
      "@next/next/no-html-link-for-pages": "off",
      // eslint-plugin-react-hooks v7 ships React-Compiler-era rules that were
      // not part of this project's original lint standard and flag legitimate
      // React 18 patterns used throughout the codebase (env-driven state init,
      // latest-callback refs). Keep the classic rules (rules-of-hooks,
      // exhaustive-deps) enabled.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/immutability": "off",
      "jsx-a11y/anchor-is-valid": [
        "error",
        {
          components: ["Link"],
          specialLink: ["hrefLeft", "hrefRight"],
          aspects: ["invalidHref", "preferButton"],
        },
      ],
    },
  },
  prettier,
  {
    ignores: ["node_modules/", ".next/", "public/", "build/", "dist/", "prisma/", "scripts/"],
  },
];
