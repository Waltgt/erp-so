import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { VariablesEntorno } from '../config/env.validation';

// Cliente de Prisma para toda la app. Se conecta como erp_app (DATABASE_URL),
// nunca como erp_owner: la app en ejecución solo tiene permisos DML.
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(config: ConfigService<VariablesEntorno, true>) {
    const adapter = new PrismaPg(
      { connectionString: config.get('DATABASE_URL', { infer: true }) },
      { schema: 'erp' },
    );
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    // Con el adaptador pg, $connect() no abre conexiones (el pool es lazy).
    // Esta consulta hace que la app NO arranque si la base no responde.
    await this.$queryRaw`SELECT 1`;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
