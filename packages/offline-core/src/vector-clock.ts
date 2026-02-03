/**
 * Vector Clock Client-Side
 *
 * Mantiene el vector clock local del dispositivo y lo sincroniza con el servidor
 */

export type VectorClock = Record<string, number>;

export class VectorClockManager {
  private deviceId: string;
  private localClock: VectorClock = {};
  private localSeq: number = 0;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.load();
  }

  /**
   * Incrementa el contador local y retorna el vector clock actualizado
   */
  tick(): VectorClock {
    this.localSeq++;
    this.localClock[this.deviceId] = this.localSeq;
    this.save();
    return { ...this.localClock };
  }

  /**
   * Obtiene el vector clock actual
   */
  getClock(): VectorClock {
    return { ...this.localClock };
  }

  /**
   * Obtiene la secuencia local actual
   */
  getLocalSeq(): number {
    return this.localSeq;
  }

  /**
   * Actualiza el vector clock con información del servidor
   *
   * Esto se hace después de sincronizar para que el cliente
   * conozca el estado de otros dispositivos
   */
  merge(serverClock: VectorClock): void {
    for (const [deviceId, seq] of Object.entries(serverClock)) {
      const currentSeq = this.localClock[deviceId] || 0;
      this.localClock[deviceId] = Math.max(currentSeq, seq);
    }
    this.save();
  }

  /**
   * Persiste el vector clock en localStorage
   */
  private save(): void {
    try {
      localStorage.setItem(
        `vector_clock_${this.deviceId}`,
        JSON.stringify({
          clock: this.localClock,
          seq: this.localSeq,
        })
      );
    } catch (error) {
      console.error('[VectorClock] Error saving to localStorage', error);
    }
  }

  /**
   * Carga el vector clock desde localStorage
   */
  private load(): void {
    try {
      const stored = localStorage.getItem(`vector_clock_${this.deviceId}`);
      if (stored) {
        const { clock, seq } = JSON.parse(stored);
        this.localClock = clock || {};
        this.localSeq = seq || 0;
      } else {
        // Inicializar con seq local en 0
        this.localClock[this.deviceId] = 0;
      }
    } catch (error) {
      console.error('[VectorClock] Error loading from localStorage', error);
      this.localClock[this.deviceId] = 0;
    }
  }

  /**
   * Reset para testing
   */
  reset(): void {
    this.localSeq = 0;
    this.localClock = { [this.deviceId]: 0 };
    this.save();
  }
}
