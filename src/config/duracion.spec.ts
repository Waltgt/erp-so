import { duracionEnSegundos } from './duracion';

describe('duracionEnSegundos', () => {
  it.each([
    ['3600', 3600],
    ['30s', 30],
    ['15m', 900],
    ['8h', 28800],
    ['7d', 604800],
  ])('"%s" → %d segundos', (valor, esperado) => {
    expect(duracionEnSegundos(valor)).toBe(esperado);
  });

  it.each(['', '8 horas', '1.5h', '-1h', '8w'])('rechaza "%s"', (valor) => {
    expect(() => duracionEnSegundos(valor)).toThrow('Duración inválida');
  });
});
