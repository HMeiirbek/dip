import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('Connected to DB via Prisma');

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE call_quality_metrics RENAME COLUMN call_id TO room_id;');
    console.log('Renamed call_id to room_id in call_quality_metrics');
  } catch (err: any) {
    console.error('Error renaming in call_quality_metrics:', err.message);
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE moderation_call_flags RENAME COLUMN call_id TO room_id;');
    console.log('Renamed call_id to room_id in moderation_call_flags');
  } catch (err: any) {
    console.error('Error renaming in moderation_call_flags:', err.message);
  }

  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "CallAnalysis" RENAME COLUMN "callId" TO "roomId";');
    console.log('Renamed callId to roomId in CallAnalysis');
  } catch (err: any) {
    console.error('Error renaming in CallAnalysis:', err.message);
  }

  try {
    await prisma.$executeRawUnsafe('DELETE FROM call_quality_metrics WHERE room_id NOT IN (SELECT id FROM "Room");');
    console.log('Cleaned up orphan rows in call_quality_metrics');
  } catch (err: any) {
    console.error('Error cleaning up call_quality_metrics:', err.message);
  }

  await prisma.$disconnect();
}

run();
