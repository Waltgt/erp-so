import { SetMetadata } from '@nestjs/common';

export const ES_PUBLICO = 'esPublico';

// El guard JWT es global: todo es privado salvo lo marcado con @Public()
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ES_PUBLICO, true);
