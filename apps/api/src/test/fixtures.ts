import type { MemberDraftInput } from "../shared/validation.js";

export function memberDraft(overrides: Partial<MemberDraftInput> = {}): MemberDraftInput {
  return {
    fullName: "Teste da Silva",
    cpf: "52998224725",
    birthDate: "1990-01-15",
    phone: "(85) 99999-0000",
    whatsapp: "(85) 99999-0000",
    cep: "60000-000",
    address: "Rua Teste",
    addressNumber: "10",
    complement: "",
    district: "Centro",
    city: "Fortaleza",
    state: "CE",
    photoDataUrl: null,
    notes: "",
    ...overrides,
  };
}

export const ACTOR = { id: "actor-1", name: "Ator Teste" };
