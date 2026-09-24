/* eslint-disable no-console */
/**
 * Screenshots de revisão visual da tela ASSOCIADOS:
 * - aba ATIVOS
 * - aba INATIVOS
 * - modal de exclusão definitiva
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
const OUT = path.resolve(__dirname, "shots");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.fill('input[name="login"]', "amococ");
await page.fill('input[name="password"]', "123");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 8000 });

await page.goto(BASE + "/associados");
await page.getByText("João da Silva").first().waitFor({ timeout: 8000 });
await page.screenshot({ path: path.join(OUT, "members-ativos.png") });

await page.locator('[data-testid="tab-INATIVO"]').click();
await page.getByText("Carlos Santos").first().waitFor({ timeout: 8000 });
await page.screenshot({ path: path.join(OUT, "members-inativos.png") });

// modal de exclusão do associado inativo do seed
await page.locator('button[aria-label="Ações de Carlos Santos"]').click();
await page.getByRole("menuitem", { name: "Excluir" }).click();
await page.getByText("Excluir associado permanentemente?").first().waitFor({
  timeout: 5000,
});
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, "members-delete-dialog.png") });

await browser.close();
console.log("screenshots: members-ativos.png, members-inativos.png, members-delete-dialog.png");
