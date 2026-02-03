import { Injectable, Logger } from '@nestjs/common';

/**
 * Vector Clock para ordenamiento causal en sistemas distribuidos
 *
 * Un Vector Clock es un mapa device_id → secuencia_local que permite:
 * 1. Determinar si un evento happened-before otro (A → B)
 * 2. Detectar eventos concurrentes (A || B)
 * 3. Mergear clocks de diferentes dispositivos
 *
 * Ejemplo:
 * Device A: {A: 5, B: 3} → conoce hasta seq 5 de A, seq 3 de B
 * Device B: {A: 4, B: 7} → conoce hasta seq 4 de A, seq 7 de B
 *
 * Al comparar:
 * - A.A (5) > B.A (4) → A tiene eventos más recientes de A
 * - B.B (7) > A.B (3) → B tiene eventos más recientes de B
 * → CONFLICTO CONCURRENTE (split-brain)
 */

export type VectorClock = Record<string, number>;

export enum CausalRelation {
  BEFORE = 'BEFORE', // A happened-before B (A → B)
  AFTER = 'AFTER', // A happened-after B (B → A)
  CONCURRENT = 'CONCURRENT', // A || B (neither happened-before the other)
  EQUAL = 'EQUAL', // A == B (same causal history)
}

@Injectable()
export class VectorClockService {
  private readonly logger = new Logger(VectorClockService.name);

  /**
   * Crea un vector clock vacío
   */
  createEmpty(): VectorClock {
    return {};
  }

  /**
   * Incrementa el contador de un dispositivo en el vector clock
   *
   * @param clock - Vector clock actual
   * @param deviceId - ID del dispositivo
   * @param value - Nuevo valor (opcional, si no se provee incrementa en 1)
   * @returns Vector clock actualizado
   */
  increment(clock: VectorClock, deviceId: string, value?: number): VectorClock {
    const newClock = { ...clock };

    if (value !== undefined) {
      newClock[deviceId] = value;
    } else {
      newClock[deviceId] = (newClock[deviceId] || 0) + 1;
    }

    return newClock;
  }

  /**
   * Compara dos vector clocks y determina su relación causal
   *
   * @param clockA - Vector clock del evento A
   * @param clockB - Vector clock del evento B
   * @returns Relación causal entre A y B
   *
   * Ejemplos:
   * compare({A:5, B:3}, {A:4, B:3}) → AFTER  (A es posterior)
   * compare({A:5, B:3}, {A:5, B:4}) → BEFORE (A es anterior)
   * compare({A:5, B:3}, {A:4, B:4}) → CONCURRENT (conflicto)
   */
  compare(clockA: VectorClock, clockB: VectorClock): CausalRelation {
    // Obtener todos los device IDs de ambos clocks
    const allDevices = new Set([
      ...Object.keys(clockA),
      ...Object.keys(clockB),
    ]);

    let aGreater = false; // A tiene al menos un contador mayor que B
    let bGreater = false; // B tiene al menos un contador mayor que A

    for (const device of allDevices) {
      const aValue = clockA[device] || 0;
      const bValue = clockB[device] || 0;

      if (aValue > bValue) {
        aGreater = true;
      } else if (bValue > aValue) {
        bGreater = true;
      }
    }

    // Determinar relación causal
    if (!aGreater && !bGreater) {
      return CausalRelation.EQUAL; // Mismo estado causal
    } else if (aGreater && !bGreater) {
      return CausalRelation.AFTER; // A happened-after B (A → B)
    } else if (!aGreater && bGreater) {
      return CausalRelation.BEFORE; // A happened-before B (B → A)
    } else {
      return CausalRelation.CONCURRENT; // A || B (conflicto)
    }
  }

  /**
   * Mergea dos vector clocks tomando el máximo de cada contador
   *
   * Esto representa el conocimiento combinado de ambos clocks.
   *
   * @param clockA - Vector clock A
   * @param clockB - Vector clock B
   * @returns Vector clock merged
   *
   * Ejemplo:
   * merge({A:5, B:3}, {A:4, B:7, C:2}) → {A:5, B:7, C:2}
   */
  merge(clockA: VectorClock, clockB: VectorClock): VectorClock {
    const merged: VectorClock = { ...clockA };

    for (const [device, value] of Object.entries(clockB)) {
      merged[device] = Math.max(merged[device] || 0, value);
    }

    return merged;
  }

  /**
   * Verifica si clockA happened-before clockB (A → B)
   *
   * A → B si y solo si:
   * - Para todo i: A[i] ≤ B[i]
   * - Existe al menos un j: A[j] < B[j]
   *
   * @param clockA - Vector clock del evento A
   * @param clockB - Vector clock del evento B
   * @returns true si A → B
   */
  happenedBefore(clockA: VectorClock, clockB: VectorClock): boolean {
    return this.compare(clockA, clockB) === CausalRelation.BEFORE;
  }

