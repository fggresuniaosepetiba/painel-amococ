import type { Member } from "@amococ/shared";
import type { Member as PrismaMember } from "@prisma/client";
import type { Db } from "../../shared/db.js";

function toDomain(row: PrismaMember): Member {
  return {
    id: row.id,
    membershipNumber: row.membershipNumber,
    cardCode: row.cardCode,
    fullName: row.fullName,
    cpf: row.cpf,
    birthDate: row.birthDate,
    phone: row.phone,
    whatsapp: row.whatsapp,
    cep: row.cep,
    address: row.address,
    addressNumber: row.addressNumber,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    photoDataUrl: row.photoDataUrl,
    notes: row.notes,
    status: row.status as Member["status"],
    inactivatedAt: row.inactivatedAt ? row.inactivatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Implementação Prisma do contrato MembersRepository do frontend
// (apps/web/src/repositories/types.ts) — mesma semântica, mesmos erros.
export const membersRepository = {
  getAll(db: Db): Promise<Member[]> {
    return db.member
      .findMany({ orderBy: { createdAt: "desc" } })
      .then((rows) => rows.map(toDomain));
  },

  async getById(db: Db, id: string): Promise<Member | undefined> {
    const row = await db.member.findUnique({ where: { id } });
    return row ? toDomain(row) : undefined;
  },

  count(db: Db): Promise<number> {
    return db.member.count();
  },

  countByStatus(db: Db, status: Member["status"]): Promise<number> {
    return db.member.count({ where: { status } });
  },

  /** Maior matrícula entre associados existentes (null se vazio). */
  async memberMax(db: Db): Promise<number | null> {
    const row = await db.member.findFirst({
      orderBy: { membershipNumber: "desc" },
      select: { membershipNumber: true },
    });
    if (!row) return null;
    const value = Number(row.membershipNumber);
    return Number.isFinite(value) ? value : null;
  },

  /** Valores da reserva permanente do tipo matrícula. */
  async usedMembershipValues(db: Db): Promise<number[]> {
    const rows = await db.usedIdentifier.findMany({
      where: { type: "membershipNumber" },
      select: { value: true },
    });
    return rows
      .map((r) => Number(r.value))
      .filter((n) => Number.isFinite(n));
  },

  /** Matrícula aplicada a alguém OU reservada para sempre. */
  async isMembershipNumberTaken(db: Db, value: string): Promise<boolean> {
    const member = await db.member.findUnique({
      where: { membershipNumber: value },
      select: { id: true },
    });
    if (member) return true;
    const used = await db.usedIdentifier.findUnique({
      where: { value },
      select: { value: true },
    });
    return Boolean(used);
  },

  /** Código aplicado a alguém OU reservado para sempre. */
  async isCardCodeTaken(db: Db, code: string): Promise<boolean> {
    const member = await db.member.findUnique({
      where: { cardCode: code },
      select: { id: true },
    });
    if (member) return true;
    const used = await db.usedIdentifier.findUnique({
      where: { value: code },
      select: { value: true },
    });
    return Boolean(used);
  },

  /**
   * Cria o associado e registra os identificadores na reserva permanente na
   * MESMA transação. Reserva usa upsert sem sobrescrita: o primeiro registro
   * é a história definitiva (idempotente).
   */
  async create(db: Db, member: Member): Promise<Member> {
    if (await this.isMembershipNumberTaken(db, member.membershipNumber)) {
      throw new Error("MEMBERSHIP_NUMBER_TAKEN");
    }
    if (await this.isCardCodeTaken(db, member.cardCode)) {
      throw new Error("CARD_CODE_TAKEN");
    }
    const usedAt = new Date();
    const created = await db.$transaction(async (tx) => {
      const row = await tx.member.create({
        data: {
          ...member,
          inactivatedAt: member.inactivatedAt
            ? new Date(member.inactivatedAt)
            : null,
          createdAt: new Date(member.createdAt),
          updatedAt: new Date(member.updatedAt),
        },
      });
      for (const [value, type] of [
        [member.membershipNumber, "membershipNumber"],
        [member.cardCode, "cardCode"],
      ] as const) {
        await tx.usedIdentifier.upsert({
          where: { value },
          update: {},
          create: {
            value,
            type,
            usedAt,
            memberId: member.id,
            memberName: member.fullName,
          },
        });
      }
      return row;
    });
    return toDomain(created);
  },

  async update(
    db: Db,
    id: string,
    patch: Partial<Member>,
  ): Promise<Member> {
    try {
      const row = await db.member.update({
        where: { id },
        data: {
          ...patch,
          id: undefined,
          membershipNumber: undefined,
          cardCode: undefined,
          inactivatedAt:
            patch.inactivatedAt === undefined
              ? undefined
              : patch.inactivatedAt
                ? new Date(patch.inactivatedAt)
                : null,
          createdAt: patch.createdAt ? new Date(patch.createdAt) : undefined,
          updatedAt: patch.updatedAt ? new Date(patch.updatedAt) : undefined,
        },
      });
      return toDomain(row);
    } catch {
      throw new Error("MEMBER_NOT_FOUND");
    }
  },

  /** Exclusão definitiva. A reserva em usedIdentifiers NÃO é tocada. */
  async delete(db: Db, id: string): Promise<void> {
    await db.member.delete({ where: { id } }).catch(() => {
      throw new Error("MEMBER_NOT_FOUND");
    });
  },
};
