import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clean() {
  console.log('Cleaning database, keeping User and Session tables intact...');

  // Delete logs and caches
  await prisma.systemLog.deleteMany({});
  await prisma.securityLog.deleteMany({});
  await prisma.securityCode.deleteMany({});

  // Delete all call history and meta
  await prisma.callAnalysis.deleteMany({});
  await prisma.callQualityMetrics.deleteMany({});
  await prisma.moderationCallFlag.deleteMany({});
  await prisma.call.deleteMany({});

  // Delete all chat history
  await prisma.chatMessage.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.chatMember.deleteMany({});
  await prisma.chat.deleteMany({});

  // Delete auxiliary data
  await prisma.notification.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.blacklist.deleteMany({});
  await prisma.userBlacklist.deleteMany({});
  await prisma.supportRequest.deleteMany({});
  await prisma.contact.deleteMany({});

  console.log('Database cleaned successfully!');
}

clean()
  .catch((e) => {
    console.error('Error cleaning database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
