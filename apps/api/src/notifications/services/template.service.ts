import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationTemplate } from '../../database/entities/notification-template.entity';
import * as Handlebars from 'handlebars';

export interface TemplateRenderOptions {
  language?: string;
  variables: Record<string, any>;
  channel?: 'email' | 'push' | 'in_app';
}

/**
 * Template Service
 * Gestiona templates dinámicos con soporte multi-idioma
 * Utiliza Handlebars para renderizado avanzado
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(
    @InjectRepository(NotificationTemplate)
    private templateRepository: Repository<NotificationTemplate>,
  ) {
    this.registerHelpers();
  }

  /**
   * Registra helpers personalizados de Handlebars
   */
  private registerHelpers() {
    // Helper para formatear números
    Handlebars.registerHelper('number', (value: number, decimals = 2) => {
      if (typeof value !== 'number') return value;
      return value.toFixed(decimals);
    });

    // Helper para formatear moneda
    Handlebars.registerHelper('currency', (value: number, currency = 'Bs') => {
      if (typeof value !== 'number') return value;
      return `${currency}. ${value.toFixed(2)}`;
    });

    // Helper para formatear fechas
    Handlebars.registerHelper('date', (date: Date | string) => {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Helper para porcentaje
    Handlebars.registerHelper('percent', (value: number) => {
      if (typeof value !== 'number') return value;
      return `${value.toFixed(0)}%`;
    });

    // Helper condicional para comparaciones
    Handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
      switch (operator) {
        case '==':
          return v1 == v2 ? options.fn(this) : options.inverse(this);
        case '===':
          return v1 === v2 ? options.fn(this) : options.inverse(this);
        case '!=':
          return v1 != v2 ? options.fn(this) : options.inverse(this);
        case '!==':
          return v1 !== v2 ? options.fn(this) : options.inverse(this);
        case '<':
          return v1 < v2 ? options.fn(this) : options.inverse(this);
        case '<=':
          return v1 <= v2 ? options.fn(this) : options.inverse(this);
        case '>':
          return v1 > v2 ? options.fn(this) : options.inverse(this);
        case '>=':
          return v1 >= v2 ? options.fn(this) : options.inverse(this);
        case '&&':
          return v1 && v2 ? options.fn(this) : options.inverse(this);
        case '||':
          return v1 || v2 ? options.fn(this) : options.inverse(this);
        default:
          return options.inverse(this);
      }
    });

    // Helper para listas con índice
    Handlebars.registerHelper('eachWithIndex', function (array, options) {
      if (!Array.isArray(array)) return '';
      return array
        .map((item, index) => {
          return options.fn({ ...item, index: index + 1 });
        })
        .join('');
    });

    // Helper para truncar texto
    Handlebars.registerHelper('truncate', (text: string, length = 50) => {
      if (typeof text !== 'string') return text;
      if (text.length <= length) return text;
      return text.substring(0, length) + '...';
    });

    // Helper para uppercase
    Handlebars.registerHelper('upper', (text: string) => {
      if (typeof text !== 'string') return text;
      return text.toUpperCase();
    });

    // Helper para lowercase
    Handlebars.registerHelper('lower', (text: string) => {
      if (typeof text !== 'string') return text;
      return text.toLowerCase();
    });

    // Helper para capitalizar
    Handlebars.registerHelper('capitalize', (text: string) => {
      if (typeof text !== 'string') return text;
      return text.charAt(0).toUpperCase() + text.slice(1);
    });
  }

  /**
   * Obtiene un template por key
   */
  async getTemplate(
    templateKey: string,
    storeId?: string,
  ): Promise<NotificationTemplate | null> {
    const query = this.templateRepository
      .createQueryBuilder('template')
      .where('template.template_key = :templateKey', { templateKey })
      .andWhere('template.is_active = true');

    if (storeId) {
      query.andWhere(
        '(template.store_id = :storeId OR template.store_id IS NULL)',
        { storeId },
      );
      query.orderBy('template.store_id', 'DESC'); // Priorizar templates específicos de la tienda
    } else {
      query.andWhere('template.store_id IS NULL');
    }

    query.addOrderBy('template.version', 'DESC').limit(1);

    return await query.getOne();
  }

  /**
   * Renderiza un template con variables
   */
  async renderTemplate(
    templateKey: string,
    options: TemplateRenderOptions,
    storeId?: string,
  ): Promise<{
    title: string;
    body: string;
    html?: string;
  }> {
    const template = await this.getTemplate(templateKey, storeId);

    if (!template) {
      this.logger.error(`Template not found: ${templateKey}`);
      throw new Error(`Template not found: ${templateKey}`);
    }

    const language = options.language || 'es';
    const content = template.content[language] || template.content['es'];

    if (!content) {
      this.logger.error(
        `Language ${language} not supported for template ${templateKey}`,
      );
      throw new Error(
        `Language ${language} not supported for template ${templateKey}`,
      );
    }

    // Renderizar título
    const titleTemplate = this.compileTemplate(content.title);
    const title = titleTemplate(options.variables);

    // Renderizar cuerpo
    const bodyTemplate = this.compileTemplate(content.body);
    const body = bodyTemplate(options.variables);

    // Renderizar HTML para email si está disponible
    let html: string | undefined;
    if (options.channel === 'email' && template.email_template) {
      const htmlTemplate = this.compileTemplate(template.email_template);
      html = htmlTemplate(options.variables);
    }

    return { title, body, html };
  }

  /**
   * Compila un template de Handlebars (con cache)
   */
  private compileTemplate(source: string): HandlebarsTemplateDelegate {
    const cacheKey = this.hashString(source);

    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey)!;
    }

    const compiled = Handlebars.compile(source);
    this.templateCache.set(cacheKey, compiled);

    return compiled;
  }

  /**
   * Crea un hash simple de un string para cache
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Valida que las variables requeridas estén presentes
   */
  validateVariables(
    template: NotificationTemplate,
    variables: Record<string, any>,
  ): { valid: boolean; missing: string[] } {
    if (!template.variables_schema) {
      return { valid: true, missing: [] };
    }

    const required = Object.entries(template.variables_schema)
      .filter(([_, schema]: [string, any]) => schema.required === true)
      .map(([key]) => key);

    const missing = required.filter((key) => !(key in variables));

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Crea un nuevo template
   */
  async createTemplate(data: {
    storeId?: string;
    templateKey: string;
    name: string;
    description?: string;
    content: Record<string, { title: string; body: string }>;
    templateType: string;
    category: string;
    emailTemplate?: string;
    defaultPriority?: string;
    defaultChannels?: string[];
    variablesSchema?: Record<string, any>;
    mlTriggerConfig?: Record<string, any>;
  }): Promise<NotificationTemplate> {
    const template = this.templateRepository.create({
      store_id: data.storeId || null,
      template_key: data.templateKey,
      name: data.name,
      description: data.description || null,
      content: data.content,
      template_type: data.templateType as any,
      category: data.category,
      email_template: data.emailTemplate || null,
      default_priority: (data.defaultPriority as any) || 'medium',
      default_channels: (data.defaultChannels as any) || ['in_app'],
      variables_schema: data.variablesSchema || null,
      ml_trigger_config: data.mlTriggerConfig || null,
      is_active: true,
      version: 1,
    });

    return await this.templateRepository.save(template);
  }

  /**
   * Actualiza un template (crea una nueva versión)
   */
  async updateTemplate(
    templateKey: string,
    storeId: string | undefined,
    updates: Partial<NotificationTemplate>,
  ): Promise<NotificationTemplate> {
    const currentTemplate = await this.getTemplate(templateKey, storeId);

    if (!currentTemplate) {
      throw new Error(`Template not found: ${templateKey}`);
    }

    // Crear nueva versión
    const newTemplate = this.templateRepository.create({
      ...currentTemplate,
      ...updates,
      id: undefined, // Generar nuevo ID
      version: currentTemplate.version + 1,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return await this.templateRepository.save(newTemplate);
  }

  /**
   * Desactiva un template
   */
  async deactivateTemplate(
    templateKey: string,
    storeId?: string,
  ): Promise<void> {
    const template = await this.getTemplate(templateKey, storeId);

    if (template) {
      template.is_active = false;
      await this.templateRepository.save(template);
    }
  }

  /**
   * Lista templates activos
   */
  async listTemplates(filters?: {
    storeId?: string;
    templateType?: string;
    category?: string;
  }): Promise<NotificationTemplate[]> {
    const query = this.templateRepository
      .createQueryBuilder('template')
      .where('template.is_active = true');

    if (filters?.storeId) {
      query.andWhere(
        '(template.store_id = :storeId OR template.store_id IS NULL)',
        {
          storeId: filters.storeId,
        },
      );
    }

    if (filters?.templateType) {
      query.andWhere('template.template_type = :templateType', {
        templateType: filters.templateType,
      });
    }

    if (filters?.category) {
      query.andWhere('template.category = :category', {
        category: filters.category,
      });
    }

    query
      .orderBy('template.template_key', 'ASC')
      .addOrderBy('template.version', 'DESC');

    return await query.getMany();
  }

  /**
   * Limpia cache de templates
   */
  clearCache(): void {
    this.templateCache.clear();
    this.logger.log('Template cache cleared');
  }
}
