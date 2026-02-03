import { Injectable, Logger } from '@nestjs/common';
import { VectorClockService, VectorClock } from './vector-clock.service';

/**
 * CRDT Service - Conflict-free Replicated Data Types
 *
 * Implementa estrategias de resolución automática de conflictos:
 * 1. Last-Write-Wins (LWW) Register
 * 2. Add-Wins Set (AWSet)
 * 3. Multi-Value Register (MVR)
 * 4. G-Counter (Grow-only Counter)
 *
 * Cada estrategia garantiza convergencia eventual sin coordinación.
 */

/**
 * Last-Write-Wins Register
 * Usado para: Campos simples que pueden sobrescribirse
 * Ejemplos: nombre de producto, dirección de cliente
 */
export interface LWWRegister<T> {
  value: T;
  timestamp: number; // Epoch ms
  device_id: string;
  vector_clock: VectorClock;
}

/**
 * Add-Wins Set
 * Usado para: Colecciones donde agregar siempre gana sobre remover
 * Ejemplos: movimientos de inventario, ítems de venta
 */
export interface AWSet<T> {
  adds: Map<string, { value: T; timestamp: number; device_id: string }>;
  removes: Set<string>;
}

/**
 * Multi-Value Register
 * Usado para: Cuando no se puede decidir automáticamente
 * Ejemplos: precio modificado concurrentemente
 */
export interface MVRegister<T> {
  values: Array<{
    value: T;
    timestamp: number;
    device_id: string;
    vector_clock: VectorClock;
  }>;
}

/**
 * G-Counter (Grow-only Counter)
 * Usado para: Contadores que solo incrementan
 * Ejemplos: total de ventas del día, stock recibido
 */
export interface GCounter {
  counts: Map<string, number>; // device_id → count
}

@Injectable()
export class CRDTService {
  private readonly logger = new Logger(CRDTService.name);

  constructor(private readonly vectorClockService: VectorClockService) {}

  // =====================================================
  // LAST-WRITE-WINS (LWW) REGISTER
  // =====================================================

  /**
   * Mergea dos LWW registers
   *
   * Gana el que tiene mayor timestamp.
   * Si son iguales, usa device_id como tie-breaker.
   *
   * @param a - LWW register A
   * @param b - LWW register B
   * @returns LWW register ganador
   */
  mergeLWW<T>(a: LWWRegister<T>, b: LWWRegister<T>): LWWRegister<T> {
    // Comparar timestamps
    if (a.timestamp > b.timestamp) {
      return a;
    } else if (a.timestamp < b.timestamp) {
      return b;
    }

    // Timestamps iguales: usar device_id como tie-breaker
    // Mayor device_id gana (orden lexicográfico)
    if (a.device_id > b.device_id) {
      return a;
    } else {
      return b;
    }
  }

  /**
   * Crea un LWW register desde un valor
   *
   * @param value - Valor inicial
   * @param timestamp - Timestamp del evento
   * @param deviceId - ID del dispositivo
   * @param vectorClock - Vector clock del evento
   * @returns LWW register
   */
  createLWW<T>(
    value: T,
    timestamp: number,
    deviceId: string,
    vectorClock: VectorClock,
  ): LWWRegister<T> {
    return {
      value,
      timestamp,
      device_id: deviceId,
      vector_clock: vectorClock,
    };
  }

  /**
   * Resuelve conflicto entre múltiples LWW registers
   *
   * @param registers - Array de LWW registers en conflicto
   * @returns LWW register ganador
   */
  resolveLWW<T>(registers: LWWRegister<T>[]): LWWRegister<T> {
    if (registers.length === 0) {
      throw new Error('Cannot resolve empty LWW registers');
    }

    if (registers.length === 1) {
      return registers[0];
    }

    // Reducir todos usando mergeLWW
    return registers.reduce((winner, current) =>
      this.mergeLWW(winner, current),
    );
  }

  // =====================================================
  // ADD-WINS SET (AWSet)
  // =====================================================

  /**
   * Crea un AWSet vacío
   */
  createAWSet<T>(): AWSet<T> {
    return {
      adds: new Map(),
      removes: new Set(),
    };
  }

  /**
   * Agrega un elemento al AWSet
   *
   * @param set - AWSet
   * @param id - ID único del elemento
   * @param value - Valor del elemento
   * @param timestamp - Timestamp del evento
   * @param deviceId - ID del dispositivo
   * @returns AWSet actualizado
   */
  addToAWSet<T>(
    set: AWSet<T>,
    id: string,
    value: T,
    timestamp: number,
    deviceId: string,
  ): AWSet<T> {
    const newAdds = new Map(set.adds);
    newAdds.set(id, { value, timestamp, device_id: deviceId });

    return {
      adds: newAdds,
      removes: set.removes,
    };
  }