  /**
   * Verifica si clockA happened-after clockB (B → A)
   *
   * @param clockA - Vector clock del evento A
   * @param clockB - Vector clock del evento B
   * @returns true si B → A
   */
  happenedAfter(clockA: VectorClock, clockB: VectorClock): boolean {
    return this.compare(clockA, clockB) === CausalRelation.AFTER;
  }

  /**
   * Verifica si dos eventos son concurrentes (A || B)
   *
   * Eventos concurrentes indican un split-brain scenario:
   * - Múltiples dispositivos offline modificaron el mismo recurso
   * - No hay una relación causal clara (ninguno precedió al otro)
   * - Requiere resolución de conflicto
   *
   * @param clockA - Vector clock del evento A
   * @param clockB - Vector clock del evento B
   * @returns true si A || B
   */
  areConcurrent(clockA: VectorClock, clockB: VectorClock): boolean {
    return this.compare(clockA, clockB) === CausalRelation.CONCURRENT;
  }

  /**
   * Calcula la "distancia" entre dos vector clocks
   *
   * Útil para métricas y debugging. Mayor distancia = más divergencia.
   *
   * @param clockA - Vector clock A
   * @param clockB - Vector clock B
   * @returns Suma de diferencias absolutas de todos los contadores
   */
  distance(clockA: VectorClock, clockB: VectorClock): number {
    const allDevices = new Set([
      ...Object.keys(clockA),
      ...Object.keys(clockB),
    ]);

    let distance = 0;

    for (const device of allDevices) {
      const aValue = clockA[device] || 0;
      const bValue = clockB[device] || 0;
      distance += Math.abs(aValue - bValue);
    }

    return distance;
  }

  /**
   * Serializa un vector clock a string para almacenamiento
   *
   * Formato: "deviceA:5,deviceB:3,deviceC:10"
   * Ordenado alfabéticamente para comparación consistente
   *
   * @param clock - Vector clock
   * @returns String serializado
   */
  serialize(clock: VectorClock): string {
    const entries = Object.entries(clock).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return entries.map(([device, seq]) => `${device}:${seq}`).join(',');
  }

  /**
   * Deserializa un vector clock desde string
   *
   * @param serialized - String serializado
   * @returns Vector clock
   */
  deserialize(serialized: string): VectorClock {
    if (!serialized || serialized.trim() === '') {
      return {};
    }

    const clock: VectorClock = {};
    const entries = serialized.split(',');

    for (const entry of entries) {
      const [device, seqStr] = entry.split(':');
      const seq = parseInt(seqStr, 10);

      if (device && !isNaN(seq)) {
        clock[device] = seq;
      }
    }

    return clock;
  }

  /**
   * Obtiene el valor del contador de un dispositivo específico
   *
   * @param clock - Vector clock
   * @param deviceId - ID del dispositivo
   * @returns Valor del contador (0 si no existe)
   */
  get(clock: VectorClock, deviceId: string): number {
    return clock[deviceId] || 0;
  }

  /**
   * Crea un vector clock desde un evento con seq y device_id
   *
   * Útil para migrar eventos existentes que solo tienen seq local
   *
   * @param deviceId - ID del dispositivo
   * @param seq - Secuencia local del dispositivo
   * @returns Vector clock
   */
  fromEvent(deviceId: string, seq: number): VectorClock {
    return { [deviceId]: seq };
  }

  /**
   * Obtiene todos los device IDs presentes en un vector clock
   *
   * @param clock - Vector clock
   * @returns Array de device IDs
   */
  getDevices(clock: VectorClock): string[] {
    return Object.keys(clock);
  }

  /**
   * Verifica si un vector clock está vacío
   *
   * @param clock - Vector clock
   * @returns true si no tiene contadores o todos son 0
   */
  isEmpty(clock: VectorClock): boolean {
    if (!clock || Object.keys(clock).length === 0) {
      return true;
    }

    return Object.values(clock).every((value) => value === 0);
  }

  /**
   * Valida que un vector clock sea válido
   *
   * @param clock - Vector clock
   * @returns true si es válido (todos los valores son números >= 0)
   */
  isValid(clock: VectorClock): boolean {
    if (!clock || typeof clock !== 'object') {
      return false;
    }

    for (const [device, value] of Object.entries(clock)) {
      if (typeof device !== 'string' || device.trim() === '') {
        return false;
      }

      if (typeof value !== 'number' || value < 0 || !Number.isInteger(value)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Debugging: imprime un vector clock en formato legible
   *
   * @param clock - Vector clock
   * @param label - Etiqueta opcional
   */
  debug(clock: VectorClock, label?: string): void {
    const serialized = this.serialize(clock);
    const devices = this.getDevices(clock).length;

    this.logger.debug(
      `${label || 'VectorClock'}: {${serialized}} (${devices} devices)`,
    );
  }
}
