import { describe, expect, it, vi } from "vitest";
import {
  buildCardCode,
  buildCardFileName,
  formatMembershipNumber,
  generateUniqueCardCode,
  isValidCardCode,
  isValidCpf,
  isValidIsoDate,
  isValidMembershipNumber,
  nextMembershipNumber,
} from "./identifiers.js";

describe("matrícula", () => {
  it("formata com 6 dígitos e zero à esquerda", () => {
    expect(formatMembershipNumber(1)).toBe("000001");
    expect(formatMembershipNumber(27)).toBe("000027");
  });

  it("valida o formato /\\d{6}/", () => {
    expect(isValidMembershipNumber("000001")).toBe(true);
    expect(isValidMembershipNumber("12345")).toBe(false);
    expect(isValidMembershipNumber("ABCDEF")).toBe(false);
  });

  it("próxima = max(membros, reserva) + 1", () => {
    expect(nextMembershipNumber(null, [])).toBe("000001");
    expect(nextMembershipNumber(4, [])).toBe("000005");
    // Reserva conta mesmo após exclusão: nunca reutiliza.
    expect(nextMembershipNumber(2, [5])).toBe("000006");
    expect(nextMembershipNumber(null, [27])).toBe("000028");
  });
});

describe("código da carteirinha", () => {
  it("usa os últimos 5 dígitos da matrícula", () => {
    expect(buildCardCode("000001", "A8ZK")).toBe("AMOCOC-00001-A8ZK");
  });

  it("valida o formato oficial", () => {
    expect(isValidCardCode("AMOCOC-00001-A8ZK")).toBe(true);
    expect(isValidCardCode("AMOCOC-00001-A8ZKQ2")).toBe(true);
    expect(isValidCardCode("AMOCOC-1-A8ZK")).toBe(false);
    expect(isValidCardCode("AMOCOC-00001-A8ZK12")).toBe(false); // "1" é ambíguo
    // A validação aceita A-Z (a restrição sem I/O vale só para a GERAÇÃO).
    expect(isValidCardCode("AMOCOC-00001-I8ZK")).toBe(true);
  });

  it("gera sufixo sem caracteres ambíguos", () => {
    const code = buildCardCode("000001");
    expect(code).toMatch(/^AMOCOC-00001-[A-Z2-9]{4}$/);
  });

  it("regenera em caso de colisão e falha após esgotar tentativas", async () => {
    let calls = 0;
    const code = await generateUniqueCardCode("000001", async (c) => {
      calls++;
      return c.endsWith("AAAA");
    });
    expect(calls).toBeGreaterThan(0);
    expect(code).not.toMatch(/AAAA$/);

    await expect(
      generateUniqueCardCode("000001", async () => true),
    ).rejects.toThrow("CARD_CODE_GENERATION_FAILED");
  }, 30000);
});

describe("nome do arquivo PNG", () => {
  it("normaliza acentos, caixa e tamanho", () => {
    expect(buildCardFileName("AMOCOC-00001-A8ZK", "João da Silva")).toBe(
      "AMOCOC-00001-A8ZK-JOAO-DA-SILVA.png",
    );
    expect(buildCardFileName("AMOCOC-00001-A8ZK", "")).toBe(
      "AMOCOC-00001-A8ZK-ASSOCIADO.png",
    );
  });
});

describe("validações", () => {
  it("CPF com dígito verificador", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("data ISO real sem fuso", () => {
    expect(isValidIsoDate("1997-02-05")).toBe(true);
    expect(isValidIsoDate("05/02/1997")).toBe(false);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
  });

  it("nunca usa Math.random (CSPRNG do node:crypto)", () => {
    const spy = vi.spyOn(Math, "random");
    buildCardCode("000001");
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
