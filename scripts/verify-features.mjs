/* eslint-disable no-console */
/**
 * Verificação das melhorias: máscara de data (ano 4 dígitos + backspace
 * dígito a dígito), máscara de WhatsApp com ponto, autocompletar de CEP
 * (ViaCEP), data de nascimento sem deslocamento de fuso e assinatura
 * posicionada na linha da carteirinha.
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
const SIG = path.resolve(__dirname, "shots", "signature-test.png");
const CARD_SHOT = path.resolve(__dirname, "shots", "card-verification.png");

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? "  OK  " : "  FAIL"} ${msg}`);
  if (!cond) failures++;
};
const typeChars = async (locator, text) => {
  for (const ch of text) await locator.press(ch);
};

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();

try {
  // ---------------------------------------------------------------
  // 0) Gera uma assinatura de teste larga (640x220) via canvas
  // ---------------------------------------------------------------
  const sigPage = await context.newPage();
  await sigPage.setContent('<canvas id="c" width="640" height="220"></canvas>');
  await sigPage.evaluate(() => {
    const ctx = document.getElementById("c").getContext("2d");
    ctx.strokeStyle = "#1a3a6b";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    // Letra manuscerta com amplitude vertical realista (não um traço plano).
    ctx.beginPath();
    ctx.moveTo(35, 170);
    ctx.bezierCurveTo(60, 30, 110, 30, 130, 150);
    ctx.bezierCurveTo(145, 215, 195, 60, 240, 45);
    ctx.bezierCurveTo(280, 35, 275, 175, 320, 165);
    ctx.bezierCurveTo(360, 155, 370, 55, 415, 55);
    ctx.bezierCurveTo(460, 55, 455, 175, 505, 155);
    ctx.bezierCurveTo(545, 140, 585, 95, 615, 130);
    ctx.stroke();
  });
  await sigPage.locator("#c").screenshot({ path: SIG });
  await sigPage.close();
  console.log("assinatura de teste gerada:", SIG);

  // ---------------------------------------------------------------
  // 1) Login
  // ---------------------------------------------------------------
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', "amococ");
  await page.fill('input[name="password"]', "123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 8000 });

  // ---------------------------------------------------------------
  // 2) Formulário: data, WhatsApp e CEP
  // ---------------------------------------------------------------
  await page.goto(BASE + "/associados/novo");
  const birth = page.locator('input[name="birthDate"]');
  await birth.waitFor({ timeout: 8000 });

  // Data: digita dd/mm/1998, apaga só o "8", põe "7" → 1997
  await birth.click();
  await typeChars(birth, "05021998");
  check((await birth.inputValue()) === "05/02/1998", `data completa: ${await birth.inputValue()}`);
  await birth.press("Backspace");
  check((await birth.inputValue()) === "05/02/199", `backspace apaga 1 dígito: ${await birth.inputValue()}`);
  await birth.press("7");
  check((await birth.inputValue()) === "05/02/1997", `corrigiu 1998→1997: ${await birth.inputValue()}`);
  await typeChars(birth, "12");
  check((await birth.inputValue()) === "05/02/1997", `ano trava em 4 dígitos: ${await birth.inputValue()}`);

  // WhatsApp: (21) 9.7493-4685
  const wa = page.locator('input[name="whatsapp"]');
  await wa.click();
  await typeChars(wa, "21974934685");
  check(
    (await wa.inputValue()) === "(21) 9.7493-4685",
    `whatsapp com ponto: ${await wa.inputValue()}`
  );

  // CEP válido → autocompletar
  const cep = page.locator('input[name="cep"]');
  await cep.click();
  await typeChars(cep, "01001000");
  check((await cep.inputValue()) === "01001-000", `cep mascarado: ${await cep.inputValue()}`);
  await page.locator('input[name="address"]').focus(); // dispara blur do CEP
  await page.getByText("Endereço preenchido automaticamente").waitFor({ timeout: 12000 });
  check((await page.inputValue('input[name="address"]')) === "Praça da Sé", "CEP preencheu endereço");
  check((await page.inputValue('input[name="district"]')) === "Sé", "CEP preencheu bairro");
  check((await page.inputValue('input[name="city"]')) === "São Paulo", "CEP preencheu cidade");
  check((await page.inputValue('input[name="state"]')) === "SP", "CEP preencheu estado");
  check((await page.inputValue('input[name="addressNumber"]')) === "", "número continua vazio");
  check((await page.inputValue('input[name="complement"]')) === "", "complemento continua vazio");
  const ro = (name) => page.locator(`input[name="${name}"]`).getAttribute("readonly");
  check((await ro("address")) !== null, "endereço vem BLOQUEADO (readOnly) após CEP");
  check((await ro("district")) !== null, "bairro bloqueado após CEP");
  check((await ro("city")) !== null, "cidade bloqueada após CEP");
  check((await ro("state")) !== null, "estado bloqueado após CEP");
  check((await ro("addressNumber")) === null, "número permanece editável");
  check((await ro("complement")) === null, "complemento permanece editável");

  // CEP inexistente → aviso e campos manuais
  await cep.fill("");
  await typeChars(cep, "99999999");
  await page.locator('input[name="address"]').focus();
  await page.getByText("Não foi possível trazer o endereço").waitFor({ timeout: 12000 });
  check(
    (await page.inputValue('input[name="address"]')) === "Praça da Sé",
    "falha no CEP não apaga o endereço (fica editável)"
  );
  check(
    (await ro("address")) === null,
    "sem CEP válido → endereço destravado para digitação manual"
  );

  // Restaura CEP válido
  await cep.fill("");
  await typeChars(cep, "01001000");
  await page.locator('input[name="address"]').focus();
  await page.getByText("Endereço preenchido automaticamente").waitFor({ timeout: 12000 });

  // ---------------------------------------------------------------
  // 3) Salva e confere a data no detalhe (bug de fuso)
  // ---------------------------------------------------------------
  await page.fill('input[name="fullName"]', "Teste Nascimento Certo");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/associados\/[0-9a-f-]{36}$/, { timeout: 10000 });
  const detailUrl = page.url();
  await page.getByText("05/02/1997").first().waitFor({ timeout: 8000 });
  check(true, "detalhe mostra nascimento 05/02/1997 (sem virar 04/02)");
  await page.getByText("(21) 9.7493-4685").first().waitFor();
  check(true, "detalhe mostra whatsapp (21) 9.7493-4685");

  // Edição carrega a data convertida para dd/mm/aaaa
  await page.goto(detailUrl + "/editar");
  await birth.waitFor({ timeout: 8000 });
  check(
    (await birth.inputValue()) === "05/02/1997",
    `edição exibe data: ${await birth.inputValue()}`
  );

  // ---------------------------------------------------------------
  // 4) Assinatura: rascunho + prévia na página (não vale até salvar)
  // ---------------------------------------------------------------
  await page.goto(BASE + "/configuracoes/assinatura");
  const previewCard = page.locator("[data-card-root]");
  await previewCard.waitFor({ timeout: 8000 });
  const sigPrev = previewCard.locator('img[alt="Assinatura oficial do Presidente"]');

  // 4.1) Upload NÃO aplica na hora: vira rascunho e a prévia aparece
  await page.locator('input[type="file"]').setInputFiles(SIG);
  await sigPrev.waitFor({ timeout: 8000 });
  check(true, "upload exibe a prévia da carteirinha na hora");
  check(
    (await page.getByText("RASCUNHO — NÃO SALVO").count()) > 0,
    "upload fica em RASCUNHO (selo não salvo)"
  );
  check(
    (await page.getByText("ASSINATURA NÃO CONFIGURADA").count()) > 0,
    "sem salvar, a assinatura NÃO vai (status segue não configurada)"
  );

  // 4.2) Sair sem salvar descarta o rascunho
  await page.reload();
  await previewCard.waitFor({ timeout: 8000 });
  check(
    (await previewCard.locator('img[alt="Assinatura oficial do Presidente"]').count()) === 0,
    "reload sem salvar: rascunho descartado (assinatura nem vai)"
  );

  // 4.3) Reenvia, arrasta, redimensiona e SALVA
  await page.locator('input[type="file"]').setInputFiles(SIG);
  await sigPrev.waitFor({ timeout: 8000 });
  await sigPrev.scrollIntoViewIfNeeded();
  const boxBefore = await sigPrev.boundingBox();
  await page.mouse.move(boxBefore.x + boxBefore.width / 2, boxBefore.y + boxBefore.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    boxBefore.x + boxBefore.width / 2 - 70,
    boxBefore.y + boxBefore.height / 2 - 45,
    { steps: 8 }
  );
  await page.mouse.up();
  const boxAfter = await sigPrev.boundingBox();
  check(
    boxBefore && boxAfter && boxBefore.x - boxAfter.x > 50 && boxBefore.y - boxAfter.y > 30,
    `arrastou a assinatura na prévia (${boxBefore && boxAfter ? `dx=${Math.round(boxAfter.x - boxBefore.x)} dy=${Math.round(boxAfter.y - boxBefore.y)}` : "sem medição"})`
  );

  // Redimensiona pelo pontinho do canto
  const handle = previewCard.locator('span[title="Arraste para redimensionar"]');
  await handle.waitFor({ timeout: 5000 });
  const widthBefore = (await sigPrev.boundingBox()).width;
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 40, handleBox.y + handleBox.height / 2, {
    steps: 6,
  });
  await page.mouse.up();
  const widthAfter = (await sigPrev.boundingBox()).width;
  check(
    widthAfter - widthBefore > 25,
    `redimensionou a assinatura (+${Math.round(widthAfter - widthBefore)}px)`
  );

  // Salva: rascunho + posição passam a valer
  await page.click('button:has-text("Salvar assinatura")');
  await page.getByText("Assinatura salva").first().waitFor({ timeout: 8000 });
  await page.getByText("ASSINATURA CONFIGURADA").first().waitFor({ timeout: 8000 });
  check(
    (await page.getByText("RASCUNHO — NÃO SALVO").count()) === 0,
    "salvar aplica o rascunho (selo some e assinatura fica configurada)"
  );

  // 4.4) Persistência após reload
  await page.reload();
  await previewCard.waitFor({ timeout: 8000 });
  await sigPrev.waitFor({ timeout: 8000 });
  // O estilo inline fica no div-pai (wrapper absoluto), não no <img>.
  const persisted = await sigPrev.evaluate((el) => {
    const parent = el.parentElement;
    return {
      position: parent ? getComputedStyle(parent).position : "",
      left: parent ? parent.style.left : "",
    };
  });
  check(
    persisted.position === "absolute" && Boolean(persisted.left),
    `imagem + posição persistiram após reload (position=${persisted.position} left=${persisted.left})`
  );

  // 4.5) Volta ao padrão (geometria da carteirinha é verificada no modo padrão)
  await page.click('button:has-text("Restaurar posição padrão")');
  await page.click('button:has-text("Salvar assinatura")');
  await page.getByText("Assinatura salva").first().waitFor({ timeout: 8000 });
  const restoredPos = await sigPrev.evaluate((el) =>
    el.parentElement ? getComputedStyle(el.parentElement).position : ""
  );
  check(restoredPos !== "absolute", `restaurou a posição padrão (parent=${restoredPos})`);

  // ---------------------------------------------------------------
  // 5) Geração da carteirinha
  // ---------------------------------------------------------------
  await page.goto(detailUrl);
  await page.locator('button:has-text("Gerar carteirinha")').first().click();
  const dialog = page.getByRole("dialog");
  await page.getByText("CARTEIRINHA GERADA COM SUCESSO").first().waitFor({ timeout: 30000 });
  await dialog.getByText("05/02/1997").first().waitFor({ timeout: 8000 });
  check(true, "carteirinha mostra nascimento 05/02/1997 (sem virar 04/02)");
  await dialog.getByText("(21) 9.7493-4685").first().waitFor({ timeout: 8000 });
  check(true, "carteirinha mostra o WhatsApp (não o telefone)");
  check(
    (await dialog.getByText("Telefone").count()) === 0,
    "carteirinha sem rótulo TELEFONE"
  );

  // Geometria da assinatura: grande e encostada na linha
  const cardRoot = dialog.locator('div[class*="w-[600px]"]').first();
  const sig = cardRoot.locator('img[alt="Assinatura oficial do Presidente"]');
  const line = cardRoot.locator("div.border-t-2").first();
  const sigBox = await sig.boundingBox();
  const lineBox = await line.boundingBox();
  check(sigBox && sigBox.height >= 55, `assinatura com altura real: ${sigBox?.height}px`);
  const gap = lineBox && sigBox ? lineBox.y - (sigBox.y + sigBox.height) : 999;
  check(gap <= 2.5, `assinatura encostada na linha (gap=${gap?.toFixed(1)}px)`);
  await cardRoot.screenshot({ path: CARD_SHOT });
  console.log("screenshot da carteirinha:", CARD_SHOT);

  // 5.1) Diálogo: rolagem da carteirinha + mãozinha no zoom
  const bodyOverflow = await dialog.evaluate((el) => {
    const body = el.querySelector(".overflow-y-auto");
    return body ? getComputedStyle(body).overflowY : null;
  });
  check(
    bodyOverflow === "auto",
    `diálogo permite rolar a carteirinha (overflow-y=${bodyOverflow})`
  );

  await dialog.locator('button:has-text("Visualizar")').click();
  await page.waitForTimeout(350);
  const viewport = dialog.locator("[data-card-viewport]");
  const cursor = await viewport.evaluate((el) => getComputedStyle(el).cursor);
  check(
    cursor === "grab",
    `zoom mostra a mãozinha para arrastar (cursor=${cursor})`
  );

  const vpBox = await viewport.boundingBox();
  const pan0 = await viewport.evaluate((el) => ({
    l: el.scrollLeft,
    t: el.scrollTop,
  }));
  await page.mouse.move(vpBox.x + vpBox.width / 2, vpBox.y + vpBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    vpBox.x + vpBox.width / 2 - 20,
    vpBox.y + vpBox.height / 2 - 70,
    { steps: 8 }
  );
  await page.mouse.up();
  const pan1 = await viewport.evaluate((el) => ({
    l: el.scrollLeft,
    t: el.scrollTop,
  }));
  check(
    pan1.t !== pan0.t || pan1.l !== pan0.l,
    `arrastar com a mãozinha move a carteirinha ampliada (scrollTop ${pan0.t}→${pan1.t})`
  );
  await dialog.locator('button:has-text("Reduzir")').click();
  await page.waitForTimeout(250);

  // ---------------------------------------------------------------
  // 6) Limpar base de dados (restaurar estado de fábrica)
  // ---------------------------------------------------------------
  await page.goto(BASE + "/configuracoes/sistema");
  await page.click('button:has-text("Limpar base de dados")');
  await page.fill('input[placeholder="LIMPAR"]', "LIMPAR");
  await page.click('button:has-text("Confirmar limpeza")');
  await page.waitForURL("**/login", { timeout: 15000 });
  check(true, "limpeza restaura o padrão e encerra a sessão (volta ao login)");
  await page.fill('input[name="login"]', "amococ");
  await page.fill('input[name="password"]', "123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 8000 });
  await page.goto(BASE + "/associados");
  // REGRA: LIMPAR zera de verdade — NADA da demonstração volta.
  // Só o login (SuperAdmin) e as configurações permanecem.
  check(
    (await page.getByText("João da Silva").count()) === 0 &&
      (await page.getByText("Teste Nascimento Certo").count()) === 0,
    "base limpa: ZERO associados (nem o seed de demonstração volta)"
  );
  const tabAtivos = (await page.getByTestId("count-ATIVO").innerText()).trim();
  const tabInativos = (await page.getByTestId("count-INATIVO").innerText()).trim();
  check(
    tabAtivos === "0" && tabInativos === "0",
    `base limpa: abas zeradas (ativos=${tabAtivos} inativos=${tabInativos})`
  );
} catch (err) {
  failures++;
  console.log("ERRO:", String(err?.message ?? err).slice(0, 600));
  await page
    .screenshot({ path: path.resolve(__dirname, "shots", "feature-fail.png"), fullPage: true })
    .catch(() => {});
} finally {
  await browser.close();
}

console.log(
  failures === 0
    ? "\nTODAS AS VERIFICAÇÕES DE RECURSO PASSARAM"
    : `\n${failures} FALHA(S)`
);
process.exit(failures === 0 ? 0 : 1);
