// Runs on every start: makes sure the manager account and the default brands exist.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const { ADMIN_NAME = "Admin", ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

const BRANDS = [
  { slug: "cizaro", name: "Cizaro", color: "#3b47b0", sort: 0 },
  { slug: "dym", name: "DYM", color: "#7B4DE8", sort: 1 },
];
for (const b of BRANDS) await prisma.brand.upsert({ where: { slug: b.slug }, update: {}, create: b });

// DYM briefly shipped with a placeholder black; move it to the brand purple unless someone picked a color since
await prisma.brand.updateMany({ where: { slug: "dym", color: "#111111" }, data: { color: "#7B4DE8" } });

// Tasks created before brands existed belong to Cizaro
const cizaro = await prisma.brand.findUnique({ where: { slug: "cizaro" } });
const moved = await prisma.task.updateMany({ where: { brandId: null }, data: { brandId: cizaro.id } });
if (moved.count) console.log(`Assigned ${moved.count} older tasks to Cizaro`);

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD to create the manager account.");
} else {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL.toLowerCase() },
    update: { passwordHash, role: "MANAGER", active: true },
    create: { name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase(), passwordHash, role: "MANAGER" },
  });
  console.log(`Manager ready: ${user.email}`);
}
await prisma.$disconnect();
