-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('WALLET_REGISTER', 'PASS', 'PHONE');

-- CreateEnum
CREATE TYPE "VerifyStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "verification_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerifyStatus" NOT NULL,
    "phoneHash" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "verification_logs" ADD CONSTRAINT "verification_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
