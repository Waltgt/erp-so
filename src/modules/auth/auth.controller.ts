import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { UsuarioActual } from '../../common/decorators/usuario-actual.decorator';
import { UsuarioRespuestaDto } from '../usuarios/dto/usuario-respuesta.dto';
import type { UsuarioPublico } from '../usuarios/usuario.types';
import { AuthService } from './auth.service';
import { CambiarPasswordDto } from './dto/cambiar-password.dto';
import { LoginDto, LoginRespuestaDto } from './dto/login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiOkResponse({ type: LoginRespuestaDto })
  @ApiUnauthorizedResponse({ description: 'Credenciales inválidas' })
  @ApiTooManyRequestsResponse({
    description: 'Más de 5 intentos por minuto desde la misma IP',
  })
  login(@Body() dto: LoginDto): Promise<LoginRespuestaDto> {
    return this.auth.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario actual' })
  @ApiOkResponse({ type: UsuarioRespuestaDto })
  @ApiUnauthorizedResponse()
  me(@UsuarioActual() usuario: UsuarioPublico): UsuarioPublico {
    return usuario;
  }

  @Patch('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar la propia contraseña' })
  @ApiNoContentResponse({ description: 'Contraseña cambiada' })
  @ApiBadRequestResponse({
    description: 'Contraseña actual incorrecta o nueva inválida',
  })
  @ApiUnauthorizedResponse()
  cambiarPassword(
    @UsuarioActual() usuario: UsuarioPublico,
    @Body() dto: CambiarPasswordDto,
  ): Promise<void> {
    return this.auth.cambiarPassword(usuario.id, dto);
  }
}
