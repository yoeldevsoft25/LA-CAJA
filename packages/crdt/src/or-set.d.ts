import { CRDT } from './types';
export interface ORSetState {
    elements: Record<string, string[]>;
    tombstones: Set<string>;
}
export interface ORSetDelta {
    type: 'add' | 'remove';
    element: string;
    tag: string;
}
export declare class ORSet implements CRDT<ORSetState, ORSetDelta> {
    empty(): ORSetState;
    createDelta(op: {
        type: 'add' | 'remove';
        element: string;
        tag: string;
    }, state: ORSetState): ORSetDelta;
    applyDelta(state: ORSetState, delta: ORSetDelta): ORSetState;
    merge(a: ORSetState, b: ORSetState): ORSetState;
    computeValue(state: ORSetState): string[];
}