  /**
   * Remueve un elemento del AWSet
   *
   * Nota: El elemento no se elimina realmente, solo se marca como removido.
   * Add siempre gana sobre Remove en caso de conflicto.
   *
   * @param set - AWSet
   * @param id - ID del elemento a remover
   * @returns AWSet actualizado
   */
  removeFromAWSet<T>(set: AWSet<T>, id: string): AWSet<T> {
    const newRemoves = new Set(set.removes);
    newRemoves.add(id);

    return {
      adds: set.adds,
      removes: newRemoves,
    };
  }

  /**
   * Mergea dos AWSets
   *
   * Estrategia:
   * - adds: unión de ambos (Map merge)
   * - removes: unión de ambos (Set union)
   * - Add siempre gana sobre Remove (bias-to-add)
   *
   * @param a - AWSet A
   * @param b - AWSet B
   * @returns AWSet merged
   */
  mergeAWSet<T>(a: AWSet<T>, b: AWSet<T>): AWSet<T> {
    // Merge adds: unión tomando el más reciente si hay conflicto
    const mergedAdds = new Map(a.adds);

    for (const [id, entry] of b.adds.entries()) {
      const existing = mergedAdds.get(id);

      if (!existing) {
        mergedAdds.set(id, entry);
      } else {
        // Si hay conflicto, tomar el más reciente
        if (entry.timestamp > existing.timestamp) {
          mergedAdds.set(id, entry);
        } else if (
          entry.timestamp === existing.timestamp &&
          entry.device_id > existing.device_id
        ) {
          mergedAdds.set(id, entry); // Tie-breaker por device_id
        }
      }
    }

    // Merge removes: unión simple
    const mergedRemoves = new Set([...a.removes, ...b.removes]);

    return {
      adds: mergedAdds,
      removes: mergedRemoves,
    };
  }

  /**
   * Obtiene los valores actuales del AWSet
   *
   * Retorna solo elementos que:
   * - Están en adds
   * - NO están en removes
   *
   * @param set - AWSet
   * @returns Array de valores
   */
  getAWSetValues<T>(set: AWSet<T>): T[] {
    const values: T[] = [];

    for (const [id, entry] of set.adds.entries()) {
      // Add gana sobre Remove: solo excluir si fue removido DESPUÉS de ser agregado
      if (!set.removes.has(id)) {
        values.push(entry.value);
      }
    }

    return values;
  }

  // =====================================================
  // MULTI-VALUE REGISTER (MVR)
  // =====================================================

  /**
   * Crea un MVR vacío
   */
  createMVR<T>(): MVRegister<T> {
    return {
      values: [],
    };
  }

  /**
   * Agrega un valor al MVR
   *
   * @param mvr - MVR
   * @param value - Valor
   * @param timestamp - Timestamp del evento
   * @param deviceId - ID del dispositivo
   * @param vectorClock - Vector clock del evento
   * @returns MVR actualizado
   */
  addToMVR<T>(
    mvr: MVRegister<T>,
    value: T,
    timestamp: number,
    deviceId: string,
    vectorClock: VectorClock,
  ): MVRegister<T> {
    return {
      values: [
        ...mvr.values,
        {
          value,
          timestamp,
          device_id: deviceId,
          vector_clock: vectorClock,
        },
      ],
    };
  }

  /**
   * Mergea dos MVRs eliminando valores causalmente precedidos
   *
   * Solo mantiene valores que son:
   * - Concurrentes entre sí (ninguno happened-before otro)
   * - No hay un valor posterior que los reemplace
   *
   * @param a - MVR A
   * @param b - MVR B
   * @returns MVR merged
   */
  mergeMVR<T>(a: MVRegister<T>, b: MVRegister<T>): MVRegister<T> {
    const allValues = [...a.values, ...b.values];

    if (allValues.length === 0) {
      return { values: [] };
    }

    // Eliminar valores que son causalmente precedidos por otros
    const filteredValues = allValues.filter((value) => {
      // Verificar si hay algún otro valor que happened-after este
      const hasLaterValue = allValues.some((other) => {
        if (value === other) return false;

        const relation = this.vectorClockService.compare(
          value.vector_clock,
          other.vector_clock,
        );

        // Si other happened-after value, value queda obsoleto
        return (
          relation === 'BEFORE' || // value → other
          (relation === 'EQUAL' && value.timestamp < other.timestamp)
        );
      });

      return !hasLaterValue;
    });

    return { values: filteredValues };
  }

  /**
   * Obtiene los valores del MVR
   *
   * Si hay múltiples valores, indica un conflicto que requiere resolución manual.
   *
   * @param mvr - MVR
   * @returns Array de valores (puede tener 0, 1, o múltiples)
   */
  getMVRValues<T>(mvr: MVRegister<T>): T[] {
    return mvr.values.map((entry) => entry.value);
  }

  /**
   * Verifica si un MVR tiene conflicto (múltiples valores concurrentes)
   *
   * @param mvr - MVR
   * @returns true si hay múltiples valores
   */
  hasMVRConflict<T>(mvr: MVRegister<T>): boolean {
    return mvr.values.length > 1;
  }

