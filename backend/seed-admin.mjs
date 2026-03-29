import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const hash = await bcrypt.hash('1234', 10);

await prisma.user.upsert({
  where: { email: 'admin@gmail.com' },
  update: { passwordHash: hash, role: 'ADMIN' },
  create: { name: 'Admin', email: 'admin@gmail.com', passwordHash: hash, role: 'ADMIN' },
});

// Remove old admin if it exists
await prisma.user.deleteMany({ where: { email: 'admin@college.ac.uk' } });

console.log('Admin updated! Email: admin@gmail.com  Password: 1234');
await prisma.$disconnect();
