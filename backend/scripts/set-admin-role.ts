import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Setting admin roles...');
  
  // Update User table
  const u = await prisma.user.update({
    where: { username: 'admin' },
    data: { role: 'admin' }
  });
  console.log('Updated User table role for:', u.username, 'to', u.role);

  // Update SecurityUserState table
  const state = await prisma.$executeRaw`
    INSERT INTO security_user_state (user_id, role, is_verified, updated_at)
    VALUES (${u.id}, 'admin', true, NOW())
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin', is_verified = true, updated_at = NOW()
  `;
  console.log('Updated security_user_state result:', state);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