  // =====================================================
  // G-COUNTER (Grow-only Counter)
  // =====================================================

  /**
   * Crea un G-Counter vacío
   */
  createGCounter(): GCounter {
    return {
      counts: new Map(),
    };
  }

  /**
   * Incrementa el contador de un dispositivo
   *
   * @param counter - G-Counter
   * @param deviceId - ID del dispositivo
   * @param amount - Cantidad a incrementar (default: 1)
   * @returns G-Counter actualizado
   */
  incrementGCounter(
    counter: GCounter,
    deviceId: string,
    amount: number = 1,
  ): GCounter {
    const newCounts = new Map(counter.counts);
    const current = newCounts.get(deviceId) || 0;
    newCounts.set(deviceId, current + amount);

    return { counts: newCounts };
  }

  /**
   * Mergea dos G-Counters tomando el máximo de cada contador
   *
   * @param a - G-Counter A
   * @param b - G-Counter B
   * @returns G-Counter merged
   */
  mergeGCounter(a: GCounter, b: GCounter): GCounter {
    const mergedCounts = new Map(a.counts);

    for (const [device, count] of b.counts.entries()) {
      const existing = mergedCounts.get(device) || 0;
      mergedCounts.set(device, Math.max(existing, count));
    }

    return { counts: mergedCounts };
  }

  /**
   * Obtiene el valor total del G-Counter
   *
   * @param counter - G-Counter
   * @returns Suma de todos los contadores
   */
  getGCounterValue(counter: GCounter): number {
    let total = 0;

    for (const count of counter.counts.values()) {
      total += count;
    }

    return total;
  }

  // =====================================================
  // UTILIDADES GENERALES
  // =====================================================

  /**
   * Determina la mejor estrategia CRDT para un tipo de entidad y campo
   *
   * @param entityType - Tipo de entidad (product, sale, customer, etc)
   * @param fieldName - Nombre del campo
   * @returns Estrategia CRDT recomendada
   */
  recommendStrategy(
    entityType: string,
    fieldName: string,
  ): 'lww' | 'awset' | 'mvr' | 'gcounter' {
    // Estrategias específicas por entidad y campo
    const strategies: Record<string, Record<string, string>> = {
      product: {
        name: 'lww',
        price_bs: 'mvr', // Precio puede tener conflictos críticos
        price_usd: 'mvr',
        stock: 'gcounter', // Stock se puede sumar
        active: 'lww',
      },
      inventory_movement: {
        quantity: 'awset', // Movimientos siempre se agregan
      },
      sale: {
        items: 'awset', // Ítems de venta se agregan
        total_bs: 'gcounter',
        total_usd: 'gcounter',
      },
      customer: {
        name: 'lww',
        phone: 'lww',
        address: 'lww',
      },
      debt: {
        payments: 'awset', // Pagos siempre se agregan
        status: 'lww',
      },
    };

    const entityStrategies = strategies[entityType];

    if (entityStrategies && entityStrategies[fieldName]) {
      return entityStrategies[fieldName] as any;
    }

    // Default: LWW para campos simples
    return 'lww';
  }

  /**
   * Serializa un CRDT para almacenamiento en JSON
   *
   * @param crdt - CRDT de cualquier tipo
   * @param type - Tipo de CRDT
   * @returns JSON serializable
   */
  serialize(
    crdt: LWWRegister<any> | AWSet<any> | MVRegister<any> | GCounter,
    type: 'lww' | 'awset' | 'mvr' | 'gcounter',
  ): any {
    switch (type) {
      case 'lww':
        return crdt as LWWRegister<any>;

      case 'awset': {
        const awset = crdt as AWSet<any>;
        return {
          adds: Array.from(awset.adds.entries()),
          removes: Array.from(awset.removes),
        };
      }

      case 'mvr':
        return crdt as MVRegister<any>;

      case 'gcounter': {
        const counter = crdt as GCounter;
        return {
          counts: Array.from(counter.counts.entries()),
        };
      }

      default:
        throw new Error(`Unknown CRDT type: ${type}`);
    }
  }

  /**
   * Deserializa un CRDT desde JSON
   *
   * @param json - JSON serializado
   * @param type - Tipo de CRDT
   * @returns CRDT deserializado
   */
  deserialize(json: any, type: 'lww' | 'awset' | 'mvr' | 'gcounter'): any {
    switch (type) {
      case 'lww':
        return json as LWWRegister<any>;

      case 'awset':
        return {
          adds: new Map(json.adds || []),
          removes: new Set(json.removes || []),
        } as AWSet<any>;

      case 'mvr':
        return json as MVRegister<any>;

      case 'gcounter':
        return {
          counts: new Map(json.counts || []),
        } as GCounter;

      default:
        throw new Error(`Unknown CRDT type: ${type}`);
    }
  }
}
