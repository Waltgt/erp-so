import 'dotenv/config';
import { hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Rol } from '../src/generated/prisma/client';

// Crea el primer ADMIN con ADMIN_EMAIL / ADMIN_PASSWORD, SOLO si no existe
// ningún ADMIN. Idempotente: ejecutarlo de nuevo no duplica nada.
// Usa DATABASE_URL (erp_app): solo necesita INSERT, no permisos de dueño.

const PASSWORD_MIN = 10;

function variable(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    throw new Error(`Falta la variable ${nombre} en .env`);
  }
  return valor;
}

async function main(): Promise<void> {
  const email = variable('ADMIN_EMAIL').toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (password.length < PASSWORD_MIN) {
    throw new Error(
      `ADMIN_PASSWORD debe tener al menos ${PASSWORD_MIN} caracteres`,
    );
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString: variable('DATABASE_URL') },
      { schema: 'erp' },
    ),
  });

  try {
    const admins = await prisma.usuario.count({ where: { rol: Rol.ADMIN } });
    if (admins > 0) {
      console.log(`Seed: ya existe(n) ${admins} ADMIN; no se crea ninguno.`);
      return;
    }

    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      throw new Error(
        `El email ${email} ya pertenece a un usuario ${existente.rol}; usa otro ADMIN_EMAIL`,
      );
    }

    const admin = await prisma.usuario.create({
      data: {
        nombre: 'Administrador',
        email,
        rol: Rol.ADMIN,
        passwordHash: await hash(password),
      },
      select: { id: true, email: true },
    });
    console.log(`Seed: ADMIN creado (id ${admin.id}, ${admin.email}).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Seed falló:',
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
