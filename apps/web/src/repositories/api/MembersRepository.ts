import { api, isNotFound } from "@/lib/apiClient";
import type { Member, MemberStatus } from "@amococ/shared";
import type { MembersRepository } from "../types";

export class ApiMembersRepository implements MembersRepository {
  async getAll(): Promise<Member[]> {
    return api<Member[]>("/api/members");
  }

  async getById(id: string): Promise<Member | undefined> {
    try {
      return await api<Member>(`/api/members/${id}`);
    } catch (err) {
      if (isNotFound(err)) return undefined;
      throw err;
    }
  }

  async count(): Promise<number> {
    return (await this.getAll()).length;
  }

  async countByStatus(status: MemberStatus): Promise<number> {
    return (await this.getAll()).filter((member) => member.status === status)
      .length;
  }

  /** Geração server-side (`GET /api/members/preview-next`). */
  async nextMembershipNumber(): Promise<string> {
    const data = await api<{ membershipNumber: string }>(
      "/api/members/preview-next"
    );
    return data.membershipNumber;
  }

  async isMembershipNumberTaken(value: string): Promise<boolean> {
    return this.isUsed(value);
  }

  async isCardCodeTaken(code: string): Promise<boolean> {
    return this.isUsed(code);
  }

  /**
   * Servidor valida os identificadores sugeridos (prévia do formulário)
   * e gera os ausentes — mesma regra do service (Fase 2).
   */
  async create(member: Member): Promise<Member> {
    const { id: _id, status: _status, inactivatedAt: _in, createdAt: _c, updatedAt: _u, ...draft } = member;
    return api<Member>("/api/members", {
      method: "POST",
      body: { ...draft },
    });
  }

  async update(id: string, patch: Partial<Member>): Promise<Member> {
    // Roteamento por formato: troca de status → endpoints dedicados
    // (inactivate/reactivate); demais campos → PATCH /:id.
    if (patch.status !== undefined) {
      const action = patch.status === "INATIVO" ? "inactivate" : "reactivate";
      return api<Member>(`/api/members/${id}/${action}`, {
        method: "POST",
        body: {},
      });
    }
    const { id: _id, membershipNumber: _mn, cardCode: _cc, status: _s, inactivatedAt: _in, createdAt: _c, updatedAt: _u, ...personal } = patch;
    return api<Member>(`/api/members/${id}`, {
      method: "PATCH",
      body: { ...personal },
    });
  }

  /** Exclusão definitiva (somente INATIVO — validada no service e no servidor). */
  async delete(id: string): Promise<void> {
    await api(`/api/members/${id}`, {
      method: "DELETE",
    });
  }

  private async isUsed(value: string): Promise<boolean> {
    const data = await api<{ used: boolean }>(
      `/api/used-identifiers/check?value=${encodeURIComponent(value)}`
    );
    return data.used;
  }
}
