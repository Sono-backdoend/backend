-- AlterTable
ALTER TABLE "Guest"
ADD COLUMN "confirmationStartsAt" TIMESTAMP(3),
ADD COLUMN "confirmationEndsAt" TIMESTAMP(3);
