/* eslint-disable no-console */
/** Mede o layout da carteirinha para diagnosticar sobreposições. */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
const SIG = path.resolve(__dirname, "shots", "signature-test.png");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.locator('input[name="login"]').waitFor({ timeout: 10000 });
  await page.fill('input[name="login"]', "amococ");
  await page.fill('input[name="password"]', "123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 8000 });

  await page.goto(BASE + "/configuracoes/assinatura");
  await page.locator('input[type="file"]').setInputFiles(SIG);
  await page.locator('button:has-text("Salvar assinatura")').click();
  await page.getByText("ASSINATURA CONFIGURADA").waitFor({ timeout: 10000 });

  // Liga "Exibir endereço" para testar o caso mais alto da coluna de dados
  await page.goto(BASE + "/configuracoes/carteirinha");
  const addrSwitch = page.getByRole("switch", { name: "Exibir endereço" });
  await addrSwitch.waitFor({ timeout: 8000 });
  if ((await addrSwitch.getAttribute("data-state")) !== "checked") {
    await addrSwitch.click();
    await page.click('button:has-text("Salvar alterações")');
    await page.getByText("Configurações da carteirinha salvas").waitFor({ timeout: 8000 });
  }
  console.log("switch após salvar:", await addrSwitch.getAttribute("data-state"));

  await page.goto(BASE + "/associados");
  await page.locator("table tbody tr").first().locator("td button").first().click();
  await page.waitForURL(/\/associados\/[0-9a-f-]{36}$/, { timeout: 8000 });
  await page.locator('button:has-text("Gerar carteirinha")').first().click();
  await page.getByText("CARTEIRINHA GERADA COM SUCESSO").first().waitFor({ timeout: 30000 });

  const card = page.getByRole("dialog").locator('div[class*="w-[600px]"]').first();
  const box = async (loc) => {
    const b = await loc.boundingBox();
    return b
      ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), bottom: Math.round(b.y + b.height) }
      : null;
  };
  const cardBox = await box(card);
  const footer = await box(card.locator(":scope > div.absolute").first());
  const dataCol = await box(card.locator("div.min-w-0.flex-1").nth(1));
  const sigImg = await box(card.locator('img[alt="Assinatura oficial do Presidente"]'));
  const sigLine = await box(card.locator("div.border-t-2").first());
  const codeChip = await box(card.locator("div").filter({ hasText: "Código da carteirinha" }).last());
  const addrLine = card.locator("p.truncate.text-\\[9px\\]");
  console.log("address line count:", await addrLine.count());

  console.log("card:", cardBox);
  console.log("footer:", footer);
  console.log("data col:", dataCol);
  console.log("signature img:", sigImg);
  console.log("signature line:", sigLine);
  console.log("code chip:", codeChip);
  if (dataCol && footer) {
    console.log(`SOBREPOSICAO dados x rodape: ${dataCol.bottom - footer.y}px (negativo = ok)`);
  }
  if (sigImg && sigLine) {
    console.log(`gap assinatura->linha: ${sigLine.y - sigImg.bottom}px (0 = encostada)`);
  }
  if (codeChip && sigImg) {
    const hOverlap = Math.max(0, Math.min(codeChip.bottom, sigImg.bottom) - Math.max(codeChip.y, sigImg.y));
    const vOverlap = Math.max(0, Math.min(codeChip.x + codeChip.w, sigImg.x + sigImg.w) - Math.max(codeChip.x, sigImg.x));
    console.log(`overlap chip x imagem-assinatura: ${hOverlap && vOverlap ? "SIM" : "nao"}`);
  }
  await card.screenshot({ path: path.resolve(__dirname, "shots", "card-measure.png") });
} catch (err) {
  console.log("ERRO:", String(err?.message ?? err).slice(0, 500));
  console.log("URL no erro:", page.url());
} finally {
  await browser.close();
}
