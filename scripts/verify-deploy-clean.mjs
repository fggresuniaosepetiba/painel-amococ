/* eslint-disable no-console */
/**
 * DEPLOY LIMPO — verifica o estado de PRIMEIRA UTILIZAÇÃO do build de
 * produção (é o que o cliente recebe quando o deploy é feito).
 *
 * Pré-requisito: `pnpm build` (usa apps/web/dist) + API no ar.
 * O script sobe o `vite preview` na porta 4173 se ninguém estiver lá.
 *
 * Era API (Fases 4–5): sem IndexedDB — o estado é verificado via HTTP
 * contra a API (com JWT de SuperAdmin) e via UI. Preparação: restaura o
 * estado de fábrica via `POST /api/system/factory-reset` (qualquer sujeira
 * de baterias anteriores é limpa aqui; a senha do amococ pode ser `123`
 * ou a da bateria e2e).
 *
 * TESTE 1 — primeira abertura: preview no ar + tela de login visível +
 *           base em estado de fábrica (só amococ)
 * TESTE 2 — base ZERO via API: users=[amococ], settings=1, members=0,
 *           usedIdentifiers=0, cards=0
 * TESTE 3 — assinatura oficial pré-cadastrada (PNG, mime image/png)
 * TESTE 4 — login do SuperAdmin (amococ/123) funciona
 * TESTE 5 — Associados: abas ATIVOS (0) e INATIVOS (0)
 * TESTE 6 — Carteirinhas: nenhuma emitida
 * TESTE 7 — Tela de Assinatura: ASSINATURA CONFIGURADA + prévia visível
 *           (trocar/arrastar/remover seguem liberados na própria tela)
 * TESTE 8 — após navegar: contagens seguem zero e a auditoria só tem
 *           LOGIN real (+ SYSTEM_FACTORY_RESET da preparação)
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
const APP = path.join(ROOT, "apps", "web");
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const API = "http://localhost:3000";
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

/** HTTP contra a API (mesmo envelope {status, data} do apiClient). */
async function api(pathname, { method = "GET", body, token } = {}) {
  const res = await fetch(API + pathname, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status === "error") {
    throw new Error(
      `${method} ${pathname} → HTTP ${res.status} (${json?.code ?? "?"}) ${json?.message ?? ""}`
    );
  }
  return json.data;
}

async function loginSuperAdmin() {
  // A bateria e2e troca a senha do amococ; tenta as conhecidas.
  for (const password of ["123", "NovaSenha!2026"]) {
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: { login: "amococ", password },
      });
      return data;
    } catch {
      /* próxima */
    }
  }
  // Base sem amococ (vazia): seed de produção cria amococ/123.
  await api("/api/system/seed", { method: "POST", body: { demo: false } });
  return api("/api/auth/login", {
    method: "POST",
    body: { login: "amococ", password: "123" },
  });
}

/** Garante o servidor do build de produção (inicia se necessário). */
let preview = null;
async function ensurePreview() {
  if (!fs.existsSync(path.join(APP, "dist", "index.html"))) {
    throw new Error("/dist não encontrado — rode `pnpm build` antes.");
  }
  try {
    const res = await fetch(BASE + "/", { signal: AbortSignal.timeout(2500) });
    if (res.ok) return;
  } catch {
    /* sobe abaixo */
  }
  const viteBin = path.join(APP, "node_modules", "vite", "bin", "vite.js");
  preview = spawn(process.execPath, [viteBin, "preview", "--port", String(PORT), "--strictPort"], {
    cwd: APP,
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

let token = null;

try {
  await ensurePreview();

  // Preparação: estado de fábrica (limpa qualquer sujeira de baterias).
  const session = await loginSuperAdmin();
  await api("/api/system/factory-reset", { method: "POST", token: session.accessToken });
  const relogin = await api("/api/auth/login", {
    method: "POST",
    body: { login: "amococ", password: "123" },
  });
  token = relogin.accessToken;

  console.log("\n== TESTE 1 ==");
  await step("TESTE 1 — primeira abertura: login visível + base em estado de fábrica", async () => {
    await page.goto(BASE + "/login", { waitUntil: "networkidle" });
    await page.getByText("Acesse o painel").first().waitFor({ timeout: 15000 });
    const users = await api("/api/users", { token });
    if (users.length !== 1 || users[0].login !== "amococ") {
      throw new Error(`users inesperados: ${JSON.stringify(users.map((u) => u.login))}`);
    }
  });

  console.log("\n== TESTE 2 ==");
  await step(
    "TESTE 2 — base ZERO: sem associados, códigos usados, carteirinhas ou auditoria",
    async () => {
      const [users, members, cards, identifiers, audit] = await Promise.all([
        api("/api/users", { token }),
        api("/api/members", { token }),
        api("/api/cards", { token }),
        api("/api/used-identifiers", { token }),
        api("/api/audit?limit=100", { token }),
      ]);
      const checks = [
        ["users", users.length, 1],
        ["members", members.length, 0],
        ["cards", cards.length, 0],
        ["usedIdentifiers", identifiers.length, 0],
      ];
      for (const [key, got, want] of checks) {
        if (got !== want) throw new Error(`${key}=${got} (esperado ${want})`);
      }
      // Só o reset da preparação + o login acima.
      const actions = audit.map((row) => row.action).sort();
      for (const action of actions) {
        if (action !== "LOGIN" && action !== "SYSTEM_FACTORY_RESET") {
          throw new Error(`ação inesperada: ${action}`);
        }
      }
    }
  );

  console.log("\n== TESTE 3 ==");
  await step("TESTE 3 — assinatura oficial pré-cadastrada (PNG, processada como o envio)", async () => {
    const settings = await api("/api/settings", { token });
    const sig = settings.signature;
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
      const fresh = await api("/api/auth/login", {
        method: "POST",
        body: { login: "amococ", password: "123" },
      });
      const [members, cards, identifiers, audit] = await Promise.all([
        api("/api/members", { token: fresh.accessToken }),
        api("/api/cards", { token: fresh.accessToken }),
        api("/api/used-identifiers", { token: fresh.accessToken }),
        api("/api/audit?limit=100", { token: fresh.accessToken }),
      ]);
      if (members.length !== 0 || identifiers.length !== 0 || cards.length !== 0) {
        throw new Error(
          `members=${members.length} usedIdentifiers=${identifiers.length} cards=${cards.length}`
        );
      }
      const actions = audit.map((row) => row.action);
      const unexpected = actions.filter(
        (a) => a !== "LOGIN" && a !== "SYSTEM_FACTORY_RESET"
      );
      if (unexpected.length) throw new Error(`ações inesperadas: ${unexpected.join(", ")}`);
      if (!actions.includes("LOGIN")) throw new Error("evento de LOGIN não registrado");
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
