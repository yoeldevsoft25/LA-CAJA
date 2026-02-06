import { CRDT } from './types';

export interface OrSetState<T> {
  additions: Map<string, T>;
  removals: Set<string>;
}

export interface OrSetDelta<T> {
  adds?: Array<{ elementId: string; value: T }>;
  removes?: Array<string>;
}

export class OrSetCRDT<T> implements CRDT<OrSetState<T>, OrSetDelta<T>> {
  empty(): OrSetState<T> {
    return {
      additions: new Map(),
      removals: new Set(),
    };
  }

  applyDelta(state: OrSetState<T>, delta: OrSetDelta<T>): OrSetState<T> {
    const additions = new Map(state.additions);
    const removals = new Set(state.removals);
    if (delta.adds) {
      for (const add of delta.adds) {
        additions.set(add.elementId, add.value);
      }
    }
    if (delta.removes) {
      for (const id of delta.removes) {
        removals.add(id);
      }
    }
    return { additions, removals };
  }

  merge(a: OrSetState<T>, b: OrSetState<T>): OrSetState<T> {
    const additions = new Map(a.additions);
    for (const [key, value] of b.additions.entries()) {
      additions.set(key, value);
    }
    const removals = new Set([...a.removals, ...b.removals]);
    return { additions, removals };
  }

  elements(state: OrSetState<T>): T[] {
    const elements: T[] = [];
    for (const [id, value] of state.additions.entries()) {
      if (!state.removals.has(id)) {
        elements.push(value);
      }
    }
    return elements;
  }
}
