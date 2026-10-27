import { escaparLike } from './escapar-like';

describe('escaparLike', () => {
  it.each([
    ['perez', 'perez'],
    ['100%', '100\\%'],
    ['a_b', 'a\\_b'],
    ['c:\\ruta', 'c:\\\\ruta'],
    ['%_\\', '\\%\\_\\\\'],
  ])('"%s" → "%s"', (entrada, esperado) => {
    expect(escaparLike(entrada)).toBe(esperado);
  });
});
