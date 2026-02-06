import { CRDT } from './types';

export interface LwwRegisterState<T> {
  value: T;
  timestamp: number;
}

export interface LwwRegisterDelta<T> {
  value: T;
  timestamp: number;
}

export class LwwRegisterCRDT<T> implements CRDT<LwwRegisterState<T>, LwwRegisterDelta<T>> {
  empty(): LwwRegisterState<T> {
    return { value: null as unknown as T, timestamp: -1 };
  }

  applyDelta(state: LwwRegisterState<T>, delta: LwwRegisterDelta<T>): LwwRegisterState<T> {
    if (delta.timestamp >= state.timestamp) {
      return { value: delta.value, timestamp: delta.timestamp };
    }
    return state;
  }

  merge(a: LwwRegisterState<T>, b: LwwRegisterState<T>): LwwRegisterState<T> {
    return a.timestamp >= b.timestamp ? a : b;
  }
}
