"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PNCounter = void 0;
class PNCounter {
    empty() {
        return { increments: {}, decrements: {} };
    }
    applyDelta(state, delta) {
        const increments = { ...state.increments };
        const decrements = { ...state.decrements };
        if (delta.increment !== undefined) {
            increments[delta.nodeId] = Math.max(increments[delta.nodeId] || 0, delta.increment);
        }
        if (delta.decrement !== undefined) {
            decrements[delta.nodeId] = Math.max(decrements[delta.nodeId] || 0, delta.decrement);
        }
        return { increments, decrements };
    }
    merge(a, b) {
        const increments = { ...a.increments };
        const decrements = { ...a.decrements };
        for (const [nodeId, value] of Object.entries(b.increments)) {
            increments[nodeId] = Math.max(increments[nodeId] || 0, value);
        }
        for (const [nodeId, value] of Object.entries(b.decrements)) {
            decrements[nodeId] = Math.max(decrements[nodeId] || 0, value);
        }
        return { increments, decrements };
    }
    computeValue(state) {
        const inc = Object.values(state.increments).reduce((acc, v) => acc + v, 0);
        const dec = Object.values(state.decrements).reduce((acc, v) => acc + v, 0);
        return inc - dec;
    }
}
exports.PNCounter = PNCounter;
//# sourceMappingURL=pn-counter.js.map