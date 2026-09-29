/* eslint-disable no-console */
/**
 * TESTES OBRIGATÓRIOS — SEGURANÇA DE SESSÃO (LGPD)
 *
 * REGRA PRINCIPAL: 15 minutos de inatividade → logout automático;
 * fechar a aba → a próxima abertura exige login novamente.
 *
 * TESTE 1 — constante oficial de 15 minutos registrada (900.000 ms)
 * TESTE 2 — sessão vive em sessionStorage (por ABA), nunca em localStorage
 * TESTE 3 — recarregar a página MANTÉM a sessão (mesma aba)
 * TESTE 4 — fechar a aba: nova aba exige login novamente
 * TESTE 5 — atividade do usuário reinicia a contagem de inatividade
 * TESTE 6 — inatividade → logout automático + aviso na tela de login
 *
 * Observação: os testes 5 e 6 encurtam o limite para 4 s apenas em
 * desenvolvimento (sessionGuard.setIdleLimitForTests) — a regra de
 * produção permanece 15 minutos.
 *
 * Requer servidor de desenvolvimento rodando (pnpm dev).
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
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
      .screenshot({ path: `scripts/fail-security-${results.length}.png`, fullPage: true })
      .catch(() => {});
  }
}

async function login(user, pass) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 8000 });
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
page = await context.newPage();
page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 200)));

await login("amococ", "123");
await page.waitForFunction(() => Boolean(window.__amococTest), { timeout: 8000 });

console.log("\n== TESTE 1 ==");
await step("TESTE 1 — regra oficial de 15 minutos registrada (900.000 ms)", async () => {
  const limit = await page.evaluate(() => window.__amococTest.sessionGuard.IDLE_LIMIT_MS);
  if (limit !== 15 * 60 * 1000) {
    throw new Error(`limite oficial é ${limit} ms — esperado 900000 (15 min)`);
  }
});

console.log("\n== TESTE 2 ==");
await step("TESTE 2 — sessão é POR ABA: sessionStorage e nunca localStorage", async () => {
  const storage = await page.evaluate(() => ({
    sessionTab: sessionStorage.getItem("amococ.session"),
    sessionGlobal: localStorage.getItem("amococ.session"),
  }));
  if (!storage.sessionTab) throw new Error("sessão ausente no sessionStorage");
  if (storage.sessionGlobal) {
    throw new Error("sessão encontrada no localStorage (deveria ser só por aba)");
  }
});

console.log("\n== TESTE 3 ==");
await step("TESTE 3 — recarregar a página mantém a sessão (mesma aba)", async () => {
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForURL("**/dashboard", { timeout: 8000 });
  const stillThere = await page.evaluate(() =>
    Boolean(sessionStorage.getItem("amococ.session"))
  );
  if (!stillThere) throw new Error("reload derrubou a sessão da mesma aba");
});

console.log("\n== TESTE 4 ==");
await step("TESTE 4 — fechar a aba: nova aba exige login novamente", async () => {
  const page2 = await context.newPage();
  await page2.goto(BASE + "/dashboard");
  await page2.waitForURL("**/login", { timeout: 8000 }); // sem sessão → login
  const fieldVisible = await page2.locator('input[name="login"]').isVisible();
  if (!fieldVisible) throw new Error("nova aba não exibiu a tela de login");
  const inherited = await page2.evaluate(() =>
    sessionStorage.getItem("amococ.session")
  );
  if (inherited) throw new Error("sessão vazou para outra aba");
  await page2.close();
  // a aba original (ainda aberta) segue logada
  if (!page.url().includes("/dashboard")) {
    throw new Error("aba original perdeu a sessão sem fechar");
  }
});

console.log("\n== TESTE 5 ==");
await step("TESTE 5 — atividade reinicia a contagem de inatividade", async () => {
  // primeira atividade zera a contagem AGORA...
  await page.mouse.move(6, 6);
  // ...e só então o limite é encurtado para 4 s (apenas em dev/teste)
  await page.evaluate(() =>
    window.__amococTest.sessionGuard.setIdleLimitForTests(4000)
  );
  await page.waitForTimeout(2500); // < 4 s desde a última atividade
  if (!page.url().includes("/dashboard")) {
    throw new Error("sessão expirou mesmo com atividade dentro do limite");
  }
  const alive = await page.evaluate(() =>
    Boolean(sessionStorage.getItem("amococ.session"))
  );
  if (!alive) throw new Error("sessão removida mesmo com atividade recente");
});

console.log("\n== TESTE 6 ==");
await step("TESTE 6 — inatividade → logout automático + aviso na tela de login", async () => {
  // sem nenhuma atividade a partir daqui: > 4 s → logout
  await page.waitForURL("**/login", { timeout: 15000 });
  const notice = page.locator('[data-testid="idle-logout-notice"]');
  await notice.waitFor({ timeout: 5000 });
  const text = await notice.innerText();
  if (!text.includes("Sessão encerrada por inatividade.")) {
    throw new Error(`aviso fora do padrão: "${text.slice(0, 120)}"`);
  }
  if (!text.includes("15 minutos")) {
    throw new Error("aviso não explica o limite de 15 minutos (LGPD)");
  }
  await page.screenshot({ path: path.join(OUT, "login-idle-logout.png") });

  // sessão realmente encerrada
  const sessionGone = await page.evaluate(() =>
    sessionStorage.getItem("amococ.session")
  );
  if (sessionGone) throw new Error("sessão continua presente após expiração");

  // o aviso é exibido UMA única vez (consumido)
  await page.reload({ waitUntil: "networkidle" });
  const again = await page.locator('[data-testid="idle-logout-notice"]').count();
  if (again > 0) throw new Error("aviso persistiu após novo carregamento");
});

const passed = results.filter((r) => r.pass).length;
const total = results.length;
console.log(
  `\n========== RESULTADO: ${passed}/${total} testes de segurança de sessão passaram ==========`
);
for (const r of results.filter((x) => !x.pass)) {
  console.log(`FALHOU: ${r.name} -> ${r.err}`);
}

await browser.close();
process.exit(passed === total ? 0 : 1);
