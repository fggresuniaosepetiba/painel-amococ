import bcrypt from "bcryptjs";

// Hash de senhas com bcrypt (ADR-004). Interface isolada: permite trocar o
// algoritmo (ex.: argon2) sem tocar nos serviços. Custo 12.

const COST_FACTOR = 12;

export const passwordHasher = {
  async hash(plain: string): Promise<{ salt: string; hash: string }> {
    const salt = await bcrypt.genSalt(COST_FACTOR);
    const hash = await bcrypt.hash(plain, salt);
    return { salt, hash };
  },

  async verify(
    plain: string,
    hash: string,
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  },
};
