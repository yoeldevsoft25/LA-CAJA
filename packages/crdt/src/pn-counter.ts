import { CRDT } from './types';

export interface PnCounterState {
  positive: number;
  negative: number;
}

export interface PnCounterDelta {
  positive?: number;
  negative?: number;
}

export class PnCounterCRDT implements CRDT<PnCounterState, PnCounterDelta> {
  empty(): PnCounterState {
    return { positive: 0, negative: 0 };
  }

  applyDelta(state: PnCounterState, delta: PnCounterDelta): PnCounterState {
    return {
      positive: state.positive + (delta.positive ?? 0),
      negative: state.negative + (delta.negative ?? 0),
    };
  }

  merge(a: PnCounterState, b: PnCounterState): PnCounterState {
    return {
      positive: Math.max(a.positive, b.positive),
      negative: Math.max(a.negative, b.negative),
    };
  }

  value(state: PnCounterState): number {
    return state.positive - state.negative;
  }
}
