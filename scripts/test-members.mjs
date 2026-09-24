/* eslint-disable no-console */
/**
 * TESTES OBRIGATÓRIOS — Fluxo de status dos associados
 * (ATIVOS / INATIVOS / REATIVAÇÃO / EXCLUSÃO DEFINITIVA)
 *
 * TESTE 1 — novo associado nasce ATIVO, aparece em ATIVOS e não em INATIVOS
 * TESTE 2 — excluir associado ATIVO é BLOQUEADO (interface + serviço)
 * TESTE 3 — inativar move de ATIVOS para INATIVOS
 * TESTE 4 — reativar volta para ATIVOS preservando matrícula e código
 * TESTE 5 — inativar e excluir definitivamente (modal com digitação do nome)
 * TESTE 6 — após exclusão, matrícula e código NÃO são reutilizados
 * TESTE 7 — auditoria registra MEMBER_INACTIVATED/REACTIVATED/DELETED
 *
 * Requer servidor de desenvolvimento rodando (npm run dev).
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";

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
      .screenshot({ path: `scripts/fail-lifecycle-${results.length}.png`, fullPage: true })
      .catch(() => {});
  }
}

/** getByText com .first() para evitar strict mode. */
const T = (text) => page.getByText(text).first();

const NOME = "Cicero Natividade Teste";
const rowOf = (name) => page.locator(`table tbody tr:has-text("${name}")`);
const triggerOf = (name) =>
  page.locator(`button[aria-label="Ações de ${name}"]`);

const countOf = async (key) =>
  Number(await page.locator(`[data-testid="count-${key}"]`).innerText());

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

let matricula; // matrícula do associado criado (vai ser excluído)
let codigo; // código da carteirinha dele

await login("amococ", "123");

console.log("\n== TESTE 1 ==");
await step("TESTE 1 — nasce ATIVO, aparece em ATIVOS e não em INATIVOS", async () => {
  await page.click('a[href="/associados"]');
  await page.click('a[href="/associados/novo"]');
  await page.waitForURL("**/associados/novo");
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[name="membershipNumber"]');
      return el && el.value.length === 6;
    },
    { timeout: 8000 }
  );
  matricula = await page.locator('input[name="membershipNumber"]').inputValue();
  codigo = await page.locator('input[name="cardCode"]').inputValue();
  await page.fill('input[name="fullName"]', NOME);
  await page.fill('input[name="phone"]', "(85) 99999-0101");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/associados\/[0-9a-f-]{36}$/, { timeout: 8000 });
  await T(NOME).waitFor({ timeout: 5000 });
  // status ATIVO no detalhe
  await page.locator("table, div").first().waitFor().catch(() => {});
  const statusText = await page.getByText("Ativo", { exact: true }).first().isVisible();
  if (!statusText) throw new Error("badge Ativo ausente no detalhe");

  // abas: ATIVOS contém / INATIVOS não contém
  await page.goto(BASE + "/associados");
  await rowOf(NOME).waitFor({ timeout: 8000 });
  // filtro real: associado inativo do seed só existe na aba INATIVOS
  if ((await rowOf("Carlos Santos").count()) > 0) {
    throw new Error("associado inativo (Carlos) aparece na aba ATIVOS");
  }
  await page.locator('[data-testid="tab-INATIVO"]').click();
  await page.waitForTimeout(300);
  if ((await rowOf(NOME).count()) > 0) {
    throw new Error("novo associado aparece na aba INATIVOS");
  }
  await rowOf("Carlos Santos").waitFor({ timeout: 5000 });
  // contadores dinâmicos presentes
  const ativos = await countOf("ATIVO");
  const inativos = await countOf("INATIVO");
  if (!Number.isFinite(ativos) || !Number.isFinite(inativos)) {
    throw new Error("contadores das abas ausentes");
  }
});

