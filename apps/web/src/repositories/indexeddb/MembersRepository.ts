import { db } from "@/db/database";
import type { Member, MemberStatus } from "@amococ/shared";
import type { MembersRepository } from "../types";

export class IndexedDbMembersRepository implements MembersRepository {
  getAll(): Promise<Member[]> {
    return db.members.orderBy("createdAt").reverse().toArray();
  }

  getById(id: string): Promise<Member | undefined> {
    return db.members.get(id);
  }

  count(): Promise<number> {
    return db.members.count();
  }

  countByStatus(status: MemberStatus): Promise<number> {
    return db.members.where("status").equals(status).count();
  }

  /**
   * Próxima matrícula: maior valor já UTILIZADO + 1, formatada em 6 dígitos.
   *
   * REGRA CRÍTICA: considera tanto os associados existentes quanto a tabela
   * `usedIdentifiers` (reserva permanente). Uma matrícula cujo associado foi
   * excluído definitivamente continua contando como utilizada — ou seja,
   * nunca será reutilizada.
   */
  async nextMembershipNumber(): Promise<string> {
    return db.transaction("r", db.members, db.usedIdentifiers, async () => {
      const [lastMember, used] = await Promise.all([
        db.members.orderBy("membershipNumber").last(),
        db.usedIdentifiers.where("type").equals("membershipNumber").toArray(),
      ]);
      let max = lastMember ? Number(lastMember.membershipNumber) : 0;
      if (!Number.isFinite(max)) max = 0;
      for (const entry of used) {
        const value = Number(entry.value);
        if (Number.isFinite(value) && value > max) max = value;
      }
      return String(max + 1).padStart(6, "0");
    });
  }

  /** Matrícula já aplicada a alguém OU já reservada para sempre. */
  async isMembershipNumberTaken(value: string): Promise<boolean> {
    const found = await db.members
      .where("membershipNumber")
      .equals(value)
      .first();
    if (found) return true;
    return Boolean(await db.usedIdentifiers.get(value));
  }

  /** Código já aplicado a alguém OU já reservado para sempre. */
  async isCardCodeTaken(code: string): Promise<boolean> {
    const found = await db.members.where("cardCode").equals(code).first();
    if (found) return true;
    return Boolean(await db.usedIdentifiers.get(code));
  }

  /**
   * Cria o associado e registra seus identificadores na reserva permanente
   * na MESMA transação — identifier em `usedIdentifiers` sobrevive a
   * qualquer exclusão futura deste registro.
   */
  async create(member: Member): Promise<Member> {
    if (await this.isMembershipNumberTaken(member.membershipNumber)) {
      throw new Error("MEMBERSHIP_NUMBER_TAKEN");
    }
    if (await this.isCardCodeTaken(member.cardCode)) {
      throw new Error("CARD_CODE_TAKEN");
    }
    await db.transaction("rw", db.members, db.usedIdentifiers, async () => {
      await db.members.add(member);
      const usedAt = new Date().toISOString();
      for (const [value, type] of [
        [member.membershipNumber, "membershipNumber"],
        [member.cardCode, "cardCode"],
      ] as const) {
        if (!(await db.usedIdentifiers.get(value))) {
          await db.usedIdentifiers.add({
            value,
            type,
            usedAt,
            memberId: member.id,
            memberName: member.fullName,
          });
        }
      }
    });
    return member;
  }

  async update(id: string, patch: Partial<Member>): Promise<Member> {
    await db.members.update(id, patch);
    const updated = await db.members.get(id);
    if (!updated) throw new Error("MEMBER_NOT_FOUND");
    return updated;
  }

  /**
   * Exclusão definitiva do cadastro. A reserva em `usedIdentifiers` NÃO é
   * tocada aqui: matrícula e código permanecem utilizados para sempre.
   * (A regra de status — só inativos podem ser excluídos — fica no service.)
   */
  async delete(id: string): Promise<void> {
    await db.members.delete(id);
  }
}
