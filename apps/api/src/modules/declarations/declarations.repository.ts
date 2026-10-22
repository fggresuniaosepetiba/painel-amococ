import type { ResidenceDeclaration } from "@amococ/shared";
import type { ResidenceDeclaration as PrismaDeclaration } from "@prisma/client";
import type { Db } from "../../shared/db.js";

function toDomain(row: PrismaDeclaration): ResidenceDeclaration {
  return {
    id: row.id,
    residentName: row.residentName,
    birthDate: row.birthDate,
    cpf: row.cpf,
    address: row.address,
    residenceYears: row.residenceYears,
    residenceMonths: row.residenceMonths,
    issuedAt: row.issuedAt.toISOString(),
    issuedByUserId: row.issuedByUserId,
    issuedByName: row.issuedByName,
    status: row.status === "INATIVO" ? "INATIVO" : "ATIVO",
    inactivatedAt: row.inactivatedAt ? row.inactivatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Implementação Prisma do contrato DeclarationsRepository — espelho do padrão
// de membros: status em campos próprios, sem FKs.
export const declarationsRepository = {
  getAll(db: Db): Promise<ResidenceDeclaration[]> {
    return db.residenceDeclaration
      .findMany({ orderBy: { issuedAt: "desc" } })
      .then((rows) => rows.map(toDomain));
  },

  async getById(db: Db, id: string): Promise<ResidenceDeclaration | undefined> {
    const row = await db.residenceDeclaration.findUnique({ where: { id } });
    return row ? toDomain(row) : undefined;
  },

  async create(
    db: Db,
    record: ResidenceDeclaration,
  ): Promise<ResidenceDeclaration> {
    const { status, inactivatedAt, createdAt, updatedAt, ...data } = record;
    const created = await db.residenceDeclaration.create({
      data: {
        ...data,
        issuedAt: new Date(record.issuedAt),
        status,
        inactivatedAt: inactivatedAt ? new Date(inactivatedAt) : null,
      },
    });
    return toDomain(created);
  },

  async updateStatus(
    db: Db,
    id: string,
    status: "ATIVO" | "INATIVO",
    inactivatedAt: string | null,
  ): Promise<ResidenceDeclaration> {
    try {
      const row = await db.residenceDeclaration.update({
        where: { id },
        data: {
          status,
          inactivatedAt: inactivatedAt ? new Date(inactivatedAt) : null,
        },
      });
      return toDomain(row);
    } catch {
      throw new Error("DECLARATION_NOT_FOUND");
    }
  },

  async remove(db: Db, id: string): Promise<void> {
    try {
      await db.residenceDeclaration.delete({ where: { id } });
    } catch {
      throw new Error("DECLARATION_NOT_FOUND");
    }
  },
};
