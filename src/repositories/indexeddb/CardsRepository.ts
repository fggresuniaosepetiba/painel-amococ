import { db } from "@/db/database";
import type { MembershipCardRecord } from "@/types";
import type { CardsRepository } from "../types";
export class IndexedDbCardsRepository implements CardsRepository {
  getAll(): Promise<MembershipCardRecord[]> {
    return db.cards.orderBy("generatedAt").reverse().toArray();
  }

  getById(id: string): Promise<MembershipCardRecord | undefined> {
    return db.cards.get(id);
  }

  getByMemberId(memberId: string): Promise<MembershipCardRecord | undefined> {
    return db.cards.where("memberId").equals(memberId).first();
  }

  count(): Promise<number> {
    return db.cards.count();
  }

  async create(record: MembershipCardRecord): Promise<MembershipCardRecord> {
    const existing = await db.cards
      .where("cardCode")
      .equals(record.cardCode)
      .first();
    if (existing) {
      // Reemissão para o mesmo associado: substitui o registro (mesmo vínculo).
      if (existing.memberId !== record.memberId) {
        throw new Error("CARD_CODE_TAKEN");
      }
      const regenerated: MembershipCardRecord = {
        ...record,
        id: existing.id,
      };
      await db.cards.put(regenerated);
      return regenerated;
    }
    await db.cards.add(record);
    return record;
  }

  async update(
    id: string,
    patch: Partial<MembershipCardRecord>
  ): Promise<MembershipCardRecord> {
    await db.cards.update(id, patch);
    const updated = await db.cards.get(id);
    if (!updated) throw new Error("CARD_NOT_FOUND");
    return updated;
  }

  async deleteByMemberId(memberId: string): Promise<void> {
    await db.cards.where("memberId").equals(memberId).delete();
  }
}
