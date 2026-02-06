"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORSet = void 0;
class ORSet {
    empty() {
        return {
            elements: {},
            tombstones: new Set(),
        };
    }
    createDelta(op, state) {
        if (op.type === 'add') {
            return { type: 'add', element: op.element, tag: op.tag };
        }
        else {
            const tags = state.elements[op.element] || [];
            return { type: 'remove', element: op.element, tag: tags.join(',') };
        }
    }
    applyDelta(state, delta) {
        const elements = { ...state.elements };
        const tombstones = new Set(state.tombstones);
        if (delta.type === 'add') {
            if (!tombstones.has(delta.tag)) {
                const tags = elements[delta.element] || [];
                if (!tags.includes(delta.tag)) {
                    elements[delta.element] = [...tags, delta.tag];
                }
            }
        }
        else if (delta.type === 'remove') {
            const tagsToRemove = delta.tag.split(',').filter(Boolean);
            for (const tag of tagsToRemove) {
                tombstones.add(tag);
            }
            for (const [element, tags] of Object.entries(elements)) {
                const remainingTags = tags.filter(t => !tombstones.has(t));
                if (remainingTags.length === 0) {
                    delete elements[element];
                }
                else {
                    elements[element] = remainingTags;
                }
            }
        }
        return { elements, tombstones };
    }
    merge(a, b) {
        const tombstones = new Set([...a.tombstones, ...b.tombstones]);
        const elements = {};
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
    computeValue(state) {
        return Object.keys(state.elements);
    }
}
exports.ORSet = ORSet;
//# sourceMappingURL=or-set.js.map