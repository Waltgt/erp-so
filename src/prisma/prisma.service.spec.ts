import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let servicio: PrismaService;

  beforeEach(() => {
    const config = {
      get: jest
        .fn()
        .mockReturnValue('postgresql://u:p@127.0.0.1:5432/x?schema=erp'),
    } as unknown as ConfigService;
    servicio = new PrismaService(config as never);
  });

  it('usa DATABASE_URL y expone los modelos', () => {
    expect(typeof servicio.usuario.findMany).toBe('function');
  });

  it('conecta y verifica la base con una consulta en onModuleInit', async () => {
    const conectar = jest
      .spyOn(servicio, '$connect')
      .mockResolvedValue(undefined);
    const consultar = jest
      .spyOn(servicio, '$queryRaw')
      .mockResolvedValue([{ '?column?': 1 }] as never);
    await servicio.onModuleInit();
    expect(conectar).toHaveBeenCalledTimes(1);
    expect(consultar).toHaveBeenCalledTimes(1);
  });

  it('falla en onModuleInit si la base no responde (la app no arranca)', async () => {
    jest.spyOn(servicio, '$connect').mockResolvedValue(undefined);
    jest
      .spyOn(servicio, '$queryRaw')
      .mockRejectedValue(new Error('no pg_hba.conf entry'));
    await expect(servicio.onModuleInit()).rejects.toThrow('pg_hba.conf');
  });

  it('desconecta en onModuleDestroy', async () => {
    const desconectar = jest
      .spyOn(servicio, '$disconnect')
      .mockResolvedValue(undefined);
    await servicio.onModuleDestroy();
    expect(desconectar).toHaveBeenCalledTimes(1);
  });
});
