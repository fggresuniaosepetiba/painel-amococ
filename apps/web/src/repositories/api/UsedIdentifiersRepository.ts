import { api } from "@/lib/apiClient";
import type { UsedIdentifier } from "@amococ/shared";
import type { UsedIdentifiersRepository } from "../types";

export class ApiUsedIdentifiersRepository implements UsedIdentifiersRepository {
  async getAll(): Promise<UsedIdentifier[]> {
    return api<UsedIdentifier[]>("/api/used-identifiers");
  }

  async isUsed(value: string): Promise<boolean> {
    const data = await api<{ used: boolean }>(
      `/api/used-identifiers/check?value=${encodeURIComponent(value)}`
    );
    return data.used;
  }

  /** Idempotente no servidor (primeiro registro é a história definitiva). */
  async register(record: UsedIdentifier): Promise<void> {
    await api("/api/used-identifiers", {
      method: "POST",
      body: {
        value: record.value,
        type: record.type,
        memberId: record.memberId,
        memberName: record.memberName,
      },
    });
  }
}
