/* eslint-disable no-console */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
const LOGO = path.resolve(__dirname, "../public/assets/images/logo-amococ.png");

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
    await page.screenshot({ path: `scripts/fail-${results.length}.png`, fullPage: true }).catch(() => {});
  }
}

/** getByText com .first() para evitar strict mode. */
const T = (text) => page.getByText(text).first();

async function login(user, pass) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', user);
  await page.fill('input[name="password"]', pass);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 8000 });
}

async function logout() {
  const headerMenu = page.locator("header button").last();
  await headerMenu.click({ timeout: 8000 });
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await page.waitForURL("**/login", { timeout: 8000 });
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
page = await context.newPage();
page.on("pageerror", (e) => console.log("  [pageerror]", String(e).slice(0, 200)));

console.log("\n== 1. LOGIN ==");
await step("Login com amococ/123", async () => {
  await login("amococ", "123");
  await T("Total de associados").waitFor({ timeout: 8000 });
});

console.log("\n== 2. DASHBOARD ==");
await step("Dashboard exibe KPIs e atividade", async () => {
  await T("Associados ativos").waitFor();
  await T("Carteirinhas emitidas").waitFor();
  await T("Atividade recente").waitFor();
});

console.log("\n== 3. ASSOCIADOS ==");
await step("Lista mostra associados do seed", async () => {
  await page.click('a[href="/associados"]');
  await T("João da Silva").waitFor({ timeout: 5000 });
  await T("AMOCOC-00001-A8ZK").waitFor();
});

let matriculaA;
let codeA;
await step("Novo associado: matrícula e código automáticos e bloqueados", async () => {
  await page.click('a[href="/associados/novo"]');
  await page.waitForURL("**/associados/novo");
  const matInput = page.locator('input[name="membershipNumber"]');
  const codeInput = page.locator('input[name="cardCode"]');
  await matInput.waitFor({ timeout: 5000 });
  matriculaA = await matInput.inputValue();
  codeA = await codeInput.inputValue();
  if (!/^\d{6}$/.test(matriculaA)) throw new Error("matrícula inválida: " + matriculaA);
  if (!/^AMOCOC-\d{5}-[A-Z0-9]{4}$/.test(codeA)) throw new Error("código inválido: " + codeA);
  const ro1 = await matInput.getAttribute("readonly");
  const ro2 = await codeInput.getAttribute("readonly");
  if (ro1 === null) throw new Error("matrícula não está bloqueada");
  if (ro2 === null) throw new Error("código não está bloqueado");
});

let detailUrlA;
await step("Criar associado A com sucesso", async () => {
  await page.fill('input[name="fullName"]', "Teste Automatizado Silva");
  await page.fill('input[name="cpf"]', "529.982.247-25");
  await page.fill('input[name="phone"]', "(85) 99999-0001");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/associados\/[0-9a-f-]{36}$/, { timeout: 8000 });
  detailUrlA = page.url();
  await T("Teste Automatizado Silva").waitFor();
});

await step("Detalhe exibe matrícula e código do associado A", async () => {
  await page.goto(detailUrlA);
  await T(matriculaA).waitFor({ timeout: 5000 });
  await T(codeA).waitFor();
});

await step("Inativar preserva matrícula e código", async () => {
  await page.goto(detailUrlA);
  await page.locator('button:has-text("Inativar associado")').click();
  await page.getByRole("button", { name: "Inativar", exact: true }).click();
  await T("Inativo").waitFor({ timeout: 5000 });
  const mat = await page.locator("dt:has-text('Matrícula') + dd").first().textContent();
  const cod = await page.locator("dt:has-text('Código da carteirinha') + dd").first().textContent();
  if (!mat.includes(matriculaA)) throw new Error("matrícula mudou: " + mat);
  if (!cod.includes(codeA)) throw new Error("código mudou: " + cod);
});

let codeB;
await step("Criar associado B: código diferente (sem reutilização)", async () => {
  await page.goto(BASE + "/associados/novo");
  const codeInput = page.locator('input[name="cardCode"]');
  await codeInput.waitFor();
  codeB = await codeInput.inputValue();
  if (codeB === codeA) throw new Error("código reutilizado: " + codeB);
  await page.fill('input[name="fullName"]', "Teste Automatizado Souza");
  await page.fill('input[name="phone"]', "(85) 99999-0002");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/associados\/[0-9a-f-]{36}$/, { timeout: 8000 });
});

const urlB = page.url();

