/**
 * Sistema de Prioridades para Eventos
 * Determina el orden de sincronización basado en importancia del evento
 */

import { BaseEvent } from '@la-caja/domain';

export enum EventPriority {
  CRITICAL = 100,  // Ventas, pagos - debe sincronizarse primero
  HIGH = 50,       // Inventario, caja - importante pero no crítico
  NORMAL = 25,     // Productos, clientes - comportamiento por defecto
  LOW = 10         // Configuración, logs - puede esperar
}

/**
 * Obtiene la prioridad de un evento basado en su tipo
 * Por defecto retorna NORMAL para mantener comportamiento actual
 */
export function getEventPriority(eventType: string): EventPriority {
  // Eventos críticos - deben sincronizarse primero
  if (
    eventType === 'SaleCreated' ||
    eventType === 'DebtPaymentRecorded' ||
    eventType === 'CashSessionClosed'
  ) {
    return EventPriority.CRITICAL;
  }

  // Eventos de alta prioridad
  if (
    eventType === 'StockReceived' ||
    eventType === 'StockAdjusted' ||
    eventType === 'CashSessionOpened'
  ) {
    return EventPriority.HIGH;
  }

  // Eventos normales (comportamiento por defecto)
  if (
    eventType === 'ProductCreated' ||
    eventType === 'ProductUpdated' ||
    eventType === 'ProductDeactivated' ||
    eventType === 'RecipeIngredientsUpdated' ||
    eventType === 'PriceChanged' ||
    eventType === 'CustomerCreated' ||
    eventType === 'CustomerUpdated' ||
    eventType === 'DebtCreated'
  ) {
    return EventPriority.NORMAL;
  }

  // Por defecto, prioridad normal (comportamiento actual)
  return EventPriority.NORMAL;
}

/**
 * Compara dos eventos por prioridad (para ordenamiento)
 * Retorna negativo si a tiene mayor prioridad que b
 */
export function compareByPriority(a: BaseEvent, b: BaseEvent): number {
  const priorityA = getEventPriority(a.type);
  const priorityB = getEventPriority(b.type);

  // Mayor prioridad primero
  if (priorityA !== priorityB) {
    return priorityB - priorityA;
  }

  // Si misma prioridad, ordenar por secuencia (más antiguo primero)
  return a.seq - b.seq;
}
