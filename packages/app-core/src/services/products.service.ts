import { api } from '../runtime/api'
import { randomUUID } from '../lib/uuid'
import { productsCacheService } from './products-cache.service'
import { syncService } from './sync.service'
import { exchangeService } from './exchange.service'
import { createLogger } from '../lib/logger'
import {
  PricingCalculator,
  ProductCreatedPayload,
  ProductUpdatedPayload,
  ProductDeactivatedPayload,
  PriceChangedPayload,
  BaseEvent,
  normalizeBarcode
} from '@la-caja/domain'

const logger = createLogger('ProductsService')

function getUserId(): string {
  // Intentar obtener del token o localStorage
  // Esto es un fallback, idealmente debería pasarse como argumento
  try {
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      const parsed = JSON.parse(authStorage)
      return parsed.state?.user?.id || 'unknown'
    }
  } catch (e) {
    // ignore
  }
  return 'unknown'
}

function getUserRole(): 'owner' | 'cashier' {
  try {
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      const parsed = JSON.parse(authStorage)
      return parsed.state?.user?.role || 'cashier'
    }
  } catch (e) {
    // ignore
  }
  return 'cashier'
}

export interface Product {
  id: string
  store_id: string
  name: string
  category: string | null
  sku: string | null
  barcode: string | null
  price_bs: number | string // PostgreSQL devuelve NUMERIC como string
  price_usd: number | string
  cost_bs: number | string
  cost_usd: number | string
  low_stock_threshold: number
  is_active: boolean
  is_weight_product?: boolean
  weight_unit?: 'kg' | 'g' | 'lb' | 'oz' | null
  price_per_weight_bs?: number | string | null
  price_per_weight_usd?: number | string | null
  cost_per_weight_bs?: number | string | null
  cost_per_weight_usd?: number | string | null
  min_weight?: number | null
  max_weight?: number | null
  scale_plu?: string | null
  scale_department?: number | null
  image_url?: string | null
  description?: string | null
  is_recipe?: boolean
  profit_margin?: number
  product_type?: 'sale_item' | 'ingredient' | 'prepared'
  is_visible_public?: boolean
  public_name?: string | null
  public_description?: string | null
  public_image_url?: string | null
  public_category?: string | null
  ingredients?: RecipeIngredientInput[]
  updated_at: string
}

export interface RecipeIngredient {
  id: string
  recipe_product_id: string
  ingredient_product_id: string
  ingredient_product: Product
  qty: number
  unit: string | null
}

export interface RecipeIngredientInput {
  ingredient_product_id: string
  qty: number
  unit: string | null
}

export interface ProductModifier {
  id: string
  product_id: string
  name: string
  type: 'optional' | 'interchangeable' | 'required'
  is_multiple: boolean
  min_options: number
  max_options: number | null
  options: ProductModifierOption[]
}

export interface ProductModifierOption {
  id: string
  modifier_id: string
  name: string
  extra_price_bs: number
  extra_price_usd: number
  ingredient_product_id: string | null
  qty_delta: number | null
  is_default: boolean
}

export interface ProductSearchParams {
  q?: string
  category?: string
  is_active?: boolean
  is_visible_public?: boolean
  product_type?: 'sale_item' | 'ingredient' | 'prepared'
  limit?: number
  offset?: number
}

export interface ProductSearchResponse {
  products: Product[]
  total: number
}

export interface ProductMutationOptions {
  userId?: string
  userRole?: 'owner' | 'cashier'
}

/**
 * Servicio para gestión de productos con soporte offline-first real
 */
