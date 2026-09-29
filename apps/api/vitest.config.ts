import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Garante o banco de teste (amococ_test) + migrations antes da suíte.
    globalSetup: ["./src/test/global-setup.ts"],
    // Um único worker: os testes de integração dividem o mesmo banco isolado
    // e o reset entre testes exige execução serializada dos arquivos.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
