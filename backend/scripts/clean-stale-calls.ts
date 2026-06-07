import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning up stale active calls...');
  const staleTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
  
  const result = await prisma.room.updateMany({
    where: {
      status: 'active',
      startedAt: {
        lt: staleTime,
      },
    },
    data: {
      status: 'ended',
      endedAt: new Date(),
    },
  });
  
  console.log(`Successfully ended ${result.count} stale active calls.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
