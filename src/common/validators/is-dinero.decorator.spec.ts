import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IsDinero } from './is-dinero.decorator';

class DtoPrueba {
  @IsDinero()
  precio!: string;
}

function validar(precio: unknown) {
  const dto = plainToInstance(DtoPrueba, { precio });
  return { dto, errores: validateSync(dto) };
}

describe('IsDinero', () => {
  it.each(['0', '12', '12.5', '12.50', '9999999999.99'])(
    'acepta el string "%s"',
    (valor) => {
      expect(validar(valor).errores).toHaveLength(0);
    },
  );

  it('acepta un number y lo deja como string', () => {
    const { dto, errores } = validar(12.5);
    expect(errores).toHaveLength(0);
    expect(dto.precio).toBe('12.5');
  });

  it.each([
    ['más de 2 decimales', '12.345'],
    ['negativo', '-1'],
    ['texto', 'doce'],
    ['vacío', ''],
    ['más de 10 dígitos enteros', '12345678901'],
    ['notación científica', 1e21],
    ['error de punto flotante', 0.1 + 0.2],
    ['booleano', true],
    ['null', null],
  ])('rechaza %s', (_caso, valor) => {
    expect(validar(valor).errores).not.toHaveLength(0);
  });
});
