import { PasswordService } from './password.service';

// Usa argon2 real (no simulado): comprueba que la librería funciona
describe('PasswordService', () => {
  const servicio = new PasswordService();

  it('genera un hash argon2id que no contiene la contraseña', async () => {
    const hash = await servicio.hashear('contraseña-larga');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain('contraseña-larga');
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await servicio.hashear('contraseña-larga');
    await expect(servicio.verificar(hash, 'contraseña-larga')).resolves.toBe(
      true,
    );
    await expect(servicio.verificar(hash, 'otra-contraseña')).resolves.toBe(
      false,
    );
  });

  it('un hash mal formado cuenta como incorrecta (no lanza)', async () => {
    await expect(servicio.verificar('no-es-un-hash', 'x')).resolves.toBe(false);
  });
});
