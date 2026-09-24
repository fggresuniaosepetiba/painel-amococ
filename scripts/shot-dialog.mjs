/* eslint-disable no-console */
/**
 * Screenshots do diálogo de geração: estado normal (com rolagem) e
 * estado ampliado com a mãozinha (pan).
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
const SIG = path.resolve(__dirname, "shots", "signature-test.png");
const SHOT1 = path.resolve(__dirname, "shots", "dialog-generate.png");
const SHOT2 = path.resolve(__dirname, "shots", "dialog-zoom-pan.png");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
try {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', "amococ");
  await page.fill('input[name="password"]', "123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 8000 });

  // Assinatura (pré-requisito da geração)
  await page.goto(BASE + "/configuracoes/assinatura");
  await page.locator('input[type="file"]').setInputFiles(SIG);
  await page.locator('button:has-text("Salvar assinatura")').click();
  await page.getByText("ASSINATURA CONFIGURADA").first().waitFor({ timeout: 10000 });

  // Detalhe do primeiro associado → gerar carteirinha
  await page.goto(BASE + "/associados");
  await page
    .locator("table tbody tr")
    .first()
    .locator("td button")
    .first()
    .click();
  await page.waitForURL(/\/associados\/[0-9a-f-]{36}$/, { timeout: 8000 });
  await page.locator('button:has-text("Gerar carteirinha")').first().click();
  await page
    .getByText("CARTEIRINHA GERADA COM SUCESSO")
    .first()
    .waitFor({ timeout: 30000 });

  const dialog = page.getByRole("dialog");
  await dialog.screenshot({ path: SHOT1 });
  console.log("screenshot:", SHOT1);

  // Zoom + mãozinha
  await dialog.locator('button:has-text("Visualizar")').click();
  await page.waitForTimeout(400);
  const viewport = dialog.locator("[data-card-viewport]");
  const vpBox = await viewport.boundingBox();
  await page.mouse.move(vpBox.x + vpBox.width / 2, vpBox.y + vpBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    vpBox.x + vpBox.width / 2 - 25,
    vpBox.y + vpBox.height / 2 - 80,
    { steps: 8 }
  );
  await page.mouse.up();
  await page.waitForTimeout(250);
  await dialog.screenshot({ path: SHOT2 });
  console.log("screenshot:", SHOT2);
} catch (err) {
  console.log("ERRO:", String(err?.message ?? err).slice(0, 500));
} finally {
  await browser.close();
}