console.log("\n== 4. CARTEIRINHA BLOQUEADA SEM ASSINATURA ==");
await step("Gerar sem assinatura é bloqueado com mensagem + atalho", async () => {
  await page.goto(urlB);
  await page.locator('button:has-text("Gerar carteirinha")').first().click();
  await T("assinatura oficial do Presidente ainda não foi cadastrada").waitFor({ timeout: 8000 });
  await page.getByRole("button", { name: /Ir para Configurações/ }).first().waitFor();
});

console.log("\n== 5. ASSINATURA OFICIAL ==");
await step("Upload da assinatura oficial", async () => {
  await page.getByRole("button", { name: /Ir para Configurações/ }).first().click();
  await page.waitForURL("**/configuracoes/assinatura", { timeout: 5000 });
  await page.locator('input[type="file"]').setInputFiles(LOGO);
  await page.locator('button:has-text("Salvar assinatura")').click();
  await T("ASSINATURA CONFIGURADA").waitFor({ timeout: 8000 });
  await page.waitForTimeout(600);
});

console.log("\n== 6. GERAÇÃO + PNG ==");
let downloadedName = "";
await step("Gerar carteirinha com assinatura automática + baixar PNG", async () => {
  await page.goto(urlB);
  await page.locator('button:has-text("Gerar carteirinha")').first().click();
  await T("CARTEIRINHA GERADA COM SUCESSO").waitFor({ timeout: 25000 });
  const sig = page.locator('img[alt="Assinatura oficial do Presidente"]');
  await sig.first().waitFor({ timeout: 5000 });
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 20000 }),
    page.getByRole("button", { name: /BAIXAR PNG/ }).first().click(),
  ]);
  downloadedName = download.suggestedFilename();
  if (!/^AMOCOC-\d{5}-[A-Z0-9]{4}-.+\.png$/.test(downloadedName)) {
    throw new Error("nome de arquivo inválido: " + downloadedName);
  }
  await page.locator('[aria-label="Fechar"]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
});

console.log("\n== 7. CARTEIRINHAS EMITIDAS ==");
await step("Tela de carteirinhas lista a emissão", async () => {
  await page.goto(BASE + "/carteirinhas");
  await T(codeB).waitFor({ timeout: 5000 });
});

console.log("\n== 8. USUÁRIOS E PERMISSÕES ==");
await step("Criar usuário com permissões limitadas", async () => {
  await page.goto(BASE + "/usuarios");
  await page.getByRole("button", { name: /Novo usuário/ }).first().click();
  await page.fill('input[name="name"]', "Usuario Teste Permissoes");
  await page.fill('input[name="login"]', "testeperm");
  await page.fill('input[name="email"]', "teste@amococ.local");
  await page.fill('input[name="initialPassword"]', "1234");
  await page.selectOption('select[name="role"]', "COLABORADOR");
  await page.getByRole("button", { name: "Criar usuário" }).click();
  await T("Usuário criado").waitFor({ timeout: 5000 });
});

await step("Conceder permissões na página Permissões", async () => {
  await page.goto(BASE + "/usuarios/permissoes");
  const sel = page.locator('select[aria-label="Selecionar usuário"]');
  const optValue = await sel
    .locator("option")
    .filter({ hasText: "testeperm" })
    .first()
    .getAttribute("value", { timeout: 8000 });
  if (!optValue) throw new Error("opção testeperm ausente no select");
  await sel.selectOption(optValue);
  await page.waitForTimeout(500);
  await page.locator('input[type="checkbox"]').nth(0).check(); // grupo Dashboard -> dashboard.view
  await page.getByRole("button", { name: /Salvar permissões/ }).first().click();
  await T("Permissões atualizadas").waitFor({ timeout: 5000 });
});

console.log("\n== 9. LOGIN COM USUÁRIO LIMITADO ==");
await step("Usuário limitado vê apenas as áreas permitidas", async () => {
  await logout();
  await login("testeperm", "1234");
  await T("Total de associados").waitFor({ timeout: 5000 });
  const usersLink = await page.locator('a[href="/usuarios"]').count();
  const auditLink = await page.locator('a[href="/auditoria"]').count();
  const settingsLink = await page.locator('a[href="/configuracoes"]').count();
  if (usersLink > 0) throw new Error("menu Usuários visível sem permissão");
  if (auditLink > 0) throw new Error("menu Auditoria visível sem permissão");
  if (settingsLink > 0) throw new Error("menu Configurações visível sem permissão");
});

await step("Rota protegida bloqueia acesso direto (403)", async () => {
  await page.goto(BASE + "/auditoria");
  await T("Acesso restrito").waitFor({ timeout: 5000 });
});

