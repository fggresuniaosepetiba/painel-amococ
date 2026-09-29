import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type {
  MembershipCardRecord,
  Member,
  SignatureSettings,
} from "@amococ/shared";
import { prisma } from "../../lib/prisma.js";
import { logAudit } from "../../shared/audit.js";
import type { Db } from "../../shared/db.js";
import { createId } from "../../shared/ids.js";
import { DEFAULT_SETTINGS } from "../../domain/default-settings.js";
import { passwordHasher } from "../users/password-hasher.js";
import { auditRepository } from "../audit/audit.repository.js";
import { cardsRepository } from "../cards/cards.repository.js";
import { membersRepository } from "../members/members.repository.js";
import { settingsRepository } from "../settings/settings.repository.js";
import { usersRepository } from "../users/users.repository.js";
import { usedIdentifiersRepository } from "../used-identifiers/used-identifiers.repository.js";

// Seed + factory reset — espelho server-side de seedService.ts/systemService.ts.
// Estado de primeira utilização: SuperAdmin amococ/123, configurações padrão,
// assinatura oficial do asset, ZERO associados/identificadores/carteirinhas/auditoria.
// `demo: true` adiciona os dados de demonstração (equivale ao seed de DEV).

const INITIAL_SUPERADMIN_LOGIN = "amococ";
const INITIAL_SUPERADMIN_PASSWORD = "123";

/** Asset oficial servido pelo frontend (apps/web/public). */
const OFFICIAL_SIGNATURE_URL = new URL(
  "../../../../web/public/assets/images/assinatura-leo.png",
  import.meta.url,
);