console.log("\n== TESTE 2 ==");
await step("TESTE 2 — excluir associado ATIVO é bloqueado (UI + serviço)", async () => {
  await page.goto(BASE + "/associados"); // aba ATIVOS por padrão
  await rowOf(NOME).waitFor({ timeout: 8000 });
  await triggerOf(NOME).click();
  // 1) interface: não existe ação Excluir para ativo
  const excluirMenu = await page.getByRole("menuitem", { name: "Excluir" }).count();
  if (excluirMenu > 0) {
    throw new Error("menu Excluir visível para associado ATIVO");
  }
  const inativarMenu = await page.getByRole("menuitem", { name: "Inativar" }).count();
  if (inativarMenu !== 1) throw new Error("menu Inativar ausente para ATIVO");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);

  // 2) serviço: a camada de negócio bloqueia mesmo sem passar pela interface
  await page.waitForFunction(() => Boolean(window.__amococTest), { timeout: 8000 });
  const activeId = await page.evaluate(() => {
    const url = location.href;
    void url;
    return null;
  });
  // descobre o id pelo detalhe
  await rowOf(NOME).locator("td").first().locator("button").first().click();
  await page.waitForURL(/\/associados\/[0-9a-f-]{36}$/, { timeout: 8000 });
  const id = page.url().split("/associados/")[1];

  const result = await page.evaluate(async (memberId) => {
    try {
      await window.__amococTest.memberService.delete(
        { id: "teste", name: "Usuario Teste", role: "COLABORADOR", permissions: [] },
        memberId
      );
      return { blocked: false, message: "", stillExists: false };
    } catch (e) {
      const exists = await window.__amococTest.memberService.getById(memberId);
      return {
        blocked: true,
        message: String(e?.message ?? e),
        stillExists: Boolean(exists),
      };
    }
  }, id);

  if (!result.blocked) throw new Error("serviço PERMITIU excluir associado ATIVO");
  const esperada = "Associados ativos não podem ser excluídos. Inative o associado primeiro.";
  if (result.message !== esperada) {
    throw new Error(`mensagem incorreta: "${result.message}"`);
  }
  if (!result.stillExists) throw new Error("associado sumiu após tentativa bloqueada");
  void activeId;
});

console.log("\n== TESTE 3 ==");
await step("TESTE 3 — inativar move de ATIVOS para INATIVOS", async () => {
  await page.goto(BASE + "/associados");
  await rowOf(NOME).waitFor({ timeout: 8000 });
  const ativosAntes = await countOf("ATIVO");
  const inativosAntes = await countOf("INATIVO");

  await triggerOf(NOME).click();
  await page.getByRole("menuitem", { name: "Inativar" }).click();
  // confirmação com a mensagem especificada
  await T("Você deseja inativar este associado?").waitFor({ timeout: 5000 });
  await T("O associado será movido para a lista de inativos").waitFor();
  await page.getByRole("button", { name: "Inativar", exact: true }).click();
  await T("Associado inativado com sucesso.").waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);

  if ((await rowOf(NOME).count()) > 0) {
    throw new Error("continua na aba ATIVOS após inativar");
  }
  const ativosDepois = await countOf("ATIVO");
  const inativosDepois = await countOf("INATIVO");
  if (ativosDepois !== ativosAntes - 1) {
    throw new Error(`contador ATIVOS não caiu: ${ativosAntes} -> ${ativosDepois}`);
  }
  if (inativosDepois !== inativosAntes + 1) {
    throw new Error(`contador INATIVOS não subiu: ${inativosAntes} -> ${inativosDepois}`);
  }

  await page.locator('[data-testid="tab-INATIVO"]').click();
  await rowOf(NOME).waitFor({ timeout: 5000 });
  // data de inativação presente na lista
  const rowText = await rowOf(NOME).innerText();
  if (!rowText.includes(matricula) || !rowText.includes(codigo)) {
    throw new Error("matrícula/código não preservados na lista de inativos");
  }
});

console.log("\n== TESTE 4 ==");
await step("TESTE 4 — reativar preserva ID, matrícula e código", async () => {
  // ainda na aba INATIVOS
  await triggerOf(NOME).click();
  await page.getByRole("menuitem", { name: "Reativar" }).click();
  await T("Reativar associado?").waitFor({ timeout: 5000 });
  await T("continuará utilizando a mesma matrícula").waitFor();
  await page.getByRole("button", { name: "Reativar", exact: true }).click();
  await T("Associado reativado com sucesso.").waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);

  // saiu de INATIVOS
  if ((await rowOf(NOME).count()) > 0) {
    throw new Error("continua na aba INATIVOS após reativar");
  }
  // voltou para ATIVOS com os MESMOS identificadores
  await page.locator('[data-testid="tab-ATIVO"]').click();
  await rowOf(NOME).waitFor({ timeout: 5000 });
  const rowText = await rowOf(NOME).innerText();
  if (!rowText.includes(matricula)) {
    throw new Error(`matrícula mudou após reativar: esperada ${matricula}`);
  }
  if (!rowText.includes(codigo)) {
    throw new Error(`código mudou após reativar: esperado ${codigo}`);
  }
});

