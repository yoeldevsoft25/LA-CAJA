import { BaseEvent, EventActor } from './event.types';

// Simple UUID v4 generator (para evitar dependencia externa en domain)
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Factory para crear eventos con la estructura estándar
 */
export class EventFactory {
  static createEvent<T extends Record<string, any>>(
    type: string,
    payload: T,
    storeId: string,
    deviceId: string,
    actor: EventActor,
    seq: number,
    version: number = 1,
  ): BaseEvent {
    return {
      event_id: uuidv4(),
      store_id: storeId,
      device_id: deviceId,
      seq,
      type,
      version,
      created_at: Date.now(),
      actor,
      payload,
    };
  }
}

