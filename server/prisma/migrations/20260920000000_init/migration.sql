-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RH', 'LIDER', 'COLABORADOR');
CREATE TYPE "SurveyType" AS ENUM ('CLIMA', 'EVAL_360');
CREATE TYPE "SurveyStatus" AS ENUM ('BORRADOR', 'ACTIVA', 'CERRADA');
CREATE TYPE "Dimension" AS ENUM ('LIDERAZGO', 'COMUNICACION', 'RECONOCIMIENTO', 'CARGA_TRABAJO', 'DESARROLLO', 'CONDICIONES', 'PERMANENCIA');
CREATE TYPE "QuestionType" AS ENUM ('LIKERT_5', 'ABIERTA');
CREATE TYPE "Relation" AS ENUM ('SUPERVISOR', 'PAR', 'AUTO');
CREATE TYPE "TenureBand" AS ENUM ('MENOS_6M', 'DE_6M_A_1A', 'DE_1A_A_3A', 'MAS_3A');
CREATE TYPE "AlertLevel" AS ENUM ('MEDIO', 'ALTO', 'CRITICO');
CREATE TYPE "AlertStatus" AS ENUM ('NUEVA', 'EN_SEGUIMIENTO', 'ATENDIDA', 'DESCARTADA');

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "areaId" TEXT NOT NULL,
    "supervisorId" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Survey" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "SurveyType" NOT NULL,
    "status" "SurveyStatus" NOT NULL DEFAULT 'BORRADOR',
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "minGroupSize" INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT "Survey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "dimension" "Dimension" NOT NULL,
    "text" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'LIKERT_5',
    "relation" "Relation",
    "order" INTEGER NOT NULL,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "evaluatedUserId" TEXT,
    "relation" "Relation",
    "usedAt" TIMESTAMP(3),
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "tenureBand" "TenureBand" NOT NULL,
    "evaluatedUserId" TEXT,
    "relation" "Relation",
    "submittedOn" DATE NOT NULL,
    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value" INTEGER,
    "text" TEXT,
    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TurnoverRecord" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "headcountStart" INTEGER NOT NULL,
    "exits" INTEGER NOT NULL,
    "voluntaryExits" INTEGER NOT NULL,
    CONSTRAINT "TurnoverRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "level" "AlertLevel" NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "drivers" JSONB NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'NUEVA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AlertAction" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    CONSTRAINT "AlertAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RiskConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "weights" JSONB NOT NULL,
    "levels" JSONB NOT NULL,
    CONSTRAINT "RiskConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Area_name_key" ON "Area"("name");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Alert_surveyId_areaId_key" ON "Alert"("surveyId", "areaId");

-- Índices únicos parciales: evitan invitaciones duplicadas aun con columnas nulas.
CREATE UNIQUE INDEX "Invitation_clima_unique" ON "Invitation"("surveyId", "userId")
  WHERE "evaluatedUserId" IS NULL;
CREATE UNIQUE INDEX "Invitation_360_unique" ON "Invitation"("surveyId", "userId", "evaluatedUserId")
  WHERE "evaluatedUserId" IS NOT NULL;

-- Consultas frecuentes
CREATE INDEX "Response_surveyId_areaId_idx" ON "Response"("surveyId", "areaId");
CREATE INDEX "Answer_responseId_idx" ON "Answer"("responseId");
CREATE INDEX "Invitation_userId_idx" ON "Invitation"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Question" ADD CONSTRAINT "Question_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Response" ADD CONSTRAINT "Response_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TurnoverRecord" ADD CONSTRAINT "TurnoverRecord_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AlertAction" ADD CONSTRAINT "AlertAction_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
