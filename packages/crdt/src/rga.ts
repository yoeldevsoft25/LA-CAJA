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
  insert?: { id: string; value: T; afterId?: string };
  remove?: string;
}

export class RGACRDT<T> implements CRDT<RGAState<T>, RGADelta<T>> {
  empty(): RGAState<T> {
    return { nodes: [] };
  }

  applyDelta(state: RGAState<T>, delta: RGADelta<T>): RGAState<T> {
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

  merge(a: RGAState<T>, b: RGAState<T>): RGAState<T> {
    const nodesMap = new Map<string, RGANode<T>>();
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

  computeValue(state: RGAState<T>): T[] {
    return state.nodes.filter((node) => node.visible).map((node) => node.value);
  }
}
