"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RGACRDT = void 0;
class RGACRDT {
    empty() {
        return { nodes: [] };
    }
    applyDelta(state, delta) {
        const nodes = [...state.nodes];
        if (delta.insert) {
            const idx = delta.insert.afterId
                ? nodes.findIndex((node) => node.id === delta.insert.afterId) + 1
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
    merge(a, b) {
        const nodesMap = new Map();
        for (const node of a.nodes) {
            nodesMap.set(node.id, node);
        }
        for (const node of b.nodes) {
            const existing = nodesMap.get(node.id);
            if (!existing) {
                nodesMap.set(node.id, node);
            }
            else if (!node.visible) {
                nodesMap.set(node.id, { ...existing, visible: false });
            }
        }
        const nodes = Array.from(nodesMap.values());
        return { nodes };
    }
    computeValue(state) {
        return state.nodes.filter((node) => node.visible).map((node) => node.value);
    }
}
exports.RGACRDT = RGACRDT;
//# sourceMappingURL=rga.js.map