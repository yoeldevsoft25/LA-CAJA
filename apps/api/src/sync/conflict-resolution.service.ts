import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { VectorClockService, VectorClock, CausalRelation } from './vector-clock.service';
import { CRDTService, LWWRegister, AWSet, MVRegister } from './crdt.service';
import { Event } from '../database/entities/event.entity';

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
  strategy?: 'lww' | 'awset' | 'mvr' | 'gcounter' | 'manual';
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
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly dataSource: DataSource,
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
    strategy?: 'lww' | 'awset' | 'mvr' | 'gcounter' | 'manual',
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

        case 'gcounter':
          // Para G-Counter, usar AWSet ya que es similar (acumulativo)
          return this.resolveWithAWSet(conflictingEvents);

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

  /**
   * Resuelve un conflicto manualmente desde la UI
   *
   * @param conflictId - ID del conflicto en sync_conflicts
   * @param storeId - ID de la tienda
   * @param resolution - 'keep_mine' (mantener evento del cliente) o 'take_theirs' (usar evento del servidor)
   * @param userId - ID del usuario que resuelve el conflicto
   */
  async resolveManualConflict(
    conflictId: string,
    storeId: string,
    resolution: 'keep_mine' | 'take_theirs',
    userId: string,
  ): Promise<void> {
    this.logger.log(
      `Resolving conflict ${conflictId} with resolution: ${resolution}`,
    );

    // 1. Leer conflicto de la base de datos
    const conflict = await this.dataSource.query(
      `SELECT * FROM sync_conflicts 
       WHERE id = $1 AND store_id = $2 AND resolution_status = 'pending'`,
      [conflictId, storeId],
    );

    if (!conflict || conflict.length === 0) {
      throw new NotFoundException(
        `Conflicto ${conflictId} no encontrado o ya resuelto`,
      );
    }

    const conflictData = conflict[0];
    const eventIdA = conflictData.event_id_a;
    const eventIdB = conflictData.event_id_b;

    // 2. Determinar qué evento mantener
    // 'keep_mine' = eventIdB (el evento del cliente que está resuelviendo)
    // 'take_theirs' = eventIdA (el evento del servidor/otro dispositivo)
    const winningEventId =
      resolution === 'keep_mine' ? eventIdB : eventIdA;
    const losingEventId =
      resolution === 'keep_mine' ? eventIdA : eventIdB;

    // 3. Obtener los eventos
    const winningEvent = await this.eventRepository.findOne({
      where: { event_id: winningEventId },
    });

    const losingEvent = await this.eventRepository.findOne({
      where: { event_id: losingEventId },
    });

    if (!winningEvent || !losingEvent) {
      throw new NotFoundException(
        `Uno o ambos eventos no encontrados: ${winningEventId}, ${losingEventId}`,
      );
    }

    // 4. Si el evento perdedor aún no está aplicado, marcar su conflicto_status
    // Si ya está aplicado, necesitamos revertirlo o actualizarlo (más complejo)
    // Por ahora, solo marcamos el conflicto como resuelto

    // 5. Actualizar el conflicto en la base de datos
    await this.dataSource.query(
      `UPDATE sync_conflicts
       SET resolution_status = 'manual_resolved',
           resolution_strategy = 'manual',
           resolution_value = $1,
           resolved_at = NOW(),
           resolved_by = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [
        { winning_event_id: winningEventId, resolution },
        userId,
        conflictId,
      ],
    );

    // 6. Si el evento perdedor no está aplicado (aún está en conflicto),
    // actualizar su estado
    if (losingEvent.conflict_status === 'pending') {
      await this.eventRepository.update(
        { event_id: losingEventId },
        {
          conflict_status: 'resolved',
        },
      );
    }

    // 7. Si el evento ganador estaba en conflicto, marcarlo como resuelto también
    if (winningEvent.conflict_status === 'pending') {
      await this.eventRepository.update(
        { event_id: winningEventId },
        {
          conflict_status: 'resolved',
        },
      );
    }

    this.logger.log(
      `Conflict ${conflictId} resolved: keeping event ${winningEventId}`,
    );
  }
}
