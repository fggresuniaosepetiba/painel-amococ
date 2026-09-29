import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import { App } from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("Root container not found");

// Gancho de testes SOMENTE em desenvolvimento: os scripts Playwright
// (scripts/*.mjs) usam window.__amococTest para exercitar regras de serviço
// que a interface esconde (ex.: exclusão de associado ativo é bloqueada).
// No build de produção (import.meta.env.DEV === false) este bloco é
// eliminado pelo tree-shaking e não existe na aplicação final.
if (import.meta.env.DEV) {
  void import("@/services").then(
    ({ memberService, usedIdentifiersService, sessionGuard }) => {
      (window as unknown as { __amococTest?: object }).__amococTest = {
        memberService,
        usedIdentifiersService,
        sessionGuard,
      };
    }
  );
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
