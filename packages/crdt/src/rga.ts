import { CRDT } from './types';

export interface RgaNode<T> {
  id: string;
  value: T;
  visible: boolean;
}

export interface RgaState<T> {
  nodes: RgaNode<T>[];
}

export interface RgaDelta<T> {
  insert?: { id: string; value: T; afterId?: string };
  remove?: string;
}

export class RgaCRDT<T> implements CRDT<RgaState<T>, RgaDelta<T>> {
  empty(): RgaState<T> {
    return { nodes: [] };
  }

  applyDelta(state: RgaState<T>, delta: RgaDelta<T>): RgaState<T> {
    const nodes = [...state.nodes];
    if (delta.insert) {
      const idx = delta.insert.afterId
        ? nodes.findIndex((node) => node.id === delta.insert!.afterId) + 1
        : nodes.length;
      nodes.splice(idx, 0, {
        id: delta.insert.id,
        value: delta.insert.value,
        visible: true,
      });
    }
    if (delta.remove) {
      const idx = nodes.findIndex((node) => node.id === delta.remove);
      if (idx !== -1) {
        nodes[idx] = { ...nodes[idx], visible: false };
      }
    }
    return { nodes };
  }

  merge(a: RgaState<T>, b: RgaState<T>): RgaState<T> {
    const nodesMap = new Map<string, RgaNode<T>>();
    for (const node of a.nodes) {
      nodesMap.set(node.id, node);
    }
    for (const node of b.nodes) {
      const existing = nodesMap.get(node.id);
      if (!existing) {
        nodesMap.set(node.id, node);
      } else if (!node.visible) {
        nodesMap.set(node.id, { ...existing, visible: false });
      }
    }
    const nodes = Array.from(nodesMap.values());
    return { nodes };
  }

  visible(state: RgaState<T>): T[] {
    return state.nodes.filter((node) => node.visible).map((node) => node.value);
  }
}