console.log("\n== TESTE 5 ==");
await step("TESTE 5 — inativar e EXCLUIR definitivamente com confirmação do nome", async () => {
  // inativar de novo (está em ATIVOS)
  await triggerOf(NOME).click();
  await page.getByRole("menuitem", { name: "Inativar" }).click();
  await page.getByRole("button", { name: "Inativar", exact: true }).click();
  await T("Associado inativado com sucesso.").waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);

  await page.locator('[data-testid="tab-INATIVO"]').click();
  await rowOf(NOME).waitFor({ timeout: 5000 });
  const inativosAntes = await countOf("INATIVO");

  // abrir modal de exclusão
  await triggerOf(NOME).click();
  await page.getByRole("menuitem", { name: "Excluir" }).click();
  await T("Excluir associado permanentemente?").waitFor({ timeout: 5000 });
  await T("Esta ação é definitiva.").waitFor();
  await T("O associado precisa estar inativo para ser excluído.").waitFor();
  await T("nunca poderão ser reutilizados").waitFor();

  const btn = page.getByRole("button", { name: "EXCLUIR DEFINITIVAMENTE" });
  if (!(await btn.isDisabled())) {
    throw new Error("botão habilitado sem digitação do nome");
  }
  await page.fill('[data-testid="delete-confirm-input"]', "Nome Errado");
  if (!(await btn.isDisabled())) {
    throw new Error("nome incorreto habilitou a exclusão");
  }
  await page.fill('[data-testid="delete-confirm-input"]', NOME);
  if (await btn.isDisabled()) {
    throw new Error("nome correto não habilitou a exclusão");
  }
  await btn.click();
  await T("Associado excluído definitivamente.").waitFor({ timeout: 8000 });
  await page.waitForTimeout(500);

  // não aparece mais em NENHUMA aba
  if ((await rowOf(NOME).count()) > 0) {
    throw new Error("continua na aba INATIVOS após exclusão");
  }
  const inativosDepois = await countOf("INATIVO");
  if (inativosDepois !== inativosAntes - 1) {
    throw new Error(`contador INATIVOS não caiu: ${inativosAntes} -> ${inativosDepois}`);
  }
  await page.locator('[data-testid="tab-ATIVO"]').click();
  await page.waitForTimeout(300);
  if ((await rowOf(NOME).count()) > 0) {
    throw new Error("continua na aba ATIVOS após exclusão");
  }
});

console.log("\n== TESTE 6 ==");
await step("TESTE 6 — matrícula e código excluídos nunca são reutilizados", async () => {
  await page.goto(BASE + "/associados/novo");
  await page.waitForURL("**/associados/novo");
  await page.waitForFunction(
    () => {
      const el = document.querySelector('input[name="membershipNumber"]');
      return el && el.value.length === 6;
    },
    { timeout: 8000 }
  );
  const mat2 = await page.locator('input[name="membershipNumber"]').inputValue();
  const code2 = await page.locator('input[name="cardCode"]').inputValue();

  if (mat2 === matricula) throw new Error(`matrícula reutilizada: ${mat2}`);
  if (code2 === codigo) throw new Error(`código reutilizado: ${code2}`);
  if (Number(mat2) <= Number(matricula)) {
    throw new Error(`sequência não avançou: ${matricula} -> ${mat2}`);
  }

  // persistência: identificadores seguem na reserva permanente
  const reservados = await page.evaluate(
    async ({ m, c }) => ({
      numero: await window.__amococTest.usedIdentifiersService.isUsed(m),
      codigo: await window.__amococTest.usedIdentifiersService.isUsed(c),
    }),
    { m: matricula, c: codigo }
  );
  if (!reservados.numero) {
    throw new Error(`matrícula ${matricula} não está reservada na base`);
  }
  if (!reservados.codigo) {
    throw new Error(`código ${codigo} não está reservado na base`);
  }
});

console.log("\n== TESTE 7 ==");
await step("TESTE 7 — auditoria registra inativação, reativação e exclusão", async () => {
  await page.goto(BASE + "/auditoria");
  await page.locator("table tbody tr").first().waitFor({ timeout: 8000 });
  const auditText = await page.locator("table tbody").innerText();
  for (const expected of [
    "Associado inativado",
    "Associado reativado",
    "Associado excluído",
  ]) {
    if (!auditText.includes(expected)) {
      throw new Error(`evento "${expected}" ausente na auditoria`);
    }
  }
  // exclusão guarda os identificadores históricos
  const linhaExclusao = page.locator('tr:has-text("Associado excluído")').first();
  const textoExclusao = await linhaExclusao.innerText();
  if (!textoExclusao.includes(matricula) || !textoExclusao.includes(codigo)) {
    throw new Error("auditoria de exclusão sem matrícula/código históricos");
  }
  // nunca registra senha
  if (auditText.includes('type="password"')) {
    throw new Error("senha exposta na auditoria");
  }
});

const passed = results.filter((r) => r.pass).length;
const total = results.length;
console.log(
  `\n========== RESULTADO: ${passed}/${total} testes do fluxo de associados passaram ==========`
);
for (const r of results.filter((x) => !x.pass)) {
  console.log(`FALHOU: ${r.name} -> ${r.err}`);
}

await browser.close();
process.exit(passed === total ? 0 : 1);
