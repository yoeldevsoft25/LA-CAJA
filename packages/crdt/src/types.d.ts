export interface CRDTDelta<T> {
    deltaId: string;
    entityId: string;
    storeId: string;
    requestId: string;
    timestamp: number;
    payload: T;
}
export interface CRDTResult<T> {
    state: T;
    merged: boolean;
}
export interface CRDT<TState, TDelta> {
    applyDelta(state: TState, delta: TDelta): TState;
    merge(a: TState, b: TState): TState;
    empty(): TState;
}
export interface CRDTEnvelope<TDelta> {
    entity: string;
    entityId: string;
    storeId: string;
    deltaId: string;
    requestId: string;
    causalClock: number;
    hash: string;
    payload: TDelta;
}
