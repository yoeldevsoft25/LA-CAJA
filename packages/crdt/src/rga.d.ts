import { CRDT } from './types';
export interface RGANode<T> {
    id: string;
    value: T;
    visible: boolean;
}
export interface RGAState<T> {
    nodes: RGANode<T>[];
}
export interface RGADelta<T> {
    insert?: {
        id: string;
        value: T;
        afterId?: string;
    };
    remove?: string;
}
export declare class RGACRDT<T> implements CRDT<RGAState<T>, RGADelta<T>> {
    empty(): RGAState<T>;
    applyDelta(state: RGAState<T>, delta: RGADelta<T>): RGAState<T>;
    merge(a: RGAState<T>, b: RGAState<T>): RGAState<T>;
    computeValue(state: RGAState<T>): T[];
}
