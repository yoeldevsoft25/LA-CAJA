/**
 * Logger centralizado para el core
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    [key: string]: unknown;
}

class Logger {
    private context: string;
    private isDevelopment: boolean;

    constructor(context: string, isDevelopment: boolean = false) {
        this.context = context;
        this.isDevelopment = isDevelopment;
    }

    private sanitize(data: unknown): unknown {
        if (typeof data !== 'object' || data === null) {
            return data;
        }

        if (Array.isArray(data)) {
            return data.map((item) => this.sanitize(item));
        }

        const sanitized: Record<string, unknown> = {};
        const sensitiveKeys = ['password', 'pin', 'token', 'secret', 'apiKey', 'api_key', 'authorization'];

        for (const [key, value] of Object.entries(data)) {
            const lowerKey = key.toLowerCase();
            if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
                sanitized[key] = '***REDACTED***';
            } else {
                sanitized[key] = this.sanitize(value);
            }
        }

        return sanitized;
    }

    private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
        const timestamp = new Date().toISOString();
        const contextStr = context ? ` ${JSON.stringify(this.sanitize(context))}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${contextStr}`;
    }

    debug(message: string, context?: LogContext): void {
        if (this.isDevelopment) {
            console.debug(this.formatMessage('debug', message, context));
        }
    }

    info(message: string, context?: LogContext): void {
        console.info(this.formatMessage('info', message, context));
    }

    warn(message: string, context?: LogContext): void {
        console.warn(this.formatMessage('warn', message, context));
    }

    error(message: string, error?: Error | unknown, context?: LogContext): void {
        const errorContext = {
            ...context,
            error: error instanceof Error
                ? {
                    message: error.message,
                    stack: this.isDevelopment ? error.stack : undefined,
                    name: error.name,
                }
                : String(error),
        };

        console.error(this.formatMessage('error', message, errorContext));
    }
}

export function createLogger(context: string, isDevelopment: boolean = false): Logger {
    return new Logger(context, isDevelopment);
}
