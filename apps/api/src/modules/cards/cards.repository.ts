import type { MembershipCardRecord } from "@amococ/shared";
import type { MembershipCard as PrismaCard } from "@prisma/client";
import type { Db } from "../../shared/db.js";

function toDomain(row: PrismaCard): MembershipCardRecord {
  return {
    id: row.id,
    memberId: row.memberId,
    cardCode: row.cardCode,
    membershipNumber: row.membershipNumber,
    memberName: row.memberName,
    generatedAt: row.generatedAt.toISOString(),
    generatedByUserId: row.generatedByUserId,
    generatedByName: row.generatedByName,
    pngDataUrl: row.pngDataUrl,
    fileSizeBytes: row.fileSizeBytes,
  };
}

// Implementação Prisma do contrato CardsRepository — mesma semântica de
// reemissão: mesmo vínculo substitui (mantém id); outro vínculo → erro.
export const cardsRepository = {
  getAll(db: Db): Promise<MembershipCardRecord[]> {
    return db.membershipCard
      .findMany({ orderBy: { generatedAt: "desc" } })
      .then((rows) => rows.map(toDomain));
  },

  async getById(db: Db, id: string): Promise<MembershipCardRecord | undefined> {
    const row = await db.membershipCard.findUnique({ where: { id } });
    return row ? toDomain(row) : undefined;
  },

  async getByMemberId(
    db: Db,
    memberId: string,
  ): Promise<MembershipCardRecord | undefined> {
    const row = await db.membershipCard.findFirst({ where: { memberId } });
    return row ? toDomain(row) : undefined;
  },

  count(db: Db): Promise<number> {
    return db.membershipCard.count();
  },

  async create(db: Db, record: MembershipCardRecord): Promise<MembershipCardRecord> {
    const existing = await db.membershipCard.findFirst({
      where: { cardCode: record.cardCode },
    });
    if (existing) {
      if (existing.memberId !== record.memberId) {
        throw new Error("CARD_CODE_TAKEN");
      }
      const regenerated = await db.membershipCard.update({
        where: { id: existing.id },
        data: {
          ...record,
          id: undefined,
          generatedAt: new Date(record.generatedAt),
        },
      });
      return toDomain(regenerated);
    }
    const created = await db.membershipCard.create({
      data: { ...record, generatedAt: new Date(record.generatedAt) },
    });
    return toDomain(created);
  },

  async update(
    db: Db,
    id: string,
    patch: Partial<MembershipCardRecord>,
  ): Promise<MembershipCardRecord> {
    try {
      const row = await db.membershipCard.update({
        where: { id },
        data: {
          ...patch,
          id: undefined,
          generatedAt: patch.generatedAt
            ? new Date(patch.generatedAt)
            : undefined,
        },
      });
      return toDomain(row);
    } catch {
      throw new Error("CARD_NOT_FOUND");
    }
  },

  /** Remove as carteirinhas de um associado excluído definitivamente. */
  async deleteByMemberId(db: Db, memberId: string): Promise<void> {
    await db.membershipCard.deleteMany({ where: { memberId } });
  },
};
