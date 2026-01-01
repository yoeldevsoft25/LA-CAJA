import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VectorClockService, VectorClock, CausalRelation } from './vector-clock.service';
import { CRDTService, LWWRegister, AWSet, MVRegister } from './crdt.service';

/**
 * Conflict Resolution Service
 *
 * Detecta y resuelve conflictos entre eventos usando:
 * 1. Vector Clocks para determinar relación causal
 * 2. CRDT para resolución automática
 * 3. Queue de conflictos para resolución manual
 */

export interface ConflictDetectionResult {
  hasConflict: boolean;
  relation: CausalRelation;
  requiresResolution: boolean;
  strategy?: 'lww' | 'awset' | 'mvr' | 'manual';
}

export interface ConflictResolutionResult {
  resolved: boolean;
  strategy: string;
  resolvedValue: any;
  requiresManualReview: boolean;
  conflictId?: string;
}

@Injectable()
export class ConflictResolutionService {
  private readonly logger = new Logger(ConflictResolutionService.name);

  constructor(
    private readonly vectorClockService: VectorClockService,
    private readonly crdtService: CRDTService,
  ) {}

  /**
   * Detecta si dos eventos están en conflicto
   *
   * Dos eventos están en conflicto si:
   * 1. Modifican la misma entidad y campo
   * 2. Son concurrentes (ninguno happened-before el otro)
   *
   * @param eventA - Primer evento
   * @param eventB - Segundo evento
   * @returns Resultado de detección de conflicto
   */
  detectConflict(
    eventA: {
      vector_clock: VectorClock;
      entity_type: string;
      entity_id: string;
      field_name?: string;
    },
    eventB: {
      vector_clock: VectorClock;
      entity_type: string;
      entity_id: string;
      field_name?: string;
    },
  ): ConflictDetectionResult {
    // 1. Verificar que modifiquen la misma entidad
    if (
      eventA.entity_type !== eventB.entity_type ||
      eventA.entity_id !== eventB.entity_id
    ) {
      return {
        hasConflict: false,
        relation: CausalRelation.EQUAL,
        requiresResolution: false,
      };
    }

    // 2. Comparar vector clocks
    const relation = this.vectorClockService.compare(
      eventA.vector_clock,
      eventB.vector_clock,
    );

    // 3. Solo hay conflicto si son concurrentes
    const hasConflict = relation === CausalRelation.CONCURRENT;

    if (!hasConflict) {
      return {
        hasConflict: false,
        relation,
        requiresResolution: false,
      };
    }

    // 4. Determinar estrategia de resolución
    const strategy = this.crdtService.recommendStrategy(
      eventA.entity_type,
      eventA.field_name || 'default',
    );

    return {
      hasConflict: true,
      relation,
      requiresResolution: true,
      strategy,
    };
  }

  /**
   * Resuelve un conflicto usando la estrategia apropiada
   *
   * @param conflictingEvents - Array de eventos en conflicto
   * @param strategy - Estrategia de resolución (auto-detectada o manual)
   * @returns Resultado de resolución
   */
  async resolveConflict(
    conflictingEvents: Array<{
      event_id: string;
      payload: any;
      timestamp: number;
      device_id: string;
      vector_clock: VectorClock;
    }>,
    strategy?: 'lww' | 'awset' | 'mvr' | 'manual',
  ): Promise<ConflictResolutionResult> {
    if (conflictingEvents.length < 2) {
      throw new Error('Need at least 2 events to resolve conflict');
    }

    // Auto-detectar estrategia si no se provee
    if (!strategy) {
      strategy = 'lww'; // Default
    }

    try {
      switch (strategy) {
        case 'lww':
          return this.resolveWithLWW(conflictingEvents);

        case 'awset':
          return this.resolveWithAWSet(conflictingEvents);

        case 'mvr':
          return this.resolveWithMVR(conflictingEvents);

        case 'manual':
          return this.createManualConflict(conflictingEvents);

        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }
    } catch (error) {
      this.logger.error(`Error resolving conflict: ${error.message}`, error.stack);

      // Fallback a resolución manual
      return this.createManualConflict(conflictingEvents);
    }
  }

  /**
   * Resuelve conflicto usando Last-Write-Wins
   *
   * Gana el evento con mayor timestamp.
   * Tie-breaker: mayor device_id.
   *
   * @param events - Eventos en conflicto
   * @returns Resultado de resolución
   */
  private resolveWithLWW(
    events: Array<{
      event_id: string;
      payload: any;
      timestamp: number;
      device_id: string;
      vector_clock: VectorClock;
    }>,
  ): ConflictResolutionResult {
    // Convertir eventos a LWW registers
    const registers: LWWRegister<any>[] = events.map((event) =>
      this.crdtService.createLWW(
        event.payload,
        event.timestamp,
        event.device_id,
        event.vector_clock,
      ),
    );

    // Resolver usando CRDT
    const winner = this.crdtService.resolveLWW(registers);

    this.logger.log(
      `LWW resolved: ${events.length} events, winner device=${winner.device_id}`,
    );

    return {
      resolved: true,
      strategy: 'lww',
      resolvedValue: winner.value,
      requiresManualReview: false,
    };
  }

