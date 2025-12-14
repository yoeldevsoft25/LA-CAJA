import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request, Get, Param, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { CreateCashierDto } from './dto/create-cashier.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('stores')
  async getStores(): Promise<Array<{ id: string; name: string }>> {
    return this.authService.getStores();
  }

  @Get('stores/:storeId/cashiers')
  async getCashiers(@Request() req: any, @Param('storeId') storeId: string): Promise<Array<{ user_id: string; full_name: string | null; role: string }>> {
    return this.authService.getCashiers(storeId);
  }

  @Post('stores')
  @HttpCode(HttpStatus.CREATED)
  async createStore(@Body() dto: CreateStoreDto, @Request() req: any): Promise<{ store: any; member: any }> {
    // TODO: En producción, obtener userId del token JWT
    // Por ahora usamos un UUID temporal para desarrollo
    const ownerUserId = req.user?.sub || '00000000-0000-0000-0000-000000000001';
    return this.authService.createStore(dto, ownerUserId);
  }

  @Post('cashiers')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createCashier(@Body() dto: CreateCashierDto, @Request() req: any): Promise<any> {
    const ownerUserId = req.user.sub;
    return this.authService.createCashier(dto, ownerUserId);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: any): Promise<AuthResponseDto> {
    console.log('🔵 [AuthController] Login request received (raw body):', JSON.stringify(body, null, 2));
    console.log('🔵 [AuthController] Body type analysis:', {
      isObject: typeof body === 'object',
      keys: Object.keys(body || {}),
      store_id: body?.store_id,
      store_id_type: typeof body?.store_id,
      store_id_length: body?.store_id?.length,
      pin: body?.pin,
      pin_type: typeof body?.pin,
    });
    
    // Validación manual antes de pasar al DTO
    if (!body || !body.store_id || !body.pin) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: [
          !body?.store_id ? 'store_id should not be empty' : null,
          !body?.pin ? 'pin should not be empty' : null,
        ].filter(Boolean),
      });
    }
    
    const dto: LoginDto = {
      store_id: String(body.store_id).trim(),
      pin: String(body.pin).trim(),
    };
    
    return this.authService.login(dto);
  }
}

