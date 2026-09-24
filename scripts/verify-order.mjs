/* eslint-disable no-console */
import { chromium } from "playwright";

const BASE = "http://localhost:5173";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(BASE + "/login", { waitUntil: "networkidle" });
await page.fill('input[name="login"]', "amococ");
await page.fill('input[name="password"]', "123");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 8000 });

let failures = 0;
const check = (cond, msg) => {
  console.log((cond ? "  OK  " : "  FAIL") + " " + msg);
  if (!cond) failures++;
};

// 1) Associados ATIVOS em ordem alfabética (inativos vivem na outra aba)
await page.goto(BASE + "/associados", { waitUntil: "networkidle" });
const names = await page.locator("table tbody tr td:first-child span.font-semibold").allTextContents();
const expected = ["Ana Souza", "João da Silva", "Maria Oliveira"];
check(JSON.stringify(names) === JSON.stringify(expected), `ativos alfabéticos: ${names.join(" | ")}`);

// 1b) Aba INATIVOS: somente associados inativos, também em ordem alfabética
await page.locator('[data-testid="tab-INATIVO"]').click();
await page.waitForTimeout(300);
const inactive = await page.locator("table tbody tr td:first-child span.font-semibold").allTextContents();
check(
  JSON.stringify(inactive) === JSON.stringify(["Carlos Santos"]),
  `inativos: ${inactive.join(" | ")}`
);
await page.locator('[data-testid="tab-ATIVO"]').click();

// 2) Auditoria em ordem cronológica decrescente
await page.goto(BASE + "/auditoria", { waitUntil: "networkidle" });
const dates = await page.locator("table tbody tr td:first-child span:first-child").allTextContents();
const toMinutes = (s) => {
  const m = s.match(/(\d{2})\/(\d{2})\/(\d{4}) às (\d{2}):(\d{2})/);
  if (!m) return NaN;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]);
};
const minutes = dates.map(toMinutes);
const desc = minutes.every((v, i) => i === 0 || minutes[i - 1] >= v);
check(desc && minutes.every((v) => !Number.isNaN(v)), `auditoria desc: ${dates.map((d) => d.slice(0, 10)).join(" | ")}`);

// 3) Carteirinhas: TAMANHO = Pendente para seed sem PNG
await page.goto(BASE + "/carteirinhas", { waitUntil: "networkidle" });
const sizes = await page.locator("table tbody tr").evaluateAll((rows) =>
  rows.map((r) => r.querySelectorAll("td")[5]?.textContent?.trim())
);
check(sizes.length > 0 && sizes.every((s) => s === "Pendente"), `tamanho: ${sizes.join(" | ")}`);

await browser.close();
console.log(failures === 0 ? "\nTODAS AS VERIFICAÇÕES PASSARAM" : `\n${failures} FALHAS`);
process.exit(failures === 0 ? 0 : 1);
