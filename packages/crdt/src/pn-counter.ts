import { CRDT } from './types';

export interface PNCounterState {
  increments: Record<string, number>;
  decrements: Record<string, number>;
}

export interface PNCounterDelta {
  nodeId: string;
  increment?: number;
  decrement?: number;
}

export class PNCounter implements CRDT<PNCounterState, PNCounterDelta> {
  empty(): PNCounterState {
    return { increments: {}, decrements: {} };
  }

  applyDelta(state: PNCounterState, delta: PNCounterDelta): PNCounterState {
    const increments = { ...state.increments };
    const decrements = { ...state.decrements };

    if (delta.increment !== undefined) {
      increments[delta.nodeId] = Math.max(increments[delta.nodeId] || 0, delta.increment);
    }
    if (delta.decrement !== undefined) {
      decrements[delta.nodeId] = Math.max(decrements[delta.nodeId] || 0, delta.decrement);
    }

    return { increments, decrements };
  }

  merge(a: PNCounterState, b: PNCounterState): PNCounterState {
    const increments: Record<string, number> = { ...a.increments };
    const decrements: Record<string, number> = { ...a.decrements };

    for (const [nodeId, value] of Object.entries(b.increments)) {
      increments[nodeId] = Math.max(increments[nodeId] || 0, value);
    }
    for (const [nodeId, value] of Object.entries(b.decrements)) {
      decrements[nodeId] = Math.max(decrements[nodeId] || 0, value);
    }

    return { increments, decrements };
  }

  computeValue(state: PNCounterState): number {
    const inc = Object.values(state.increments).reduce((acc, v) => acc + v, 0);
    const dec = Object.values(state.decrements).reduce((acc, v) => acc + v, 0);
    return inc - dec;
  }
}
