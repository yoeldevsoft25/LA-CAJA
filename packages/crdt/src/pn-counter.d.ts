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
export declare class PNCounter implements CRDT<PNCounterState, PNCounterDelta> {
    empty(): PNCounterState;
    applyDelta(state: PNCounterState, delta: PNCounterDelta): PNCounterState;
    merge(a: PNCounterState, b: PNCounterState): PNCounterState;
    computeValue(state: PNCounterState): number;
}