export const productsService = {

  async getByBarcode(barcode: string, storeId?: string): Promise<Product | null> {
    const normalized = normalizeBarcode(barcode);
    if (!normalized) return null;

    if (storeId) {
      try {
        const cachedProduct = await productsCacheService.getProductByBarcodeFromCache(storeId, normalized);
        if (cachedProduct) return cachedProduct;
      } catch (error) {
        logger.warn('Error cargando producto por barcode desde cache', { error });
      }
    }

    if (!navigator.onLine) return null;

    try {
      const response = await api.get<Product>(`/products/barcode/${encodeURIComponent(normalized)}`);
      if (storeId && response.data) {
        productsCacheService.cacheProduct(response.data, storeId).catch(() => { });
      }
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async search(params: ProductSearchParams, storeId?: string): Promise<ProductSearchResponse> {
    const isOnline = navigator.onLine;
    let cachedData: ProductSearchResponse | null = null;

    if (storeId) {
      try {
        const cachedProducts = await productsCacheService.getProductsFromCache(storeId, {
          search: params.q,
          category: params.category,
          is_active: params.is_active,
          limit: params.limit,
        });

        if (cachedProducts.length > 0) {
          cachedData = {
            products: cachedProducts,
            total: cachedProducts.length,
          };
        }
      } catch (error) {
        logger.warn('Error cargando desde cache', { error });
      }
    }

    if (!isOnline) {
      if (cachedData) return cachedData;
      throw new Error('Sin conexión y sin datos en cache local');
    }

    try {
      const { q, ...restParams } = params;
      const backendParams: Omit<ProductSearchParams, 'q'> & { search?: string } = {
        ...restParams,
        search: q,
      }

      const response = await api.get<ProductSearchResponse>('/products', { params: backendParams })

      const responseProducts = response.data?.products ?? [];
      if (storeId && responseProducts.length > 0) {
        await productsCacheService.cacheProducts(responseProducts, storeId).catch(() => { });
      }

      return {
        products: responseProducts,
        total: response.data?.total ?? responseProducts.length,
      }
    } catch (error: unknown) {
      const axiosError = error as { message?: string };
      if (cachedData) {
        logger.warn('Error en API, usando cache local', { error: axiosError.message });
        return cachedData;
      }
      throw error;
    }
  },

  async getById(id: string, storeId?: string): Promise<Product> {
    const isOnline = navigator.onLine;
    let cachedProduct: Product | null = null;

    if (storeId) {
      try {
        cachedProduct = await productsCacheService.getProductByIdFromCache(id);
      } catch (error) {
        logger.warn('Error cargando producto desde cache', { error });
      }
    }

    if (!isOnline) {
      if (cachedProduct) return cachedProduct;
      throw new Error('Sin conexión y producto no encontrado en cache local');
    }

    try {
      const response = await api.get<Product>(`/products/${id}`)
      if (storeId) {
        await productsCacheService.cacheProduct(response.data, storeId).catch(() => { });
      }
      return response.data
    } catch (error: any) {
      if (cachedProduct) {
        logger.warn('Error en API, usando cache local', { error: error.message });
        return cachedProduct;
      }
      throw error;
    }
  },

  async create(data: Partial<Product>, storeId?: string, options?: ProductMutationOptions): Promise<Product> {
    if (!storeId) throw new Error('storeId requerido para crear productos');

    const isOnline = navigator.onLine;
    const userId = options?.userId || getUserId();
    const userRole = options?.userRole || getUserRole();

    // 1. Calcular ID y timestamps
    const productId = randomUUID();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    // 2. Obtener tasa para cálculos locales
    let exchangeRate = 36;
    try {
      const rateData = await exchangeService.getCachedRate();
      if (rateData.available && rateData.rate) exchangeRate = rateData.rate;
    } catch (e) {
      logger.warn('No se pudo obtener tasa de cambio para cálculo local', { error: e });
    }

    // 3. Calcular precios (Lógica espejo del backend)
    let price_bs = data.price_bs ? Number(data.price_bs) : 0;
    let price_usd = data.price_usd ? Number(data.price_usd) : 0;
    let cost_bs = data.cost_bs ? Number(data.cost_bs) : 0;
    let cost_usd = data.cost_usd ? Number(data.cost_usd) : 0;

    // Si dieron precio en Bs, calcular USD. Si no, calcular Bs desde USD.
    if (data.price_bs !== undefined && data.price_bs !== null && data.price_bs !== '') {
      price_bs = PricingCalculator.roundToTwoDecimals(Number(data.price_bs));
      price_usd = PricingCalculator.roundToTwoDecimals(price_bs / exchangeRate);
    } else {
      price_usd = PricingCalculator.roundToTwoDecimals(Number(data.price_usd || 0));
      price_bs = PricingCalculator.roundToTwoDecimals(price_usd * exchangeRate);
    }

    if (data.cost_bs !== undefined && data.cost_bs !== null && data.cost_bs !== '') {
      cost_bs = PricingCalculator.roundToTwoDecimals(Number(data.cost_bs));
      cost_usd = PricingCalculator.roundToTwoDecimals(cost_bs / exchangeRate);
    } else {
      cost_usd = PricingCalculator.roundToTwoDecimals(Number(data.cost_usd || 0));
      cost_bs = PricingCalculator.roundToTwoDecimals(cost_usd * exchangeRate);
    }

    // 4. Construir objeto optimista completo
    const newProduct: Product = {
      id: productId,
      store_id: storeId,
      name: data.name || 'Nuevo Producto',
      category: data.category || null,
      sku: data.sku || null,
      barcode: normalizeBarcode(data.barcode),
      price_bs,
      price_usd,
      cost_bs,
      cost_usd,
      low_stock_threshold: Number(data.low_stock_threshold || 5),
      is_active: data.is_active ?? true,
      updated_at: nowIso,
      // Default nulls
      is_weight_product: false,
      weight_unit: null,
      price_per_weight_bs: null,
      price_per_weight_usd: null,
      cost_per_weight_bs: null,
      cost_per_weight_usd: null,
      min_weight: null,
      max_weight: null,
      scale_plu: null,
      scale_department: null,
      image_url: data.image_url || null,
      description: data.description || null,
      is_recipe: data.is_recipe ?? false,
      profit_margin: data.profit_margin ?? 0,
      ...data // Sobreescribir con lo que venga explícito (como flags de peso)
    };

    // 5. Función para guardar evento offline
    const saveOffline = async () => {
      const payload: ProductCreatedPayload = {
        product_id: productId,
        name: newProduct.name,
        category: newProduct.category || undefined,
        sku: newProduct.sku || undefined,
        barcode: newProduct.barcode || undefined,
        price_bs: Number(newProduct.price_bs),
        price_usd: Number(newProduct.price_usd),
        cost_bs: Number(newProduct.cost_bs),
        cost_usd: Number(newProduct.cost_usd),
        is_active: newProduct.is_active,
        low_stock_threshold: newProduct.low_stock_threshold,
        description: newProduct.description || undefined,
        image_url: newProduct.image_url || undefined,
        is_recipe: newProduct.is_recipe,
        profit_margin: newProduct.profit_margin,
        product_type: newProduct.product_type,
        is_visible_public: newProduct.is_visible_public,
        public_name: newProduct.public_name || undefined,
        public_description: newProduct.public_description || undefined,
        public_image_url: newProduct.public_image_url || undefined,
        public_category: newProduct.public_category || undefined,
      };

      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: storeId,
        device_id: localStorage.getItem('device_id') || 'unknown',
        seq: 0, // SyncService asignará el correcto
        type: 'ProductCreated',
        version: 1,
        created_at: now,
        actor: {
          user_id: userId,
          role: userRole
        },
        payload
      };

      await syncService.enqueueEvent(event);

      const ingredients = Array.isArray(data.ingredients)
        ? (data.ingredients as RecipeIngredientInput[])
        : [];

      if (data.is_recipe && ingredients.length > 0) {
        await syncService.enqueueEvent({
          event_id: randomUUID(),
          store_id: storeId,
          device_id: localStorage.getItem('device_id') || 'unknown',
          seq: 0,
          type: 'RecipeIngredientsUpdated',
          version: 1,
          created_at: now,
          actor: {
            user_id: userId,
            role: userRole,
          },
          payload: {
            product_id: productId,
            ingredients: ingredients.map((ingredient) => ({
              ingredient_product_id: ingredient.ingredient_product_id,
              qty: Number(ingredient.qty),
              unit: ingredient.unit ?? null,
            })),
          },
        });
      }
      // Guardar en cache local inmediatamente para que la UI lo vea
      await productsCacheService.cacheProduct(newProduct, storeId);
      logger.info('Producto creado offline/optimista', { productId });
    };

    if (!isOnline) {
      await saveOffline();
      return newProduct;
    }

    try {
      // Intentar online primero
      const response = await api.post<Product>('/products', data);
      const serverProduct = response.data;
      // Guardar lo que devolvió el servidor en cache
      await productsCacheService.cacheProduct(serverProduct, storeId);
      return serverProduct;
    } catch (error) {
      logger.warn('Error creando producto online, fallback a offline', { error });
      await saveOffline();
      return newProduct;
    }
  },

  async update(id: string, data: Partial<Product>, storeId?: string, options?: ProductMutationOptions): Promise<Product> {
    if (!storeId) throw new Error('storeId requerido para actualizar productos');

    const isOnline = navigator.onLine;
    const userId = options?.userId || getUserId();
    const userRole = options?.userRole || getUserRole();
    const now = Date.now();

    // Necesitamos el producto actual para hacer el merge optimista
    let currentProduct: Product;
    try {
      currentProduct = await this.getById(id, storeId);
    } catch (e) {
      // Si no lo tenemos en cache ni online, no podemos editarlo offline con seguridad
      // Pero si estamos offline, lanzamos error
      if (!isOnline) throw new Error('No se puede editar producto: no encontrado localmente');
      // Si estamos online y falló getById, probablemente no existe
      throw e;
    }

    const updatedProduct: Product = {
      ...currentProduct,
      ...data,
      updated_at: new Date(now).toISOString()
    };

    // Normalizar barcode si viene en data
    if (data.barcode !== undefined) {
      updatedProduct.barcode = normalizeBarcode(data.barcode);
    }

    const saveOffline = async () => {
      const patch: any = {};
      if (data.name !== undefined) patch.name = data.name;
      if (data.category !== undefined) patch.category = data.category;
      if (data.sku !== undefined) patch.sku = data.sku;
      if (data.barcode !== undefined) patch.barcode = normalizeBarcode(data.barcode);
      if (data.low_stock_threshold !== undefined) patch.low_stock_threshold = data.low_stock_threshold;
      if (data.description !== undefined) patch.description = data.description;
      if (data.image_url !== undefined) patch.image_url = data.image_url;
      if (data.is_recipe !== undefined) patch.is_recipe = data.is_recipe;
      if (data.profit_margin !== undefined) patch.profit_margin = data.profit_margin;
      if (data.product_type !== undefined) patch.product_type = data.product_type;
      if (data.is_visible_public !== undefined) patch.is_visible_public = data.is_visible_public;
      if (data.public_name !== undefined) patch.public_name = data.public_name;
      if (data.public_description !== undefined) patch.public_description = data.public_description;
      if (data.public_image_url !== undefined) patch.public_image_url = data.public_image_url;
      if (data.public_category !== undefined) patch.public_category = data.public_category;

      // Nota: Precios se manejan en evento separado PriceChanged si cambian, pero por simplicidad
      // en este MVP asumimos que si usan el form de edición, mandamos update.
      // IDEALMENTE: separar lógica de precios.
      // MVP ACTUAL: El backend quizás acepta precios en PATCH /products/:id? 
      // Revisando products.service.ts del backend: update() SÍ maneja precios.

      // Para el evento offline 'ProductUpdated' del dominio, solo soporta un subset según event.types.ts
      // Si hay cambio de precio, deberíamos disparar TAMBIÉN 'PriceChanged'

      const payload: ProductUpdatedPayload = {
        product_id: id,
        patch
      };

      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: storeId,
        device_id: localStorage.getItem('device_id') || 'unknown',
        seq: 0,
        type: 'ProductUpdated',
        version: 1,
        created_at: now,
        actor: { user_id: userId, role: userRole },
        payload
      };

      await syncService.enqueueEvent(event);

      // Si cambiaron precios, necesitamos PriceChanged también
      if (data.price_bs !== undefined || data.price_usd !== undefined) {
        // Calcular precios finales (reusing logic from create would be better, but simple here)
        let final_bs = Number(updatedProduct.price_bs);
        let final_usd = Number(updatedProduct.price_usd);

        // Recalcular cruzado si es necesario (simplificado)
        // Asumimos que updatedProduct ya tiene los valores 'raw' del input
        // Deberíamos aplicar la misma lógica de tasa que en create...

        let exchangeRate = 36;
        const rateData = await exchangeService.getCachedRate();
        if (rateData.available && rateData.rate) exchangeRate = rateData.rate;

        if (data.price_bs !== undefined) {
          final_bs = Number(data.price_bs);
          final_usd = PricingCalculator.roundToTwoDecimals(final_bs / exchangeRate);
        } else if (data.price_usd !== undefined) {
          final_usd = Number(data.price_usd);
          final_bs = PricingCalculator.roundToTwoDecimals(final_usd * exchangeRate);
        }

        updatedProduct.price_bs = final_bs;
        updatedProduct.price_usd = final_usd;

        const pricePayload: PriceChangedPayload = {
          product_id: id,
          price_bs: final_bs,
          price_usd: final_usd,
          reason: 'manual',
          rounding: 'none',
          effective_at: now
        };

        await syncService.enqueueEvent({
          ...event,
          event_id: randomUUID(),
          type: 'PriceChanged',
          payload: pricePayload
        });
      }

      const shouldSyncIngredients =
        data.is_recipe === false || data.ingredients !== undefined;
      if (shouldSyncIngredients) {
        const ingredients = Array.isArray(data.ingredients)
          ? (data.ingredients as RecipeIngredientInput[])
          : [];

        await syncService.enqueueEvent({
          event_id: randomUUID(),
          store_id: storeId,
          device_id: localStorage.getItem('device_id') || 'unknown',
          seq: 0,
          type: 'RecipeIngredientsUpdated',
          version: 1,
          created_at: now,
          actor: { user_id: userId, role: userRole },
          payload: {
            product_id: id,
            ingredients:
              data.is_recipe === false
                ? []
                : ingredients.map((ingredient) => ({
                  ingredient_product_id: ingredient.ingredient_product_id,
                  qty: Number(ingredient.qty),
                  unit: ingredient.unit ?? null,
                })),
          },
        });
      }

      await productsCacheService.cacheProduct(updatedProduct, storeId);
      logger.info('Producto actualizado offline/optimista', { id });
    };

    if (!isOnline) {
      await saveOffline();
      return updatedProduct;
    }

    try {
      const response = await api.patch<Product>(`/products/${id}`, data);
      await productsCacheService.cacheProduct(response.data, storeId);
      return response.data;
    } catch (error) {
      logger.warn('Error actualizando online, fallback a offline', { error });
      await saveOffline();
      return updatedProduct;
    }
  },

  async deactivate(id: string, storeId?: string, options?: ProductMutationOptions): Promise<Product> {
    if (!storeId) throw new Error('storeId requerido');
    const isOnline = navigator.onLine;

    // Obtener producto actual para actualizar cache
    let current = await this.getById(id, storeId);
    current.is_active = false;
    current.updated_at = new Date().toISOString();

    const saveOffline = async () => {
      const payload: ProductDeactivatedPayload = {
        product_id: id,
        is_active: false
      };
      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: storeId,
        device_id: localStorage.getItem('device_id') || 'unknown',
        seq: 0,
        type: 'ProductDeactivated',
        version: 1,
        created_at: Date.now(),
        actor: {
          user_id: options?.userId || getUserId(),
          role: options?.userRole || getUserRole()
        },
        payload
      };
      await syncService.enqueueEvent(event);
      await productsCacheService.cacheProduct(current, storeId);
    };

    if (!isOnline) {
      await saveOffline();
      return current;
    }

    try {
      const response = await api.post<Product>(`/products/${id}/deactivate`);
      await productsCacheService.cacheProduct(response.data, storeId);
      return response.data;
    } catch (e) {
      await saveOffline();
      return current;
    }
  },

  async activate(id: string, storeId?: string): Promise<Product> {
    // Implementación similar a deactivate...
    // Por brevedad del refactor, dejaremos el fallback simple
    const response = await api.post<Product>(`/products/${id}/activate`)
    if (storeId) await productsCacheService.cacheProduct(response.data, storeId).catch(() => { });
    return response.data
  },

  async changePrice(
    id: string,
    data: {
      price_bs: number
      price_usd: number
      rounding?: 'none' | '0.1' | '0.5' | '1'
    },
    storeId?: string,
    options?: ProductMutationOptions
  ): Promise<Product> {
    if (!storeId) throw new Error('storeId requerido');

    // Optimistic update logic specifically for price change
    const isOnline = navigator.onLine;
    let current = await this.getById(id, storeId);
    current.price_bs = data.price_bs;
    current.price_usd = data.price_usd;
    current.updated_at = new Date().toISOString();

    const saveOffline = async () => {
      const payload: PriceChangedPayload = {
        product_id: id,
        price_bs: data.price_bs,
        price_usd: data.price_usd,
        reason: 'manual',
        rounding: data.rounding || 'none',
        effective_at: Date.now()
      };
      const event: BaseEvent = {
        event_id: randomUUID(),
        store_id: storeId,
        device_id: localStorage.getItem('device_id') || 'unknown',
        seq: 0,
        type: 'PriceChanged',
        version: 1,
        created_at: Date.now(),
        actor: {
          user_id: options?.userId || getUserId(),
          role: options?.userRole || getUserRole()
        },
        payload
      };
      await syncService.enqueueEvent(event);
      await productsCacheService.cacheProduct(current, storeId);
    };

    if (!isOnline) {
      await saveOffline();
      return current;
    }

    try {
      const response = await api.patch<Product>(`/products/${id}/price`, data)
      await productsCacheService.cacheProduct(response.data, storeId);
      return response.data
    } catch (e) {
      await saveOffline();
      return current;
    }
  },

  async bulkPriceChange(data: {
    items?: Array<{ product_id: string; price_bs?: number; price_usd?: number }>
    category?: string
    percentage_change?: number
    rounding?: 'none' | '0.1' | '0.5' | '1'
  }): Promise<{ updated: number; products: Product[] }> {
    // Bulk operations are tricky to handle offline efficiently without specialized events
    // For this MVP, we might keep it Online-First or implement a specific BulkEvent
    // Keeping online for now as it's an admin operation usually done with supervision
    const response = await api.put<{ updated: number; products: Product[] }>(
      '/products/prices/bulk',
      data
    )
    return response.data
  },

  /**
   * Sincroniza productos activos en segundo plano para optimizar el escáner (Barcode Index)
   * Estrategia "Cache-Ahead": Trae todos los productos activos para que el escaneo sea local e instantáneo.
   */
  async syncActiveProducts(storeId: string): Promise<void> {
    const isOnline = navigator.onLine;
    if (!isOnline) return;

    const SYNC_KEY = `last_product_sync_${storeId}`;
    const COOLDOWN_MS = 1000 * 60 * 30; // 30 minutos de cooldown
    const now = Date.now();

    try {
      const lastSync = localStorage.getItem(SYNC_KEY);
      if (lastSync && now - parseInt(lastSync) < COOLDOWN_MS) {
        // Enfriamiento activo, solo asegurar que el índice esté caliente con lo que ya hay
        await productsCacheService.warmBarcodeIndex(storeId);
        return;
      }

      logger.info('Iniciando sincronización background de productos activos...');

      // Traer todos los productos activos (límite alto)
      // Nota: Si el catálogo es > 2000, considerar paginación
      const response = await api.get<ProductSearchResponse>('/products', {
        params: {
          is_active: true,
          limit: 2000
        }
      });

      const products = response.data?.products ?? [];
      if (products.length > 0) {
        await productsCacheService.cacheProducts(products, storeId);
        // El warmBarcodeIndex se llama automáticamente si ya estaba inicializado, 
        // pero lo forzamos para asegurar consistencia
        await productsCacheService.warmBarcodeIndex(storeId);

        localStorage.setItem(SYNC_KEY, now.toString());
        logger.info('Sincronización de productos optimizada completada', { count: products.length });
      }
    } catch (error) {
      logger.warn('Error en sincronización background de productos', { error });
    }
  }
}
