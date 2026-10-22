import { api, isNotFound } from "@/lib/apiClient";
import type { ResidenceDeclaration } from "@amococ/shared";
import type { DeclarationDraft, DeclarationsRepository } from "../types";

export class ApiDeclarationsRepository implements DeclarationsRepository {
  async getAll(): Promise<ResidenceDeclaration[]> {
    return api<ResidenceDeclaration[]>("/api/declarations");
  }

  async getById(id: string): Promise<ResidenceDeclaration | undefined> {
    try {
      return await api<ResidenceDeclaration>(`/api/declarations/${id}`);
    } catch (err) {
      if (isNotFound(err)) return undefined;
      throw err;
    }
  }

  async create(draft: DeclarationDraft): Promise<ResidenceDeclaration> {
    return api<ResidenceDeclaration>("/api/declarations", {
      method: "POST",
      body: draft,
    });
  }

  /** Auditoria acessória (DECLARATION_PRINTED) — nunca quebra a impressão. */
  async registerPrint(id: string): Promise<void> {
    await api(`/api/declarations/${id}/printed`, {
      method: "POST",
      body: {},
    });
  }

  async setStatus(
    id: string,
    status: "ATIVO" | "INATIVO"
  ): Promise<ResidenceDeclaration> {
    const action = status === "INATIVO" ? "inactivate" : "reactivate";
    return api<ResidenceDeclaration>(`/api/declarations/${id}/${action}`, {
      method: "POST",
      body: {},
    });
  }

  async delete(id: string): Promise<void> {
    await api(`/api/declarations/${id}`, { method: "DELETE" });
  }
}
