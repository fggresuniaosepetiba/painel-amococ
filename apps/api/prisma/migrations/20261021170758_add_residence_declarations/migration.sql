-- CreateTable
CREATE TABLE "residenceDeclarations" (
    "id" TEXT NOT NULL,
    "residentName" TEXT NOT NULL,
    "birthDate" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "residenceYears" INTEGER NOT NULL,
    "residenceMonths" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedByUserId" TEXT NOT NULL,
    "issuedByName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "inactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "residenceDeclarations_pkey" PRIMARY KEY ("id")
);
