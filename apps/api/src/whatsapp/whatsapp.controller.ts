import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { WhatsAppConfigService } from './whatsapp-config.service';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { CreateWhatsAppConfigDto } from './dto/create-whatsapp-config.dto';
import { UpdateWhatsAppConfigDto } from './dto/update-whatsapp-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(
    private readonly whatsappConfigService: WhatsAppConfigService,
    private readonly whatsappBotService: WhatsAppBotService,
  ) {}

  @Get('config')
  async getConfig(@Request() req: any) {
    const storeId = req.user.store_id;
    return this.whatsappConfigService.findOne(storeId);
  }

  @Post('config')
  @Roles('owner')
  async createConfig(
    @Body() dto: CreateWhatsAppConfigDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.whatsappConfigService.upsert(storeId, dto);
  }

  @Patch('config')
  @Roles('owner')
  async updateConfig(
    @Body() dto: UpdateWhatsAppConfigDto,
    @Request() req: any,
  ) {
    const storeId = req.user.store_id;
    return this.whatsappConfigService.update(storeId, dto);
  }

  @Get('qr')
  @Roles('owner')
  async getQRCode(@Request() req: any) {
    const storeId = req.user.store_id;

    // Verificar si el bot está conectado
    const isConnected = this.whatsappBotService.isConnected(storeId);
    
    // Si ya está conectado, no necesitamos QR
    if (isConnected) {
      return {
        qrCode: null,
        isConnected: true,
      };
    }

    // Obtener QR actual antes de decidir si reinicializar
    let qrCode = await this.whatsappBotService.getQRCode(storeId);
    
    // Si no hay QR disponible, forzar reinicialización del bot
    if (!qrCode) {
      this.logger.log(`No hay QR disponible para tienda ${storeId}, reinicializando bot...`);
      
      // Desconectar bot existente si existe
      try {
        await this.whatsappBotService.disconnect(storeId);
      } catch (error) {
        // Ignorar errores si no existe
        this.logger.debug(`Error al desconectar bot (puede que no exista):`, error);
      }
      
      // Esperar un momento antes de reinicializar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reinicializar el bot (esto generará un nuevo QR si no hay sesión guardada)
      await this.whatsappBotService.initializeBot(storeId, true);
      
      // Esperar un momento para que se genere el QR (Baileys puede tardar un poco)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Obtener el nuevo QR
      qrCode = await this.whatsappBotService.getQRCode(storeId);
      
      // Si aún no hay QR después de reinicializar, puede que haya sesión guardada corrupta
      // En ese caso, limpiar la sesión y reinicializar de nuevo
      if (!qrCode) {
        this.logger.warn(`No se generó QR después de reinicializar para tienda ${storeId}. Limpiando sesión y reintentando...`);
        
        // Limpiar sesión guardada
        await this.whatsappBotService.clearSession(storeId);
        
        // Esperar un momento
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reinicializar de nuevo (ahora sin sesión, debería generar QR)
        await this.whatsappBotService.initializeBot(storeId, true);
        
        // Esperar para que se genere el QR
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Obtener el nuevo QR
        qrCode = await this.whatsappBotService.getQRCode(storeId);
      }
    } else {
      // Si hay QR pero no está conectado, asegurarse de que el bot esté inicializado
      await this.whatsappBotService.initializeBot(storeId);
    }

    return {
      qrCode,
      isConnected: this.whatsappBotService.isConnected(storeId),
    };
  }

  @Get('status')
  async getStatus(@Request() req: any) {
    const storeId = req.user.store_id;

    // Si el bot no está inicializado pero hay una sesión guardada, inicializarlo
    // Esto restaura automáticamente la conexión si la sesión es válida
    const botExists = this.whatsappBotService.hasBot(storeId);
    const hasSession = this.whatsappBotService.hasSavedSession(storeId);
    
    if (!botExists && hasSession) {
      this.logger.log(`Bot no inicializado pero hay sesión guardada para tienda ${storeId}, restaurando conexión...`);
      try {
        await this.whatsappBotService.initializeBot(storeId);
        // Esperar un momento para que Baileys restaure la conexión desde la sesión guardada
        // Baileys se conecta automáticamente si hay credenciales válidas
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        this.logger.warn(`Error restaurando bot para tienda ${storeId}:`, error);
      }
    }

    const isConnected = this.whatsappBotService.isConnected(storeId);
    const whatsappNumber = this.whatsappBotService.getWhatsAppNumber(storeId);
    const connectionState = this.whatsappBotService.getConnectionState(storeId);

    return {
      isConnected,
      whatsappNumber,
      connectionState: connectionState || null,
    };
  }

  @Post('disconnect')
  @Roles('owner')
  async disconnect(@Request() req: any) {
    const storeId = req.user.store_id;
    await this.whatsappBotService.disconnect(storeId);
    return { success: true, message: 'Bot desconectado exitosamente' };
  }
}
