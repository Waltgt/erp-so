import { Body, Controller, Get, Module, Post, Query } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { PaginacionQueryDto } from '../src/common/dto/paginacion.dto';
import { configurarApp, configurarSwagger } from '../src/configurar-app';

// Arranque de la app con la misma configuración que main.ts, pero sin
// base de datos: un controlador de prueba reemplaza a los módulos reales.
class EcoDto {
  @IsString()
  nombre!: string;
}

@Controller('eco')
class EcoController {
  @Post()
  crear(@Body() dto: EcoDto): EcoDto {
    return dto;
  }

  @Get()
  listar(@Query() query: PaginacionQueryDto): PaginacionQueryDto {
    return query;
  }
}

@Module({ controllers: [EcoController] })
class EcoModule {}

describe('Configuración de la app (e2e)', () => {
  let app: NestExpressApplication;
  let servidor: App;

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      imports: [EcoModule],
    }).compile();
    app = modulo.createNestApplication<NestExpressApplication>();
    configurarApp(app);
    configurarSwagger(app);
    await app.init();
    servidor = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('un body válido responde 201 bajo el prefijo /api', () => {
    return request(servidor)
      .post('/api/eco')
      .send({ nombre: 'ok' })
      .expect(201, { nombre: 'ok' });
  });

  it('un campo extra no declarado responde 400', async () => {
    const res = await request(servidor)
      .post('/api/eco')
      .send({ nombre: 'ok', esAdmin: true })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('esAdmin');
  });

  it('sin el prefijo /api responde 404', () => {
    return request(servidor).post('/eco').send({ nombre: 'ok' }).expect(404);
  });

  it('convierte y valida la paginación de la query', async () => {
    await request(servidor)
      .get('/api/eco?page=2&limit=5')
      .expect(200, { page: 2, limit: 5 });
    await request(servidor).get('/api/eco?limit=101').expect(400);
  });

  it('helmet agrega cabeceras de seguridad', async () => {
    const res = await request(servidor).get('/api/eco').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('Swagger responde en /api/docs', () => {
    return request(servidor).get('/api/docs').expect(200);
  });
});
