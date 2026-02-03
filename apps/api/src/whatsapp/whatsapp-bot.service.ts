import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
import { existsSync, mkdirSync, rmSync, readdirSync } from 'fs';
import pino from 'pino';
import { randomUUID } from 'crypto';
import { WhatsAppConfig } from '../database/entities/whatsapp-config.entity';

interface BotInstance {
  socket: WASocket | null;
  qrCode: string | null;
  isConnected: boolean;
  whatsappNumber: string | null;
  connectionState: ConnectionState | null;
  /** Intervalo de sendPresenceUpdate para mantener la sesión activa; se limpia en close/disconnect */
  presenceIntervalId?: ReturnType<typeof setInterval> | null;
  /** Marca cierre intencional (end) para no disparar reconexión automática */
  isClosing?: boolean;
}

/** Códigos de desconexión que NO deben provocar reconexión automática */
const NO_RECONNECT_CODES = [
  DisconnectReason.loggedOut, // 401 - usuario cerró sesión
  DisconnectReason.forbidden, // 403 - cuenta baneada/restricción
  DisconnectReason.multideviceMismatch, // 411 - incompatibilidad multi-dispositivo
  DisconnectReason.connectionReplaced, // 440 - otro dispositivo tomó la sesión
];

/**
 * Servicio para gestionar bots de WhatsApp usando Baileys
 * Soporta múltiples instancias (una por tienda)
 */
