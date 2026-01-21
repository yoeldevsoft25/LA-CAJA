import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import makeWASocket, {
  ConnectionState,
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as QRCode from 'qrcode';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import pino from 'pino';

interface BotInstance {
  socket: WASocket | null;
  qrCode: string | null;
  isConnected: boolean;
  whatsappNumber: string | null;
  connectionState: ConnectionState | null;
}

/**
 * Servicio para gestionar bots de WhatsApp usando Baileys
 * Soporta múltiples instancias (una por tienda)
 */
@Injectable()
export class WhatsAppBotService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppBotService.name);
  private readonly bots = new Map<string, BotInstance>();
  private readonly sessionsDir = join(process.cwd(), 'whatsapp-sessions');

  constructor() {
    // Crear directorio de sesiones si no existe
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
      this.logger.log(`Directorio de sesiones creado: ${this.sessionsDir}`);
    }
  }

  /**
   * Inicializa un bot para una tienda
   * Si el bot ya existe pero no está conectado y no hay QR, lo reinicializa
   */
  async initializeBot(storeId: string, forceReinit: boolean = false): Promise<void> {
    const existingBot = this.bots.get(storeId);
    
    // Si se fuerza reinicialización, desconectar y eliminar bot existente
    if (forceReinit && existingBot) {
      this.logger.log(`Forzando reinicialización del bot para tienda ${storeId}`);
      if (existingBot.socket) {
        try {
          existingBot.socket.end(undefined);
        } catch (error) {
          this.logger.warn(`Error cerrando socket existente:`, error);
        }
      }
      this.bots.delete(storeId);
    } else if (existingBot && !forceReinit) {
      // Si el bot está conectado, no hacer nada
      if (existingBot.isConnected) {
        this.logger.log(`Bot ya conectado para tienda ${storeId}`);
        return;
      }
      
      // Si hay QR disponible, no reinicializar
      if (existingBot.qrCode) {
        this.logger.log(`Bot ya inicializado con QR disponible para tienda ${storeId}`);
        return;
      }
      
      // Si no está conectado y no hay QR, reinicializar automáticamente
      this.logger.log(`Bot existe pero sin QR ni conexión, reinicializando para tienda ${storeId}`);
      if (existingBot.socket) {
        try {
          existingBot.socket.end(undefined);
        } catch (error) {
          this.logger.warn(`Error cerrando socket existente:`, error);
        }
      }
      this.bots.delete(storeId);
    }

    const sessionPath = join(this.sessionsDir, storeId);
    if (!existsSync(sessionPath)) {
      mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const botInstance: BotInstance = {
      socket: null,
      qrCode: null,
      isConnected: false,
      whatsappNumber: null,
      connectionState: null,
    };

    this.bots.set(storeId, botInstance);

    try {
      const { version } = await fetchLatestBaileysVersion();
      this.logger.log(`Inicializando bot para tienda ${storeId} con Baileys v${version.join('.')}`);

      const socket = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        logger: pino({ level: 'silent' }), // Silenciar logs de Baileys
        generateHighQualityLinkPreview: true,
      });

      botInstance.socket = socket;

      // Manejar actualización de credenciales
      socket.ev.on('creds.update', async () => {
        await saveCreds();
        this.logger.log(`Credenciales actualizadas para tienda ${storeId}`);
      });

      // Manejar QR code
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Solo asignar si connection es un ConnectionState válido
        if (connection && ['close', 'connecting', 'open'].includes(connection)) {
          botInstance.connectionState = connection as unknown as ConnectionState;
        } else {
          botInstance.connectionState = null;
        }

        if (qr) {
          // Generar QR code como imagen base64
          try {
            const qrCodeDataUrl = await QRCode.toDataURL(qr);
            botInstance.qrCode = qrCodeDataUrl;
            this.logger.log(`QR code generado para tienda ${storeId}`);
          } catch (error) {
            this.logger.error(`Error generando QR code para tienda ${storeId}:`, error);
          }
        }

        if (connection === 'close') {
          const shouldReconnect =
            (lastDisconnect?.error as Boom)?.output?.statusCode !==
            DisconnectReason.loggedOut;

          botInstance.isConnected = false;
          botInstance.qrCode = null;

          if (shouldReconnect) {
            this.logger.log(`Reconectando bot para tienda ${storeId}...`);
            // Reconectar después de un delay
            setTimeout(() => {
              this.initializeBot(storeId).catch((error) => {
                this.logger.error(`Error reconectando bot para tienda ${storeId}:`, error);
              });
            }, 3000);
          } else {
            this.logger.log(`Bot desconectado permanentemente para tienda ${storeId}. Se requiere re-autenticación.`);
            // Limpiar sesión si fue logged out
            botInstance.socket = null;
          }
        } else if (connection === 'open') {
          botInstance.isConnected = true;
          botInstance.qrCode = null;
          const jid = socket.user?.id;
          if (jid) {
            // Extraer número de WhatsApp del JID (formato: 584121234567@s.whatsapp.net)
            const number = jid.split('@')[0];
            botInstance.whatsappNumber = number;
            this.logger.log(`Bot conectado para tienda ${storeId}. Número: ${number}`);
          }
        } else if (connection === 'connecting') {
          // Cuando está conectando, el QR puede estar disponible
          // No hacer nada, solo esperar
        }
      });

      // Manejar errores - Baileys no tiene evento 'error' directo, se manejan en connection.update
    } catch (error) {
      this.logger.error(`Error inicializando bot para tienda ${storeId}:`, error);
      this.bots.delete(storeId);
      throw error;
    }
  }

  /**
   * Obtiene el QR code para autenticación
   * Si no hay QR y no está conectado, intenta reinicializar
   */
  async getQRCode(storeId: string): Promise<string | null> {
    const bot = this.bots.get(storeId);
    if (!bot) {
      // Intentar inicializar si no existe
      await this.initializeBot(storeId);
      const newBot = this.bots.get(storeId);
      return newBot?.qrCode || null;
    }
    
    // Si no hay QR y no está conectado, puede que necesite reinicialización
    // Pero no lo hacemos aquí para evitar loops, se hace en el controller
    return bot.qrCode;
  }

  /**
   * Verifica si el bot está conectado
   */
  isConnected(storeId: string): boolean {
    const bot = this.bots.get(storeId);
    return bot?.isConnected || false;
  }

  /**
   * Obtiene el número de WhatsApp conectado
   */
  getWhatsAppNumber(storeId: string): string | null {
    const bot = this.bots.get(storeId);
    return bot?.whatsappNumber || null;
  }

  /**
   * Obtiene el estado de conexión
   */
  getConnectionState(storeId: string): ConnectionState | null {
    const bot = this.bots.get(storeId);
    return bot?.connectionState || null;
  }

  /**
   * Envía un mensaje de texto
   */
  async sendMessage(
    storeId: string,
    phone: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const bot = this.bots.get(storeId);

    if (!bot || !bot.socket) {
      return {
        success: false,
        error: 'Bot no inicializado o no conectado',
      };
    }

    if (!bot.isConnected) {
      return {
        success: false,
        error: 'Bot no está conectado',
      };
    }

    try {
      // Formatear número de teléfono (asegurar formato internacional)
      const formattedPhone = this.formatPhoneNumber(phone);
      const jid = `${formattedPhone}@s.whatsapp.net`;

      // Enviar mensaje
      const result = await bot.socket.sendMessage(jid, {
        text: message,
      });

      this.logger.log(`Mensaje enviado a ${formattedPhone} para tienda ${storeId}`);
      return {
        success: true,
        messageId: result?.key?.id ?? undefined,
      };
    } catch (error: any) {
      this.logger.error(`Error enviando mensaje para tienda ${storeId}:`, error);
      return {
        success: false,
        error: error.message || 'Error desconocido al enviar mensaje',
      };
    }
  }

  /**
   * Desconecta el bot manualmente
   */
  async disconnect(storeId: string): Promise<void> {
    const bot = this.bots.get(storeId);
    if (bot?.socket) {
      bot.socket.end(undefined);
      this.bots.delete(storeId);
      this.logger.log(`Bot desconectado para tienda ${storeId}`);
    }
  }

  /**
   * Limpia la sesión guardada para forzar nueva autenticación
   */
  async clearSession(storeId: string): Promise<void> {
    const sessionPath = join(this.sessionsDir, storeId);
    
    // Desconectar bot si existe
    await this.disconnect(storeId);
    
    // Eliminar archivos de sesión
    if (existsSync(sessionPath)) {
      try {
        rmSync(sessionPath, { recursive: true, force: true });
        this.logger.log(`Sesión eliminada para tienda ${storeId}`);
      } catch (error) {
        this.logger.error(`Error eliminando sesión para tienda ${storeId}:`, error);
      }
    }
  }

  /**
   * Formatea un número de teléfono para WhatsApp
   */
  private formatPhoneNumber(phone: string): string {
    // Remover todos los caracteres no numéricos
    const cleanPhone = phone.replace(/\D/g, '');

    // Si ya empieza con código de país de Venezuela (58), dejarlo así
    if (cleanPhone.startsWith('58')) {
      return cleanPhone;
    }

    // Agregar código de país de Venezuela (58)
    return `58${cleanPhone}`;
  }

  /**
   * Limpia recursos al destruir el módulo
   */
  async onModuleDestroy() {
    this.logger.log('Desconectando todos los bots...');
    const disconnectPromises = Array.from(this.bots.keys()).map((storeId) =>
      this.disconnect(storeId),
    );
    await Promise.all(disconnectPromises);
    this.logger.log('Todos los bots desconectados');
  }
}
