// Creates (or updates the password of) the first manager account from .env
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const { ADMIN_NAME = "Admin", ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.");
  process.exit(1);
}

const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
const user = await prisma.user.upsert({
  where: { email: ADMIN_EMAIL.toLowerCase() },
  update: { passwordHash, role: "MANAGER", active: true },
  create: { name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase(), passwordHash, role: "MANAGER" },
});
console.log(`Manager ready: ${user.email}`);
await prisma.$disconnect();