/** Gera CPF válido a partir de 9 dígitos (somente dados fictícios do demo). */
function makeCpf(base9: string): string {
  const calc = (base: string, factor: number): number => {
    let total = 0;
    for (let i = 0; i < base.length; i++) total += Number(base[i]) * (factor - i);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  const d1 = calc(base9, 10);
  const d2 = calc(base9 + d1, 11);
  return `${base9}${d1}${d2}`;
}

function formatCpfDoc(raw: string): string {
  return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9)}`;
}

/**
 * Carrega a assinatura oficial do asset do monorepo como data URL.
 * Sem redimensionamento (o frontend aplica resizeSignature na tela/edIção) —
 * asset ausente → segue sem assinatura (geração bloqueia com mensagem oficial).
 */
async function loadOfficialSignature(): Promise<Partial<SignatureSettings>> {
  try {
    const buffer = await readFile(fileURLToPath(OFFICIAL_SIGNATURE_URL));
    return {
      imageDataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
      mimeType: "image/png",
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return {};
  }
}

interface SeedMemberInput {
  membershipNumber: string;
  cardCode: string;
  fullName: string;
  cpfBase: string;
  birthDate: string;
  phone: string;
  whatsapp: string;
  cep: string;
  address: string;
  addressNumber: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  notes: string;
  status: "ATIVO" | "INATIVO";
  createdAtOffsetDays: number;
}

const SEED_MEMBERS: SeedMemberInput[] = [
  {
    membershipNumber: "000001",
    cardCode: "AMOCOC-00001-A8ZK",
    fullName: "João da Silva",
    cpfBase: "529982247",
    birthDate: "1985-04-12",
    phone: "(85) 98811-2233",
    whatsapp: "(85) 98811-2233",
    cep: "60000-001",
    address: "Rua das Acácias",
    addressNumber: "120",
    complement: "Bloco A",
    district: "Conjunto Otacílio Câmara",
    city: "Fortaleza",
    state: "CE",
    notes: "Dados fictícios para demonstração.",
    status: "ATIVO",
    createdAtOffsetDays: -42,
  },
  {
    membershipNumber: "000002",
    cardCode: "AMOCOC-00002-Q7LP",
    fullName: "Maria Oliveira",
    cpfBase: "111444777",
    birthDate: "1990-09-23",
    phone: "(85) 98722-3344",
    whatsapp: "(85) 98722-3344",
    cep: "60000-002",
    address: "Avenida Central",
    addressNumber: "45",
    complement: "",
    district: "Conjunto Otacílio Câmara",
    city: "Fortaleza",
    state: "CE",
    notes: "Dados fictícios para demonstração.",
    status: "ATIVO",
    createdAtOffsetDays: -30,
  },
  {
    membershipNumber: "000003",
    cardCode: "AMOCOC-00003-M4XT",
    fullName: "Carlos Santos",
    cpfBase: "123456789",
    birthDate: "1978-01-30",
    phone: "(85) 98633-4455",
    whatsapp: "",
    cep: "60000-003",
    address: "Rua dos Coqueiros",
    addressNumber: "780",
    complement: "Casa 2",
    district: "Conjunto Otacílio Câmara",
    city: "Fortaleza",
    state: "CE",
    notes: "Dados fictícios para demonstração.",
    status: "INATIVO",
    createdAtOffsetDays: -21,
  },
  {
    membershipNumber: "000004",
    cardCode: "AMOCOC-00004-X9PL",
    fullName: "Ana Souza",
    cpfBase: "390533447",
    birthDate: "1995-06-15",
    phone: "(85) 98544-5566",
    whatsapp: "(85) 98544-5566",
    cep: "60000-004",
    address: "Travessa Primavera",
    addressNumber: "9",
    complement: "",
    district: "Conjunto Otacílio Câmara",
    city: "Fortaleza",
    state: "CE",
    notes: "Dados fictícios para demonstração.",
    status: "ATIVO",
    createdAtOffsetDays: -7,
  },
];

export const systemService = {
  /** Executa o seed somente quando não há usuários (banco vazio). */
  async seed(
    options: { demo?: boolean } = {},
    db: Db = prisma,
  ): Promise<{ seeded: boolean; demo: boolean }> {
    const demo = options.demo === true;
    const userCount = await usersRepository.count(db);
    if (userCount > 0) return { seeded: false, demo };

    const now = Date.now();
    const daysAgo = (days: number) =>
      new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

    const { salt, hash } = await passwordHasher.hash(INITIAL_SUPERADMIN_PASSWORD);
    const adminId = createId();
    await usersRepository.create(db, {
      id: adminId,
      name: "Administrador AMOCOC",
      login: INITIAL_SUPERADMIN_LOGIN,
      email: "admin@amococ.local",
      role: "SUPERADMIN",
      status: "ATIVO",
      permissions: [],
      salt,
      passwordHash: hash,
      mustChangePassword: false,
      createdAt: daysAgo(-60),
      updatedAt: daysAgo(-60),
      lastLoginAt: null,
    });

    // Produção (demo=false): assinatura oficial já cadastrada.
    // Demo (equivale ao DEV): assinatura vazia (testes exercitam o bloqueio).
    const officialSignature: Partial<SignatureSettings> = demo
      ? {}
      : await loadOfficialSignature();
    await settingsRepository.save(db, {
      ...DEFAULT_SETTINGS,
      signature: { ...DEFAULT_SETTINGS.signature, ...officialSignature },
      updatedAt: new Date().toISOString(),
    });

    if (!demo) return { seeded: true, demo };

    const members: Member[] = SEED_MEMBERS.map((input) => ({
      id: createId(),
      membershipNumber: input.membershipNumber,
      cardCode: input.cardCode,
      fullName: input.fullName,
      cpf: formatCpfDoc(makeCpf(input.cpfBase)),
      birthDate: input.birthDate,
      phone: input.phone,
      whatsapp: input.whatsapp,
      cep: input.cep,
      address: input.address,
      addressNumber: input.addressNumber,
      complement: input.complement,
      district: input.district,
      city: input.city,
      state: input.state,
      photoDataUrl: null,
      notes: input.notes,
      status: input.status,
      inactivatedAt: input.status === "INATIVO" ? daysAgo(-10) : null,
      createdAt: daysAgo(input.createdAtOffsetDays),
      updatedAt: daysAgo(input.createdAtOffsetDays),
    }));
    for (const member of members) {
      await membersRepository.create(db, member);
    }

    const demoCards: MembershipCardRecord[] = members
      .filter((m) => m.status === "ATIVO")
      .slice(0, 2)
      .map((m) => ({
        id: createId(),
        memberId: m.id,
        cardCode: m.cardCode,
        membershipNumber: m.membershipNumber,
        memberName: m.fullName,
        generatedAt: daysAgo(-3),
        generatedByUserId: adminId,
        generatedByName: "Administrador AMOCOC",
        pngDataUrl: null,
        fileSizeBytes: null,
      }));
    for (const card of demoCards) {
      await cardsRepository.create(db, card);
    }

    await auditRepository.createMany(db, [
      {
        userId: adminId,
        userName: "Administrador AMOCOC",
        action: "USER_CREATED",
        entity: "user",
        entityId: adminId,
        details: "Usuário inicial do sistema criado automaticamente",
      },
      ...members.map((m, index) => ({
        userId: adminId,
        userName: "Administrador AMOCOC",
        action: "MEMBER_CREATED" as const,
        entity: "member",
        entityId: m.id,
        details: `Associado "${m.fullName}" criado — matrícula ${m.membershipNumber}, código ${m.cardCode}${
          index === 0 ? " (seed inicial)" : ""
        }`,
      })),
      ...demoCards.map((c) => ({
        userId: adminId,
        userName: "Administrador AMOCOC",
        action: "CARD_GENERATED" as const,
        entity: "card",
        entityId: c.id,
        details: `Carteirinha ${c.cardCode} gerada para "${c.memberName}" (matrícula ${c.membershipNumber})`,
      })),
    ]);

    return { seeded: true, demo };
  },

  /**
   * LIMPAR: zera TODA a base e restaura a primeira utilização (demo NÃO volta).
   * Auditoria zerada; registra a própria ação. Quem chama deve encerrar a
   * sessão em seguida (Fase 5 cuidará disso no servidor).
   */
  async factoryReset(db: Db = prisma): Promise<{ reset: boolean }> {
    await db.$transaction([
      db.auditLog.deleteMany(),
      db.membershipCard.deleteMany(),
      db.member.deleteMany(),
      db.setting.deleteMany(),
      db.user.deleteMany(),
      db.usedIdentifier.deleteMany(),
    ]);
    await this.seed({ demo: false }, db);
    const admin = await usersRepository.getByLogin(db, INITIAL_SUPERADMIN_LOGIN);
    if (admin) {
      await logAudit(db, {
        userId: admin.id,
        userName: admin.name,
        action: "SYSTEM_FACTORY_RESET",
        entity: "settings",
        entityId: "system",
        details:
          "Base de dados limpa e restaurada para o estado inicial (fábrica)",
      });
    }
    return { reset: true };
  },
};
