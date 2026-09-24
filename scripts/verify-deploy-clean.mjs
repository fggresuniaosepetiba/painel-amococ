/* eslint-disable no-console */
/**
 * DEPLOY LIMPO — verifica o estado de PRIMEIRA UTILIZAÇÃO do build de
 * produção (é o que o cliente recebe quando o deploy é feito).
 *
 * Pré-requisito: `npm run build` (usa /dist).
 * O script sobe o `vite preview` na porta 4173 se ninguém estiver lá.
 *
 * TESTE 1 — primeira abertura cria o banco (v2) e roda o seed de produção
 * TESTE 2 — base ZERO: users=1, settings=1, members=0,
 *           usedIdentifiers=0, cards=0, audit=0
 * TESTE 3 — assinatura oficial pré-cadastrada (PNG transparente, processado
 *           como o envio pela tela)
 * TESTE 4 — login do SuperAdmin (amococ/123) funciona
 * TESTE 5 — Associados: abas ATIVOS (0) e INATIVOS (0)
 * TESTE 6 — Carteirinhas: nenhuma emitida
 * TESTE 7 — Tela de Assinatura: ASSINATURA CONFIGURADA + prévia visível
 *           (trocar/arrastar/remover seguem liberados na própria tela)
 * TESTE 8 — após navegar: contagens seguem zero e a auditoria só tem o
 *           LOGIN real (nenhum registro de demonstração)
 *
 * Screenshots: scripts/shots/deploy-0{1,2,3}-*.png
 */
import { chromium } from "playwright";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve(__dirname, "shots");

const results = [];
let page;
function ok(name) {
  results.push({ name, pass: true });
  console.log(`  ✔ ${name}`);
}
function fail(name, err) {
  const msg = String(err?.message ?? err).slice(0, 900);
  results.push({ name, pass: false, err: msg });
  console.log(`  ✘ ${name} :: ${msg}`);
}
async function step(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (err) {
    fail(name, err);
    await page
      .screenshot({ path: `scripts/fail-deploy-${results.length}.png`, fullPage: true })
      .catch(() => {});
  }
}

/** Leitura direta das contagens da IndexedDB (somente leitura). */
async function dbCounts() {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("amococ_db");
        req.onerror = () => reject(new Error("Falha ao abrir amococ_db"));
        req.onsuccess = () => {
          const idb = req.result;
          const names = ["users", "members", "cards", "settings", "audit", "usedIdentifiers"];
          const out = {};
          let pending = names.length;
          let closed = false;
          const done = () => {
            if (--pending === 0 && !closed) {
              closed = true;
              idb.close();
              resolve(out);
            }
          };
          for (const name of names) {
            try {
              const r = idb.transaction(name, "readonly").objectStore(name).count();
              r.onsuccess = () => {
                out[name] = r.result;
                done();
              };
              r.onerror = () => {
                if (!closed) {
                  closed = true;
                  idb.close();
                  reject(new Error("count " + name));
                }
              };
            } catch (e) {
              if (!closed) {
                closed = true;
                idb.close();
                reject(e);
              }
            }
          }
        };
      })
  );
}

async function dbSignature() {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("amococ_db");
        req.onerror = () => reject(new Error("Falha ao abrir amococ_db"));
        req.onsuccess = () => {
          const idb = req.result;
          const r = idb.transaction("settings", "readonly").objectStore("settings").get("general");
          r.onsuccess = () => {
            idb.close();
            resolve(r.result ? r.result.signature : null);
          };
          r.onerror = () => {
            idb.close();
            reject(new Error("get settings"));
          };
        };
      })
  );
}

async function dbAuditActions() {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const req = indexedDB.open("amococ_db");
        req.onerror = () => reject(new Error("Falha ao abrir amococ_db"));
        req.onsuccess = () => {
          const idb = req.result;
          const r = idb.transaction("audit", "readonly").objectStore("audit").getAll();
          r.onsuccess = () => {
            idb.close();
            resolve((r.result || []).map((row) => row.action));
          };
          r.onerror = () => {
            idb.close();
            reject(new Error("getAll audit"));
          };
        };
      })
  );
}

