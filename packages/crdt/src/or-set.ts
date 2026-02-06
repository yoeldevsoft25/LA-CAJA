import { CRDT } from './types';

export interface ORSetState {
  elements: Record<string, string[]>; // element -> tags
  tombstones: Set<string>; // tags removed
}

export interface ORSetDelta {
  type: 'add' | 'remove';
  element: string;
  tag: string;
}

export class ORSet implements CRDT<ORSetState, ORSetDelta> {
  empty(): ORSetState {
    return {
      elements: {},
      tombstones: new Set(),
    };
  }

  createDelta(op: { type: 'add' | 'remove'; element: string; tag: string }, state: ORSetState): ORSetDelta {
    if (op.type === 'add') {
      return { type: 'add', element: op.element, tag: op.tag };
    } else {
      // Para remove, enviamos todos los tags actuales como eliminados
      const tags = state.elements[op.element] || [];
      return { type: 'remove', element: op.element, tag: tags.join(',') };
    }
  }

  applyDelta(state: ORSetState, delta: ORSetDelta): ORSetState {
    const elements = { ...state.elements };
    const tombstones = new Set(state.tombstones);

    if (delta.type === 'add') {
      if (!tombstones.has(delta.tag)) {
        const tags = elements[delta.element] || [];
        if (!tags.includes(delta.tag)) {
          elements[delta.element] = [...tags, delta.tag];
        }
      }
    } else if (delta.type === 'remove') {
      const tagsToRemove = delta.tag.split(',').filter(Boolean);
      for (const tag of tagsToRemove) {
        tombstones.add(tag);
      }
      // Limpiar elementos que ya no tienen tags válidos
      for (const [element, tags] of Object.entries(elements)) {
        const remainingTags = (tags as string[]).filter(t => !tombstones.has(t));
        if (remainingTags.length === 0) {
          delete elements[element];
        } else {
          elements[element] = remainingTags;
        }
      }
    }

    return { elements, tombstones };
  }

  merge(a: ORSetState, b: ORSetState): ORSetState {
    const tombstones = new Set([...a.tombstones, ...b.tombstones]);
    const elements: Record<string, string[]> = {};

    const allElements = new Set([...Object.keys(a.elements), ...Object.keys(b.elements)]);

    for (const element of allElements) {
      const tagsA = a.elements[element] || [];
      const tagsB = b.elements[element] || [];
      const combinedTags = Array.from(new Set([...tagsA, ...tagsB])).filter(t => !tombstones.has(t));

      if (combinedTags.length > 0) {
        elements[element] = combinedTags;
      }
    }

    return { elements, tombstones };
  }

  computeValue(state: ORSetState): string[] {
    return Object.keys(state.elements);
  }
}
