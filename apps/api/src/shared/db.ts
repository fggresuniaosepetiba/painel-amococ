import type { PrismaClient } from "@prisma/client";

// Cliente de banco aceito por repositórios e serviços. É sempre o
// PrismaClient raiz (singleton em produção, isolado nos testes) — nenhuma
// operação aninha transações, então TransactionClient não é necessário.
export type Db = PrismaClient;
