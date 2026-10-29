import { contentDisposition } from './content-disposition';

describe('contentDisposition', () => {
  it('ASCII: el mismo nombre en las dos formas', () => {
    expect(contentDisposition('attachment', 'informe final.pdf')).toBe(
      `attachment; filename="informe final.pdf"; filename*=UTF-8''informe%20final.pdf`,
    );
  });

  it('tildes y emoji: _ en filename y UTF-8 en filename*', () => {
    expect(contentDisposition('attachment', 'canción 😀.mp3')).toBe(
      `attachment; filename="canci_n _.mp3"; filename*=UTF-8''canci%C3%B3n%20%F0%9F%98%80.mp3`,
    );
  });

  it('comillas, barra invertida y paréntesis no rompen la cabecera', () => {
    expect(contentDisposition('attachment', `a"b\\c (1)'.txt`)).toBe(
      `attachment; filename="a_b_c (1)'.txt"; filename*=UTF-8''a%22b%5Cc%20%281%29%27.txt`,
    );
  });

  it('inline: igual, con la otra disposición', () => {
    expect(contentDisposition('inline', 'foto.png')).toBe(
      `inline; filename="foto.png"; filename*=UTF-8''foto.png`,
    );
  });
});
