import { api, isNotFound } from "@/lib/apiClient";
import type { MembershipCardRecord } from "@amococ/shared";
import type { CardsRepository } from "../types";

export class ApiCardsRepository implements CardsRepository {
  async getAll(): Promise<MembershipCardRecord[]> {
    return api<MembershipCardRecord[]>("/api/cards");
  }

  async getById(id: string): Promise<MembershipCardRecord | undefined> {
    try {
      return await api<MembershipCardRecord>(`/api/cards/${id}`);
    } catch (err) {
      if (isNotFound(err)) return undefined;
      throw err;
    }
  }

  async getByMemberId(
    memberId: string
  ): Promise<MembershipCardRecord | undefined> {
    return (await this.getAll()).find((card) => card.memberId === memberId);
  }

  async count(): Promise<number> {
    return (await this.getAll()).length;
  }

  /**
   * O PNG continua renderizado no navegador e enviado como `pngDataUrl`;
   * o servidor monta o registro (reemissão preservada, Fase 2) e devolve.
   */
  async create(record: MembershipCardRecord): Promise<MembershipCardRecord> {
    return api<MembershipCardRecord>("/api/cards", {
      method: "POST",
      body: {
        memberId: record.memberId,
        pngDataUrl: record.pngDataUrl,
      },
    });
  }

  async update(
    id: string,
    _patch: Partial<MembershipCardRecord>
  ): Promise<MembershipCardRecord> {
    // Sem endpoint PATCH de carteirinha (Fase 2 não previu — nenhum
    // chamador no src). Reemissão = novo POST; download = endpoint próprio.
    const existing = await this.getById(id);
    if (!existing) throw new Error("CARD_NOT_FOUND");
    throw new Error("CARD_UPDATE_NOT_SUPPORTED");
  }

  /**
   * As carteirinhas caem em cascata no `DELETE /api/members/:id`
   * (servidor) — este método só confirma que não restou nada órfão.
   * Chamado pelo `memberService.delete` sempre antes do delete do membro.
   */
  async deleteByMemberId(_memberId: string): Promise<void> {
    return;
  }
}
