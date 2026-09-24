/* eslint-disable no-console */
/** Screenshot do fluxo da prévia arrastável em Configurações → Assinatura. */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
const SIG = path.resolve(__dirname, "shots", "signature-test.png");
const OUT = path.resolve(__dirname, "shots", "settings-signature-preview.png");

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1700 } });
const page = await context.newPage();
try {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[name="login"]', "amococ");
  await page.fill('input[name="password"]', "123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard", { timeout: 8000 });

  await page.goto(BASE + "/configuracoes/assinatura");
  await page.locator('input[type="file"]').setInputFiles(SIG);
  await page.locator('button:has-text("Salvar assinatura")').click();
  await page.getByText("ASSINATURA CONFIGURADA").first().waitFor({ timeout: 10000 });

  const sigPrev = page.locator(
    '[data-card-root] img[alt="Assinatura oficial do Presidente"]'
  );
  await sigPrev.waitFor({ timeout: 8000 });
  await sigPrev.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT, fullPage: true });
  console.log("screenshot:", OUT);
} catch (err) {
  console.log("ERRO:", String(err?.message ?? err).slice(0, 500));
} finally {
  await browser.close();
}