  /**
   * Resuelve conflicto usando Add-Wins Set
   *
   * Todos los "adds" se conservan, "removes" se ignoran en conflicto.
   *
   * @param events - Eventos en conflicto
   * @returns Resultado de resolución
   */
  private resolveWithAWSet(
    events: Array<{
      event_id: string;
      payload: any;
      timestamp: number;
      device_id: string;
      vector_clock: VectorClock;
    }>,
  ): ConflictResolutionResult {
    // Crear AWSet vacío
    let awset = this.crdtService.createAWSet<any>();

    // Agregar todos los eventos al set
    for (const event of events) {
      awset = this.crdtService.addToAWSet(
        awset,
        event.event_id,
        event.payload,
        event.timestamp,
        event.device_id,
      );
    }

    // Obtener valores finales
    const resolvedValues = this.crdtService.getAWSetValues(awset);

    this.logger.log(
      `AWSet resolved: ${events.length} events, ${resolvedValues.length} final values`,
    );

    return {
      resolved: true,
      strategy: 'awset',
      resolvedValue: resolvedValues,
      requiresManualReview: false,
    };
  }

  /**
   * Resuelve conflicto usando Multi-Value Register
   *
   * Si hay múltiples valores concurrentes, requiere resolución manual.
   *
   * @param events - Eventos en conflicto
   * @returns Resultado de resolución
   */
  private resolveWithMVR(
    events: Array<{
      event_id: string;
      payload: any;
      timestamp: number;
      device_id: string;
      vector_clock: VectorClock;
    }>,
  ): ConflictResolutionResult {
    // Crear MVR vacío
    let mvr = this.crdtService.createMVR<any>();

    // Agregar todos los eventos al MVR
    for (const event of events) {
      mvr = this.crdtService.addToMVR(
        mvr,
        event.payload,
        event.timestamp,
        event.device_id,
        event.vector_clock,
      );
    }

    // Mergear para eliminar valores causalmente precedidos
    mvr = this.crdtService.mergeMVR(mvr, this.crdtService.createMVR());

    const values = this.crdtService.getMVRValues(mvr);
    const hasConflict = this.crdtService.hasMVRConflict(mvr);

    if (hasConflict) {
      this.logger.warn(
        `MVR conflict: ${values.length} concurrent values, requires manual review`,
      );

      return {
        resolved: false,
        strategy: 'mvr',
        resolvedValue: values,
        requiresManualReview: true,
      };
    }

    // Solo un valor: resuelto automáticamente
    this.logger.log(`MVR resolved: 1 final value`);

    return {
      resolved: true,
      strategy: 'mvr',
      resolvedValue: values[0],
      requiresManualReview: false,
    };
  }

  /**
   * Crea un conflicto para resolución manual
   *
   * Esto inserta un registro en la tabla sync_conflicts para que
   * un usuario tome la decisión.
   *
   * @param events - Eventos en conflicto
   * @returns Resultado de resolución
   */
  private createManualConflict(
    events: Array<{
      event_id: string;
      payload: any;
      timestamp: number;
      device_id: string;
      vector_clock: VectorClock;
    }>,
  ): ConflictResolutionResult {
    this.logger.warn(
      `Manual conflict created: ${events.length} events require user decision`,
    );

    // En una implementación completa, aquí insertarías en sync_conflicts table
    // Por ahora, solo retornamos el resultado

    return {
      resolved: false,
      strategy: 'manual',
      resolvedValue: events.map((e) => e.payload),
      requiresManualReview: true,
      conflictId: `conflict-${Date.now()}`, // Temporal
    };
  }

  /**
   * Determina la prioridad de un conflicto
   *
   * Usado para ordenar la queue de resolución manual.
   *
   * @param entityType - Tipo de entidad
   * @param fieldName - Nombre del campo
   * @returns Prioridad: critical/high/medium/low
   */
  determineConflictPriority(
    entityType: string,
    fieldName: string,
  ): 'critical' | 'high' | 'medium' | 'low' {
    // Conflictos críticos: afectan transacciones financieras
    const criticalCombinations = [
      { entity: 'sale', field: 'total_bs' },
      { entity: 'sale', field: 'total_usd' },
      { entity: 'debt', field: 'amount_bs' },
      { entity: 'debt', field: 'amount_usd' },
      { entity: 'cash_session', field: 'final_balance_bs' },
      { entity: 'cash_session', field: 'final_balance_usd' },
    ];

    for (const combo of criticalCombinations) {
      if (entityType === combo.entity && fieldName === combo.field) {
        return 'critical';
      }
    }

    // Conflictos altos: afectan inventario o precios
    const highCombinations = [
      { entity: 'product', field: 'price_bs' },
      { entity: 'product', field: 'price_usd' },
      { entity: 'product', field: 'stock' },
      { entity: 'inventory_movement', field: 'quantity' },
    ];

    for (const combo of highCombinations) {
      if (entityType === combo.entity && fieldName === combo.field) {
        return 'high';
      }
    }

    // Conflictos medios: datos de clientes, configuración
    if (entityType === 'customer' || entityType === 'supplier') {
      return 'medium';
    }

    // Default: baja prioridad
    return 'low';
  }

  /**
   * Calcula un hash de un payload para comparación
   *
   * @param payload - Payload del evento
   * @returns Hash SHA-256 en hex
   */
  hashPayload(payload: any): string {
    const crypto = require('crypto');
    const json = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * Compara dos payloads para ver si son idénticos
   *
   * @param a - Payload A
   * @param b - Payload B
   * @returns true si son idénticos
   */
  arePayloadsEqual(a: any, b: any): boolean {
    return this.hashPayload(a) === this.hashPayload(b);
  }
}
