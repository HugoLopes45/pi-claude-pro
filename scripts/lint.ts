// ESLint cannot parse TypeScript, and typescript-eslint does not support
// TypeScript 7. Node strips the types in place, so reported lines stay exact.
import { globSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { Linter } from "eslint";

const linter = new Linter();
const config: Linter.Config = {
  files: ["**/*.ts"],
  linterOptions: { noInlineConfig: true },
  rules: { complexity: ["error", 10] },
};

for (const file of globSync("{extensions,scripts,src,test}/**/*.ts")) {
  const code = stripTypeScriptTypes(readFileSync(file, "utf8"));
  for (const message of linter.verify(code, config, file)) {
    process.exitCode = 1;
    console.error(
      `${file}:${message.line}:${message.column} ${message.message}`,
    );
  }
}
