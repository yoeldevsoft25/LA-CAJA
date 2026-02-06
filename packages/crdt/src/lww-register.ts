import { CRDT } from './types';

export interface LWWRegisterState<T> {
  value: T;
  timestamp: number;
  nodeId: string;
}

export interface LWWRegisterDelta<T> {
  value: T;
  timestamp: number;
  nodeId: string;
}

export class LWWRegister<T> implements CRDT<LWWRegisterState<T>, LWWRegisterDelta<T>> {
  empty(): LWWRegisterState<T> {
    return { value: null as unknown as T, timestamp: -1, nodeId: '' };
  }

  applyDelta(state: LWWRegisterState<T>, delta: LWWRegisterDelta<T>): LWWRegisterState<T> {
    if (delta.timestamp > state.timestamp || (delta.timestamp === state.timestamp && delta.nodeId > state.nodeId)) {
      return { value: delta.value, timestamp: delta.timestamp, nodeId: delta.nodeId };
    }
    return state;
  }

  merge(a: LWWRegisterState<T>, b: LWWRegisterState<T>): LWWRegisterState<T> {
    if (b.timestamp > a.timestamp || (b.timestamp === a.timestamp && b.nodeId > a.nodeId)) {
      return b;
    }
    return a;
  }
}
