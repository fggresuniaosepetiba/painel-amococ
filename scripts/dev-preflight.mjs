/**
 * Pré-flight do `npm run dev` (raiz do monorepo).
 *
 * Garante que o PostgreSQL local esteja no ar ANTES de subir web + api:
 * 1. Se a porta do banco já estiver aberta (ex.: iniciado pela tarefa
 *    agendada no logon), apenas segue — custo zero.
 * 2. Se estiver fechada e existir um PostgreSQL portátil instalado,
 *    inicia via `pg_ctl start` DESANEXADO do console do terminal (detached
 *    + windowsHide), para que um Ctrl+C no `npm run dev` não mate o banco.
 * 3. Aplica migrations pendentes (`prisma migrate deploy` — idempotente).
 *
 * Portabilidade: em máquinas sem o PostgreSQL portátil (sem o diretório de
 * dados padrão), o script assume que o banco é externo (ex.: Neon) e apenas
 * avisa — nunca bloqueia o `npm run dev` por causa disso.
 *
 * Overrides via variáveis de ambiente: AMOCOC_PG_BIN, AMOCOC_PG_DATA, PG_PORT.
 */
import net from "node:net";
import path from "node:path";
import os from "node:os";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PG_BIN = process.env.AMOCOC_PG_BIN ?? path.join(os.homedir(), "pgsql16", "pgsql", "bin");
const PG_DATA = process.env.AMOCOC_PG_DATA ?? path.join(os.homedir(), "pgsql16", "data");
const PG_LOG = path.join(path.dirname(PG_DATA), "pg.log");
const PG_PORT = Number(process.env.PG_PORT ?? 5432);

/** Portas do dev: web (Vite) e api (Express). */
const DEV_PORTS = [
  { port: 5173, name: "web (Vite)" },
  { port: 3000, name: "api (Express)" },
];

function isPortOpen(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(800);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** PIDs que ocupam uma porta (netstat, Windows) — só para avisos. */
function pidsOnPort(port) {
  const result = spawnSync("netstat", ["-ano"], { encoding: "utf8" });
  if (result.status !== 0) return [];
  const pids = new Set();
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.includes("LISTENING")) continue;
    const cols = line.trim().split(/\s+/);
    // colunas: proto local foreign state pid
    if (cols[1]?.endsWith(`:${port}`)) pids.add(cols.at(-1));
  }
  return [...pids];
}

async function ensurePostgres() {
  if (await isPortOpen(PG_PORT)) return true;

  if (!existsSync(PG_DATA)) {
    console.log(
      `[pré-flight] Postgres local não encontrado em "${PG_DATA}" — assumindo banco externo/outra configuração.`
    );
    return null; // não decide; deixa a API reportar se o banco real estiver fora
  }

  const pgCtl = path.join(PG_BIN, "pg_ctl.exe");
  if (!existsSync(pgCtl)) {
    console.error(`[pré-flight] pg_ctl não encontrado: ${pgCtl}`);
    return false;
  }

  console.log(`[pré-flight] Postgres fora do ar (porta ${PG_PORT}) — iniciando...`);
  // detached: cria NOVO grupo de processos → não recebe o Ctrl+C do terminal.
  spawn(pgCtl, ["-D", PG_DATA, "-l", PG_LOG, "-o", `-p ${PG_PORT}`, "start"], {
    detached: true,
    windowsHide: true,
    stdio: "ignore",
  }).unref();

  for (let i = 0; i < 40; i++) {
    await sleep(500);
    if (await isPortOpen(PG_PORT)) {
      console.log("[pré-flight] Postgres no ar ✓");
      return true;
    }
  }
  console.error(`[pré-flight] Postgres não subiu em 20s. Veja o log: ${PG_LOG}`);
  return false;
}

function applyMigrations() {
  console.log("[pré-flight] Verificando migrations (prisma migrate deploy)...");
  const result = spawnSync("cmd", ["/c", "pnpm", "--filter", "@amococ/api", "db:deploy"], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    // Não aborta o dev: o próprio API acusará se o schema estiver incompatível.
    console.warn("[pré-flight] Aviso: migrate deploy retornou erro — seguindo assim mesmo.");
  }
}

function warnBusyDevPorts() {
  for (const { port, name } of DEV_PORTS) {
    const pids = pidsOnPort(port);
    if (pids.length > 0) {
      console.warn(
        `[pré-flight] Aviso: a porta ${port} (${name}) já está em uso pelo(s) PID ${pids.join(", ")}. ` +
          `Se for uma instância antiga do dev, feche-a (Ctrl+C no terminal dela) ou rode: taskkill /PID ${pids[0]} /F`
      );
    }
  }
}

const postgresOk = await ensurePostgres();
if (postgresOk === false) {
  console.error(
    "[pré-flight] Não consegui iniciar o PostgreSQL. Corrija acima e rode `npm run dev` de novo."
  );
  process.exit(1);
}
applyMigrations();
warnBusyDevPorts();
console.log("[pré-flight] Pronto — subindo web + api.\n");
