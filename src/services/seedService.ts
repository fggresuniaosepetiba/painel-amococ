import { db } from "@/db/database";
import { DEFAULT_SETTINGS, usersRepository } from "@/repositories";
import type {
  MembershipCardRecord,
  Member,
  SignatureSettings,
  User,
} from "@/types";
import { createId } from "@/utils/id";
import { hashPassword } from "@/utils/password";
import { imageService } from "./imageService";
import { membershipCardCodeService } from "./membershipCardCodeService";

/**
 * Seed executado apenas quando o banco local está vazio.
 *
 * ESTADO DE PRIMEIRA UTILIZAÇÃO (qualquer ambiente — é o que o cliente
 * recebe no deploy de produção):
 *  - SuperAdmin inicial: Login `amococ` / Senha `123`
 *    (documentada no README; alterável em Configurações → Segurança)
 *  - Configurações padrão
 *  - NADA além disso: nenhum associado, nenhum identificador utilizado,
 *    nenhuma carteirinha e nenhum registro de auditoria fictício.
 *
 * Em PRODUÇÃO a assinatura oficial já nasce cadastrada (asset
 * `public/assets/images/assinatura-leo.png`): o presidente não precisa
 * importar nada — pode apenas trocar ou reposicionar em
 * Configurações → Assinatura.
 *
 * Os dados de DEMONSTRAÇÃO (associados, carteirinhas, identificadores e
 * auditoria de exemplo) existem SOMENTE em desenvolvimento
 * (`import.meta.env.DEV`), para as suítes de teste e revisão visual —
 * o build entregue ao cliente nunca os recebe.
 */
const INITIAL_SUPERADMIN_LOGIN = "amococ";
const INITIAL_SUPERADMIN_PASSWORD = "123";

/** Assinatura oficial embutida no sistema (asset servido em /public). */
const OFFICIAL_SIGNATURE_PATH = "/assets/images/assinatura-leo.png";

/** Gera CPF válido a partir de 9 dígitos (para dados fictícios do seed). */
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
 * Carrega a assinatura oficial do repositório e aplica o MESMO
 * processamento do envio em Configurações → Assinatura
 * (`imageService.resizeSignature`): redimensiona preservando a
 * transparência. Assim o cliente recebe exatamente o resultado que a
 * tela produziria. Asset ausente/falha de leitura → segue sem
 * assinatura (a geração exibe a mensagem oficial + atalho de Configurações).
 */
async function loadOfficialSignature(): Promise<Partial<SignatureSettings>> {
  try {
    const response = await fetch(OFFICIAL_SIGNATURE_PATH);
    if (!response.ok) return {};
    const blob = await response.blob();
    const file = new File([blob], "assinatura-oficial.png", {
      type: blob.type || "image/png",
    });
    const processed = await imageService.resizeSignature(file, 700);
    return {
      imageDataUrl: processed.dataUrl,
      mimeType: processed.mimeType,
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

async function seedIfEmpty(options: { demo?: boolean } = {}): Promise<void> {
  const userCount = await usersRepository.count();
  if (userCount > 0) return;

  const now = Date.now();
  const daysAgo = (days: number) =>
    new Date(now + days * 24 * 60 * 60 * 1000).toISOString();

  // SuperAdmin inicial
  const { salt, hash } = await hashPassword(INITIAL_SUPERADMIN_PASSWORD);
  const superadmin: User = {
    id: createId(),
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
  };
  await db.users.add(superadmin);

  // Configurações padrão — em PRODUÇÃO a assinatura oficial já vem
  // pronta; em DESENVOLVIMENTO a assinatura nasce vazia (os testes
  // exercitam o bloqueio de geração e o envio pela tela).
  const officialSignature: Partial<SignatureSettings> = import.meta.env.DEV
    ? {}
    : await loadOfficialSignature();
  await db.settings.put({
    ...DEFAULT_SETTINGS,
    signature: { ...DEFAULT_SETTINGS.signature, ...officialSignature },
    updatedAt: new Date().toISOString(),
  });

  // ------------------------------------------------------------------
  // DADOS DE DEMONSTRAÇÃO — SOMENTE em desenvolvimento e na PRIMEIRA
  // execução. O build de produção (deploy) nasce em estado de primeira
  // utilização: zero associados, zero identificadores usados, zero
  // carteirinhas e zero registros fictícios de auditoria. O reset de
  // fábrica chama `seedIfEmpty({ demo: false })` — "LIMPAR" zera de
  // verdade e a demonstração NÃO volta, em qualquer ambiente.
  // ------------------------------------------------------------------
  if (!import.meta.env.DEV || options.demo === false) return;

  // Associados fictícios
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
  await db.members.bulkAdd(members);

  // Reserva PERMANENTE dos identificadores do seed: matrículas e códigos
  // já emitidos nunca poderão ser reutilizados.
  await db.usedIdentifiers.bulkAdd(
    members.flatMap((m) => [
      {
        value: m.membershipNumber,
        type: "membershipNumber" as const,
        usedAt: m.createdAt,
        memberId: m.id,
        memberName: m.fullName,
      },
      {
        value: m.cardCode,
        type: "cardCode" as const,
        usedAt: m.createdAt,
        memberId: m.id,
        memberName: m.fullName,
      },
    ])
  );

  // Duas carteirinhas já emitidas para demonstração
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
      generatedByUserId: superadmin.id,
      generatedByName: superadmin.name,
      pngDataUrl: null, // será gerado sob demanda na tela
      fileSizeBytes: null,
    }));
  await db.cards.bulkAdd(demoCards);

  // Auditoria inicial
  await db.audit.bulkAdd([
    {
      id: createId(),
      createdAt: daysAgo(-60),
      userId: superadmin.id,
      userName: superadmin.name,
      action: "USER_CREATED",
      entity: "user",
      entityId: superadmin.id,
      details: "Usuário inicial do sistema criado automaticamente",
    },
    ...members.map((m, index) => ({
      id: createId(),
      createdAt: m.createdAt,
      userId: superadmin.id,
      userName: superadmin.name,
      action: "MEMBER_CREATED" as const,
      entity: "member",
      entityId: m.id,
      details: `Associado "${m.fullName}" criado — matrícula ${m.membershipNumber}, código ${m.cardCode}${
        index === 0 ? " (seed inicial)" : ""
      }`,
    })),
    ...demoCards.map((c) => ({
      id: createId(),
      createdAt: c.generatedAt,
      userId: superadmin.id,
      userName: superadmin.name,
      action: "CARD_GENERATED" as const,
      entity: "card",
      entityId: c.id,
      details: `Carteirinha ${c.cardCode} gerada para "${c.memberName}" (matrícula ${c.membershipNumber})`,
    })),
  ]);
}

export { membershipCardCodeService, seedIfEmpty };