console.log("\n== 10. INATIVAR USUÁRIO E BLOQUEAR LOGIN ==");
await step("Inativar testeperm", async () => {
  await logout();
  await login("amococ", "123");
  await page.goto(BASE + "/usuarios");
  const row = page.locator("tr", { hasText: "testeperm" });
  await row.locator('button[aria-label="Ações do usuário"]').click();
  await page.getByRole("menuitem", { name: "Inativar" }).click();
  await page.getByRole("button", { name: "Inativar", exact: true }).click();
  await T("Usuário inativado").waitFor({ timeout: 5000 });
});

await step("Login de usuário inativo é bloqueado", async () => {
  await logout();
  await page.goto(BASE + "/login");
  await page.fill('input[name="login"]', "testeperm");
  await page.fill('input[name="password"]', "1234");
  await page.click('button[type="submit"]');
  await T("está inativo").waitFor({ timeout: 5000 });
  await page.waitForURL("**/login");
});

console.log("\n== 11. AUDITORIA ==");
await step("Auditoria registra ações reais", async () => {
  await login("amococ", "123");
  await page.goto(BASE + "/auditoria");
  await page.locator("table tbody tr").first().waitFor({ timeout: 5000 });
  const auditText = await page.locator("table tbody").innerText();
  for (const expected of [
    "Login",
    "Carteirinha gerada",
    "Associado criado",
    "Usuário criado",
    "Assinatura atualizada",
  ]) {
    if (!auditText.toLowerCase().includes(expected.toLowerCase())) {
      throw new Error(`registro "${expected}" ausente`);
    }
  }
});

console.log("\n== 12. ALTERAÇÃO DE SENHA ==");
await step("Alterar senha do SuperAdmin e relogar", async () => {
  await page.goto(BASE + "/configuracoes/seguranca");
  await page.fill('input[autocomplete="current-password"]', "123");
  const nexts = page.locator('input[autocomplete="new-password"]');
  await nexts.nth(0).fill("NovaSenha!2026");
  await nexts.nth(1).fill("NovaSenha!2026");
  await page.getByRole("button", { name: "Alterar senha" }).click();
  await T("Senha alterada com sucesso").waitFor({ timeout: 8000 });
  // auditoria registra a troca de senha (sem expor a senha)
  await page.goto(BASE + "/auditoria");
  await page.locator("table tbody tr").first().waitFor({ timeout: 5000 });
  const auditText = await page.locator("table tbody").innerText();
  if (!auditText.includes("Senha alterada")) {
    throw new Error("PASSWORD_CHANGED ausente na auditoria");
  }
  if (auditText.includes("NovaSenha!2026")) {
    throw new Error("senha exposta na auditoria!");
  }
  await logout();
  await login("amococ", "NovaSenha!2026");
  await T("Total de associados").waitFor();
});

console.log("\n== 13. PERSISTÊNCIA ==");
await step("Dados persistem após reload (aba correta por status)", async () => {
  await page.reload({ waitUntil: "networkidle" });
  await page.goto(BASE + "/associados");
  await T("Teste Automatizado Souza").waitFor({ timeout: 8000 });
  await T("João da Silva").waitFor();
  // "Teste Automatizado Silva" foi inativado: NÃO pode aparecer em ATIVOS...
  const activeRows = await page
    .locator('table tbody tr:has-text("Teste Automatizado Silva")')
    .count();
  if (activeRows > 0) {
    throw new Error("associado inativado aparece na aba ATIVOS");
  }
  // ...mas persiste (com matrícula e código) na aba INATIVOS.
  await page.locator('[data-testid="tab-INATIVO"]').click();
  await T("Teste Automatizado Silva").waitFor({ timeout: 8000 });
});

console.log("\n== 14. EDIÇÃO: CAMPOS IMUTÁVEIS ==");
await step("Edição mantém matrícula/código bloqueados", async () => {
  await page.goto(urlB + "/editar");
  const mat = page.locator('input[name="membershipNumber"]');
  await mat.waitFor({ timeout: 8000 });
  const ro = await mat.getAttribute("readonly");
  const codRo = await page.locator('input[name="cardCode"]').getAttribute("readonly");
  if (ro === null || codRo === null) throw new Error("campos não bloqueados na edição");
  await page.fill('input[name="fullName"]', "Teste Automatizado Souza Editado");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/associados\/[0-9a-f-]{36}$/, { timeout: 8000 });
  await T("Teste Automatizado Souza Editado").waitFor();
});

const passed = results.filter((r) => r.pass).length;
const total = results.length;
console.log(`\n========== RESULTADO: ${passed}/${total} testes passaram ==========`);
for (const r of results.filter((x) => !x.pass)) console.log(`FALHOU: ${r.name} -> ${r.err}`);

await browser.close();
process.exit(passed === total ? 0 : 1);
