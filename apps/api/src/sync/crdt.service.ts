import { Injectable, Logger } from '@nestjs/common';
import { VectorClockService, VectorClock } from './vector-clock.service';
import {
  PNCounter,
  PNCounterState,
  PNCounterDelta,
  LWWRegister as LWWReg,
  LWWRegisterState,
  LWWRegisterDelta,
  ORSet,
  ORSetState,
  ORSetDelta,
  RGACRDT,
  RGAState,
  RGADelta,
} from '@la-caja/crdt';

// Mapeo de tipos para compatibilidad
export type LWWRegister<T> = LWWRegisterState<T> & {
  device_id?: string; // Mantener alias para compatibilidad de DTOs si es necesario
  vector_clock?: VectorClock;
};
export type AWSet<T> = ORSetState;
export type GCounter = PNCounterState;
export interface MVRegister<T> {
  values: Array<{
    value: T;
    timestamp: number;
    device_id: string;
    vector_clock: VectorClock;
  }>;
}

@Injectable()
export class CRDTService {
  private readonly logger = new Logger(CRDTService.name);
  private readonly pnCounter = new PNCounter();
  private readonly lwwRegister = new LWWReg<any>();
  private readonly orSet = new ORSet();
  private readonly rgaComp = new RGACRDT<any>();

  constructor(private readonly vectorClockService: VectorClockService) { }

  /**
   * Aplica un delta a un estado CRDT basado en el tipo de entidad
   */
  applyDelta(entity: string, state: any, delta: any): any {
    try {
      const type = this.recommendStrategy(entity, '');
      switch (type) {
        case 'gcounter':
        case 'g-counter' as any:
          return this.pnCounter.applyDelta(state, delta);
        case 'lww':
        case 'lww-register' as any:
          return this.lwwRegister.applyDelta(state, delta);
        case 'awset':
        case 'aw-set' as any:
          return this.orSet.applyDelta(state, delta);
        case 'rga' as any:
          return this.rgaComp.applyDelta(state, delta);
        default:
          return state;
      }
    } catch (error) {
      this.logger.error(
        `Error applying delta for entity ${entity}`,
        error.stack,
      );
      return state;
    }
  }

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
    // Usar la implementación de la clase para consistencia
    return this.lwwRegister.merge(a, b) as LWWRegister<T>;
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
      nodeId: deviceId,
      device_id: deviceId, // Mantener alias
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
      elements: {},
      tombstones: new Set(),
    };
  }

  /**
   * Agrega un elemento al AWSet
   */
  addToAWSet<T>(
    set: AWSet<T>,
    id: string,
    value: T,
    timestamp: number,
    deviceId: string,
  ): AWSet<T> {
    return this.orSet.applyDelta(set, {
      type: 'add',
      element: id,
      tag: `${deviceId}-${timestamp}`,
    });
  }

  /**
   * Remueve un elemento del AWSet
   */
  removeFromAWSet<T>(set: AWSet<T>, id: string): AWSet<T> {
    const delta = this.orSet.createDelta(
      { type: 'remove', element: id, tag: '' },
      set,
    );
    return this.orSet.applyDelta(set, delta);
  }

  /**
   * Mergea dos AWSets
   */
  mergeAWSet<T>(a: AWSet<T>, b: AWSet<T>): AWSet<T> {
    return this.orSet.merge(a, b);
  }

  /**
   * Obtiene los valores actuales del AWSet
   */
  getAWSetValues<T>(set: AWSet<T>): T[] {
    return this.orSet.computeValue(set) as any;
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
      increments: {},
      decrements: {},
    };
  }

  /**
   * Incrementa el contador de un dispositivo
   */
  incrementGCounter(
    counter: GCounter,
    deviceId: string,
    amount: number = 1,
  ): GCounter {
    const current = (counter.increments && counter.increments[deviceId]) || 0;
    return this.pnCounter.applyDelta(counter, {
      nodeId: deviceId,
      increment: current + amount,
    });
  }

  /**
   * Mergea dos G-Counters
   */
  mergeGCounter(a: GCounter, b: GCounter): GCounter {
    return this.pnCounter.merge(a, b);
  }

  /**
   * Obtiene el valor total del PNCounter
   */
  getGCounterValue(counter: GCounter): number {
    return this.pnCounter.computeValue(counter);
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
      inventory: {
        stock: 'gcounter',
        increments: 'gcounter',
        decrements: 'gcounter',
      },
      cash: {
        balance: 'gcounter',
        increments: 'gcounter',
        decrements: 'gcounter',
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
  serialize(crdt: any, type: 'lww' | 'awset' | 'mvr' | 'gcounter'): any {
    switch (type) {
      case 'awset': {
        const awset = crdt as ORSetState;
        return {
          elements: awset.elements,
          tombstones: Array.from(awset.tombstones),
        };
      }
      default:
        return crdt;
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
      case 'awset':
        return {
          elements: json.elements || {},
          tombstones: new Set(json.tombstones || []),
        } as ORSetState;
      default:
        return json;
    }
  }
}
