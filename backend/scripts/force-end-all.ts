import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Force-ending all currently active calls...');
  const result = await prisma.room.updateMany({
    where: {
      status: 'active',
    },
    data: {
      status: 'ended',
      endedAt: new Date(),
    },
  });
  console.log(`Successfully force-ended ${result.count} active calls.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
