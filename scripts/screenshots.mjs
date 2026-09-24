/* eslint-disable no-console */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
const OUT = path.resolve(__dirname, "../scripts/shots");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });

// login
await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("01-login");

await page.fill('input[name="login"]', "amococ");
await page.fill('input[name="password"]', "123");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard");
await page.waitForTimeout(800);
await shot("02-dashboard");

await page.goto(BASE + "/associados", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("03-associados");

await page.goto(BASE + "/associados/novo", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("04-associado-novo");

await page.goto(BASE + "/carteirinhas", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("05-carteirinhas");

// upload assinatura e gera carteirinha do seed A
await page.goto(BASE + "/configuracoes/assinatura", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await shot("06-assinatura-vazia");

await page.goto(BASE + "/usuarios", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("07-usuarios");

await page.goto(BASE + "/usuarios/permissoes", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("08-permissoes");

await page.goto(BASE + "/configuracoes/associacao", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("09-config-associacao");

await page.goto(BASE + "/auditoria", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("10-auditoria");

// mobile dashboard
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(BASE + "/dashboard", { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await shot("11-dashboard-mobile");

await browser.close();
console.log("screenshots em", OUT);
