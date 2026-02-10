#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('username', { type: 'string', demandOption: true })
  .option('password', { type: 'string', demandOption: true })
  .help()
  .argv;

async function main() {
  const prisma = new PrismaClient();
  try {
    const hashed = await bcrypt.hash(argv.password, 10);
    const user = await prisma.user.create({
      data: {
        username: argv.username,
        password: hashed,
      },
    });
    console.log('User created:', { id: user.id, username: user.username });
  } catch (err) {
    console.error('Failed to create user:', err.message || err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
