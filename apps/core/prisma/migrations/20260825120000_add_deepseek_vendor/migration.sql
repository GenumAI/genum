-- AlterEnum
-- Added BEFORE 'CUSTOM_OPENAI_COMPATIBLE' so the database enum order matches schema.prisma.
ALTER TYPE "AiVendor" ADD VALUE 'DEEPSEEK' BEFORE 'CUSTOM_OPENAI_COMPATIBLE';
