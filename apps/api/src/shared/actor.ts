// Ator da operação — usado SOMENTE para atribuição de auditoria.
// Desde a Fase 5, o ator vem do JWT (middlewares/requireAuth.ts `reqUser`);
// nenhum endpoint aceita mais `actor` no corpo (fim do ADR-010).

export interface Actor {
  id: string;
  name: string;
}

export const SYSTEM_ACTOR: Actor = { id: "system", name: "sistema" };
