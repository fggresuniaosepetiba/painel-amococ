import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// @amococ/shared é importado SÓ como tipo (apagado no build). Import runtime
// quebraria o `node dist/` em produção, pois o shared não é compilado.
// Este teste falha se qualquer src usar o shared sem `import type`.
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      out.push(...sourceFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("contrato de build — @amococ/shared só como tipo", () => {
  it("nenhum src importa o shared em runtime", () => {
    const offenders: string[] = [];
    const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
    for (const file of sourceFiles(root)) {
      if (file.endsWith("shared-imports.test.ts")) continue;
      const content = readFileSync(file, "utf8");
      // Junta imports multilinha para detectar `import type` corretamente.
      const statements = content.split(";");
      for (const statement of statements) {
        if (
          statement.includes('from "@amococ/shared"') &&
          !statement.includes("import type")
        ) {
          offenders.push(`${file}: ${statement.trim().slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
