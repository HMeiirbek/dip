const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('admin123', 10)
  const user = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', password: hash, role: 'admin' },
  })
  console.log('Created/Verified admin user:', user.username)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
