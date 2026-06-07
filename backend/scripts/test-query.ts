import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Inspection ---');
  try {
    const usersCount = await prisma.user.count();
    console.log('Users count:', usersCount);

    const roomsCount = await prisma.room.count();
    console.log('Rooms count:', roomsCount);

    const activeRoomsCount = await prisma.room.count({ where: { status: 'active' } });
    console.log('Active Rooms count:', activeRoomsCount);

    const endedRoomsCount = await prisma.room.count({ where: { status: 'ended' } });
    console.log('Ended Rooms count:', endedRoomsCount);

    const blacklistCount = await prisma.blacklist.count();
    console.log('Blacklist entries:', blacklistCount);

    try {
      const sessionsCount = await prisma.$queryRaw`SELECT COUNT(*) FROM security_sessions`;
      console.log('security_sessions count:', sessionsCount);
    } catch (e: any) {
      console.error('Error querying security_sessions:', e.message);
    }

    try {
      const logsCount = await prisma.$queryRaw`SELECT COUNT(*) FROM security_logs`;
      console.log('security_logs count:', logsCount);
    } catch (e: any) {
      console.error('Error querying security_logs:', e.message);
    }

    try {
      const qualityCount = await prisma.$queryRaw`SELECT COUNT(*) FROM call_quality_metrics`;
      console.log('call_quality_metrics count:', qualityCount);
    } catch (e: any) {
      console.error('Error querying call_quality_metrics:', e.message);
    }
    
    // Print some users
    const users = await prisma.user.findMany({ select: { id: true, username: true, role: true } });
    console.log('All Users:', users);

    // Print all active rooms
    const activeRooms = await prisma.room.findMany({ where: { status: 'active' } });
    console.log('Active rooms details:', activeRooms);
  } catch (err: any) {
    console.error('Inspection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