@Injectable()
export class WhatsAppBotService implements OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppBotService.name);
  private readonly bots = new Map<string, BotInstance>();
  private readonly sessionsDir = join(process.cwd(), 'whatsapp-sessions');
  /** Reintentos de reconexión por storeId; se resetea al conectar. Backoff: 3s, 6s, 12s, … (máx 60s). */
  private readonly reconnectAttempts = new Map<string, number>();

  /** Intervalo para sendPresenceUpdate (mantener sesión activa): 25 segundos */
  private static readonly PRESENCE_INTERVAL_MS = 25_000;

  constructor(
    @InjectRepository(WhatsAppConfig)
    private whatsappConfigRepository: Repository<WhatsAppConfig>,
  ) {
    // Crear directorio de sesiones si no existe
    if (!existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
      this.logger.log(`Directorio de sesiones creado: ${this.sessionsDir}`);
    }
  }

  /**
   * Inicializa un bot para una tienda
   * Si el bot ya existe pero no está conectado y no hay QR, lo reinicializa
   * @param isInteractive Si es true, permite generar QR. Si es false (background), aborta si se requiere QR.
   */
  async initializeBot(
    storeId: string,
    forceReinit: boolean = false,
    isInteractive: boolean = false,
  ): Promise<void> {
    const existingBot = this.bots.get(storeId);

    // Si se fuerza reinicialización, desconectar y eliminar bot existente
    if (forceReinit && existingBot) {
      this.logger.log(
        `Forzando reinicialización del bot para tienda ${storeId}`,
      );
      existingBot.isClosing = true;
      if (existingBot.presenceIntervalId) {
        clearInterval(existingBot.presenceIntervalId);
        existingBot.presenceIntervalId = null;
      }
      if (existingBot.socket) {
        try {
          existingBot.socket.end(undefined);
        } catch (error) {
          this.logger.warn(`Error cerrando socket existente:`, error);
        }
      }
      this.bots.delete(storeId);
      this.reconnectAttempts.delete(storeId);
    } else if (existingBot && !forceReinit) {
      // Si el bot está conectado, no hacer nada
      if (existingBot.isConnected) {
        this.logger.log(`Bot ya conectado para tienda ${storeId}`);
        return;
      }

      // Si hay QR disponible...
      if (existingBot.qrCode) {
        // En modo interactivo, retornamos (ya está listo para escanear)
        if (isInteractive) {
          this.logger.log(
            `Bot ya inicializado con QR disponible para tienda ${storeId}`,
          );
          return;
        }
        // En modo NO interactivo, si hay un QR esperando, lo matamos para no consumir recursos
        this.logger.log(
          `Bot con QR pendiente en modo no-interactivo. Limpiando para tienda ${storeId}`,
        );
        // Se procederá a reinicializar (y caerá en la validación de QR abajo)
      }

      // Si no está conectado, reinicializar
      this.logger.log(
        `Bot existe pero sin conexión (interactive=${isInteractive}), reinicializando para tienda ${storeId}`,
      );
      existingBot.isClosing = true;
      if (existingBot.presenceIntervalId) {
        clearInterval(existingBot.presenceIntervalId);
        existingBot.presenceIntervalId = null;
      }
      if (existingBot.socket) {
        try {
          existingBot.socket.end(undefined);
        } catch (error) {
          this.logger.warn(`Error cerrando socket existente:`, error);
        }
      }
      this.bots.delete(storeId);
      this.reconnectAttempts.delete(storeId);
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
      presenceIntervalId: null,
    };

    this.bots.set(storeId, botInstance);

    try {
      const { version } = await fetchLatestBaileysVersion();
      this.logger.log(
        `Inicializando bot para tienda ${storeId} con Baileys v${version.join('.')}`,
      );

      const socket = makeWASocket({
        version,
        printQRInTerminal: false,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(
            state.keys,
            pino({ level: 'silent' }),
          ),
        },
        logger: pino({ level: 'silent' }), // Silenciar logs de Baileys
        generateHighQualityLinkPreview: true,
        // Maximizar persistencia: keep-alive cada 20s (por defecto 30s)
        keepAliveIntervalMs: 20_000,
        connectTimeoutMs: 25_000,
      });

      botInstance.socket = socket;

      // Manejar actualización de credenciales
      socket.ev.on('creds.update', async () => {
        try {
          await saveCreds();
          // this.logger.log(`Credenciales actualizadas para tienda ${storeId}`); // Reducir logs
        } catch (e: any) {
          // ENOENT: la carpeta de sesión fue eliminada (p. ej. clearSession) mientras saveCreds
          // se ejecutaba; ignorar para no tumbar el proceso en producción (Render, etc.)
          if (e?.code === 'ENOENT') {
            return;
          }
          throw e;
        }
      });

      // Manejar QR code
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // Solo asignar si connection es un ConnectionState válido
        if (
          connection &&
          ['close', 'connecting', 'open'].includes(connection)
        ) {
          botInstance.connectionState =
            connection as unknown as ConnectionState;
        } else {
          botInstance.connectionState = null;
        }

        if (qr) {
          if (!isInteractive) {
            this.logger.warn(
              `⚠️ Se requiere QR para tienda ${storeId} pero no estamos en modo interactivo. Abortando y limpiando sesión.`,
            );
            botInstance.isClosing = true;
            try {
              socket.end(undefined);
            } catch {}
            this.bots.delete(storeId);

            // IMPORTANTE: Limpiar la sesión corrupta/inválida para evitar loops infinitos de intento de conexión
            await this.clearSession(storeId);
            return;
          }

          // Generar QR code como imagen base64
          try {
            const qrCodeDataUrl = await QRCode.toDataURL(qr);
            botInstance.qrCode = qrCodeDataUrl;
            this.logger.log(`QR code generado para tienda ${storeId}`);
          } catch (error) {
            this.logger.error(
              `Error generando QR code para tienda ${storeId}:`,
              error,
            );
          }
        }

        if (connection === 'close') {
          // Limpiar intervalo de presencia
          if (botInstance.presenceIntervalId) {
            clearInterval(botInstance.presenceIntervalId);
            botInstance.presenceIntervalId = null;
          }

          botInstance.isConnected = false;
          botInstance.qrCode = null;

          const statusCode = (lastDisconnect?.error as Boom)?.output
            ?.statusCode;
          const shouldReconnect =
            !botInstance.isClosing &&
            (statusCode === undefined ||
              !NO_RECONNECT_CODES.includes(statusCode));

          if (botInstance.isClosing) {
            // Cierre intencional (forceReinit o reinicio): no reconectar
            botInstance.socket = null;
            return;
          }

          if (shouldReconnect) {
            const attempts = (this.reconnectAttempts.get(storeId) ?? 0) + 1;
            this.reconnectAttempts.set(storeId, attempts);
            // Backoff: 3s, 6s, 12s, 24s, 48s, 60s (máx 60s)
            const delayMs = Math.min(
              3000 * Math.pow(2, Math.min(attempts - 1, 4)),
              60_000,
            );
            this.logger.log(
              `Reconectando bot para tienda ${storeId} en ${delayMs / 1000}s (intento ${attempts})…`,
            );
            setTimeout(() => {
              // En reconexión automática mantenemos el modo background (interactive=false)
              // a menos que hayamos implementado persistencia de esa bandera, pero seguro asumir false
              this.initializeBot(storeId, false, false).catch((error) => {
                this.logger.error(
                  `Error reconectando bot para tienda ${storeId}:`,
                  error,
                );
              });
            }, delayMs);
          } else {
            this.logger.log(
              `Bot desconectado permanentemente para tienda ${storeId} (código ${statusCode}). Se requiere re-autenticación.`,
            );
            botInstance.socket = null;
            this.reconnectAttempts.delete(storeId);
          }
        } else if (connection === 'open') {
          this.reconnectAttempts.delete(storeId);
          botInstance.isConnected = true;
          botInstance.qrCode = null;

          // Enviar presencia periódica para mantener la sesión activa y reducir desconexiones por inactividad
          if (botInstance.presenceIntervalId) {
            clearInterval(botInstance.presenceIntervalId);
          }
          botInstance.presenceIntervalId = setInterval(() => {
            if (botInstance.socket && botInstance.isConnected) {
              botInstance.socket
                .sendPresenceUpdate('available')
                .catch(() => {});
            }
          }, WhatsAppBotService.PRESENCE_INTERVAL_MS);

          const jid = socket.user?.id;
          if (jid) {
            // Extraer número de WhatsApp del JID (formato: 584121234567@s.whatsapp.net)
            const number = jid.split('@')[0];
            botInstance.whatsappNumber = number;
            this.logger.log(
              `Bot conectado para tienda ${storeId}. Número: ${number}`,
            );

            // Actualizar número de WhatsApp en la base de datos
            this.updateWhatsAppNumberInDB(storeId, number).catch((error) => {
              this.logger.error(
                `Error actualizando número de WhatsApp en BD para tienda ${storeId}:`,
                error,
              );
            });
          }
        } else if (connection === 'connecting') {
          // Cuando está conectando, el QR puede estar disponible
          // No hacer nada, solo esperar
        }
      });

      // Manejar errores - Baileys no tiene evento 'error' directo, se manejan en connection.update
    } catch (error) {
      this.logger.error(
        `Error inicializando bot para tienda ${storeId}:`,
        error,
      );
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
   * Verifica si existe un bot para la tienda (inicializado o no)
   */
  hasBot(storeId: string): boolean {
    return this.bots.has(storeId);
  }

  /**
   * Verifica si el bot tiene un QR activo (esperando escaneo). No dispara inicialización.
   */
  hasActiveQR(storeId: string): boolean {
    return !!this.bots.get(storeId)?.qrCode;
  }

  /**
   * Verifica si hay una sesión guardada para la tienda
   */
  hasSavedSession(storeId: string): boolean {
    const sessionPath = join(this.sessionsDir, storeId);
    if (!existsSync(sessionPath)) {
      return false;
    }

    // Verificar si hay archivos de sesión (creds.json o archivos de keys)
    try {
      const files = readdirSync(sessionPath);
      // Baileys guarda creds.json y archivos de keys
      // Si hay al menos creds.json, hay una sesión guardada
      return files.some(
        (file) =>
          file === 'creds.json' || file.startsWith('app-state-sync-key'),
      );
    } catch {
      return false;
    }
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

      this.logger.log(
        `Mensaje enviado a ${formattedPhone} para tienda ${storeId}`,
      );
      return {
        success: true,
        messageId: result?.key?.id ?? undefined,
      };
    } catch (error: any) {
      this.logger.error(
        `Error enviando mensaje para tienda ${storeId}:`,
        error,
      );
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
    if (bot) {
      if (bot.presenceIntervalId) {
        clearInterval(bot.presenceIntervalId);
        bot.presenceIntervalId = null;
      }
      if (bot.socket) {
        bot.isClosing = true;
        bot.socket.end(undefined);
      }
      this.bots.delete(storeId);
      this.reconnectAttempts.delete(storeId);
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

    // Dar tiempo a que cualquier saveCreds en curso termine antes de borrar la carpeta
    // (evita ENOENT si creds.update se disparó justo antes de disconnect)
    await new Promise((r) => setTimeout(r, 500));

    if (existsSync(sessionPath)) {
      try {
        rmSync(sessionPath, { recursive: true, force: true });
        this.logger.log(`Sesión eliminada para tienda ${storeId}`);
      } catch (error) {
        this.logger.error(
          `Error eliminando sesión para tienda ${storeId}:`,
          error,
        );
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
   * Actualiza el número de WhatsApp en la base de datos cuando se conecta
   */
  private async updateWhatsAppNumberInDB(
    storeId: string,
    whatsappNumber: string,
  ): Promise<void> {
    try {
      let config = await this.whatsappConfigRepository.findOne({
        where: { store_id: storeId },
      });

      if (config) {
        // Actualizar número existente
        config.whatsapp_number = whatsappNumber;
        await this.whatsappConfigRepository.save(config);
        this.logger.log(
          `Número de WhatsApp actualizado en BD para tienda ${storeId}: ${whatsappNumber}`,
        );
      } else {
        // Crear configuración si no existe
        config = this.whatsappConfigRepository.create({
          id: randomUUID(),
          store_id: storeId,
          whatsapp_number: whatsappNumber,
          enabled: false,
          debt_notifications_enabled: false,
          debt_reminders_enabled: false,
        });
        await this.whatsappConfigRepository.save(config);
        this.logger.log(
          `Configuración de WhatsApp creada en BD para tienda ${storeId} con número ${whatsappNumber}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error actualizando número de WhatsApp en BD para tienda ${storeId}:`,
        error,
      );
      throw error;
    }
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
