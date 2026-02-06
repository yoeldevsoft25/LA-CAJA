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
export declare class LWWRegister<T> implements CRDT<LWWRegisterState<T>, LWWRegisterDelta<T>> {
    empty(): LWWRegisterState<T>;
    applyDelta(state: LWWRegisterState<T>, delta: LWWRegisterDelta<T>): LWWRegisterState<T>;
    merge(a: LWWRegisterState<T>, b: LWWRegisterState<T>): LWWRegisterState<T>;
}