/** Garante o servidor do build de produção (inicia se necessário). */
let preview = null;
async function ensurePreview() {
  if (!fs.existsSync(path.join(ROOT, "dist", "index.html"))) {
    throw new Error("/dist não encontrado — rode `npm run build` antes.");
  }
  try {
    const res = await fetch(BASE + "/", { signal: AbortSignal.timeout(2500) });
    if (res.ok) return;
  } catch {
    /* sobe abaixo */
  }
  const viteBin = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  preview = spawn(process.execPath, [viteBin, "preview", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(BASE + "/");
      if (r.ok) return;
    } catch {
      /* tenta de novo */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`vite preview não subiu em ${BASE}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
page = await context.newPage();

try {
  await ensurePreview();

  console.log("\n== TESTE 1 ==");
  await step("TESTE 1 — primeira abertura cria banco (v2) e roda o seed de produção", async () => {
    await page.goto(BASE + "/login", { waitUntil: "networkidle" });
    await page.waitForFunction(
      async () => {
        const dbs = await indexedDB.databases();
        const d = (dbs || []).find((x) => x.name === "amococ_db");
        return Boolean(d && d.version >= 2);
      },
      { timeout: 15000 }
    );
    // seed concluído quando SuperAdmin (1) e configurações (1) existem
    let seeded = false;
    for (let i = 0; i < 80; i++) {
      const c = await dbCounts();
      if (c.users === 1 && c.settings === 1) {
        seeded = true;
        break;
      }
      await page.waitForTimeout(250);
    }
    if (!seeded) throw new Error("seed não concluiu (users/settings)");
  });

  console.log("\n== TESTE 2 ==");
  await step(
    "TESTE 2 — base ZERO: sem associados, códigos usados, carteirinhas ou auditoria",
    async () => {
      const counts = await dbCounts();
      const expect = {
        users: 1,
        settings: 1,
        members: 0,
        usedIdentifiers: 0,
        cards: 0,
        audit: 0,
      };
      for (const [key, value] of Object.entries(expect)) {
        if (counts[key] !== value) {
          throw new Error(`${key}=${counts[key]} (esperado ${value}) — ${JSON.stringify(counts)}`);
        }
      }
    }
  );

  console.log("\n== TESTE 3 ==");
  await step("TESTE 3 — assinatura oficial pré-cadastrada (PNG, processada como o envio)", async () => {
    const sig = await dbSignature();
    if (!sig || !sig.imageDataUrl) throw new Error("assinatura ausente nas configurações");
    if (!sig.imageDataUrl.startsWith("data:image/png")) {
      throw new Error(`tipo inesperado: ${sig.imageDataUrl.slice(0, 40)}`);
    }
    if (sig.imageDataUrl.length < 20_000) {
      throw new Error(`assinatura pequena demais: ${sig.imageDataUrl.length} chars`);
    }
    if (sig.mimeType !== "image/png") throw new Error(`mimeType=${sig.mimeType}`);
  });

  console.log("\n== TESTE 4 ==");
  await step("TESTE 4 — login do SuperAdmin (amococ/123) funciona", async () => {
    await page.fill('input[name="login"]', "amococ");
    await page.fill('input[name="password"]', "123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 8000 });
    await page.screenshot({ path: path.join(OUT, "deploy-01-dashboard.png") });
  });

  console.log("\n== TESTE 5 ==");
  await step("TESTE 5 — Associados: abas ATIVOS (0) e INATIVOS (0)", async () => {
    await page.goto(BASE + "/associados", { waitUntil: "networkidle" });
    const ativos = (await page.getByTestId("count-ATIVO").innerText()).trim();
    const inativos = (await page.getByTestId("count-INATIVO").innerText()).trim();
    if (ativos !== "0") throw new Error(`contagem ATIVOS=${ativos} (esperado 0)`);
    if (inativos !== "0") throw new Error(`contagem INATIVOS=${inativos} (esperado 0)`);
    await page.screenshot({ path: path.join(OUT, "deploy-02-associados.png") });
  });

  console.log("\n== TESTE 6 ==");
  await step("TESTE 6 — Carteirinhas: nenhuma emitida", async () => {
    await page.goto(BASE + "/carteirinhas", { waitUntil: "networkidle" });
    const codes = await page.getByText(/AMOCOC-\d{5}/).count();
    if (codes > 0) throw new Error(`${codes} códigos de carteirinha visíveis`);
  });

  console.log("\n== TESTE 7 ==");
  await step("TESTE 7 — Assinatura configurada na tela (trocar/mover/remover liberados)", async () => {
    await page.goto(BASE + "/configuracoes/assinatura", { waitUntil: "networkidle" });
    await page.getByText("ASSINATURA CONFIGURADA").first().waitFor({ timeout: 8000 });
    const img = page.locator('img[alt="Assinatura oficial do Presidente"]');
    await img.first().waitFor({ timeout: 8000 });
    await page.screenshot({ path: path.join(OUT, "deploy-03-assinatura.png") });
  });

  console.log("\n== TESTE 8 ==");
  await step(
    "TESTE 8 — após navegar: contagens zeradas e auditoria só com LOGIN real",
    async () => {
      const counts = await dbCounts();
      if (counts.members !== 0 || counts.usedIdentifiers !== 0 || counts.cards !== 0) {
        throw new Error(
          `members=${counts.members} usedIdentifiers=${counts.usedIdentifiers} cards=${counts.cards}`
        );
      }
      const actions = await dbAuditActions();
      const unexpected = actions.filter((a) => a !== "LOGIN");
      if (unexpected.length) throw new Error(`ações inesperadas: ${unexpected.join(", ")}`);
      if (actions.length < 1) throw new Error("evento de LOGIN não registrado");
    }
  );
} catch (err) {
  fail("Execução geral", err);
} finally {
  await browser.close().catch(() => {});
  if (preview) preview.kill();
}

const passed = results.filter((r) => r.pass).length;
const total = results.length;
console.log(
  `\n========== RESULTADO: ${passed}/${total} verificações de deploy limpo passaram ==========`
);
for (const r of results.filter((x) => !x.pass)) {
  console.log(`FALHOU: ${r.name} -> ${r.err}`);
}
process.exit(passed === total && total > 0 ? 0 : 1);
