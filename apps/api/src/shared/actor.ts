// Ator da operação — usado SOMENTE para atribuição de auditoria.
// Sem autenticação até a Fase 5: endpoints aceitam `actor` opcional no corpo;
// ausente → "sistema". Checagens de permissão entram na Fase 5.

export interface Actor {
  id: string;
  name: string;
}

export const SYSTEM_ACTOR: Actor = { id: "system", name: "sistema" };

export function parseActor(value: unknown): Actor {
  if (value !== null && typeof value === "object") {
    const { id, name } = value as { id?: unknown; name?: unknown };
    if (typeof id === "string" && id.length > 0 && typeof name === "string") {
      return { id, name };
    }
  }
  return SYSTEM_ACTOR;
}
