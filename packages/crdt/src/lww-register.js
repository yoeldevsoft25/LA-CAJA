"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LWWRegister = void 0;
class LWWRegister {
    empty() {
        return { value: null, timestamp: -1, nodeId: '' };
    }
    applyDelta(state, delta) {
        if (delta.timestamp > state.timestamp || (delta.timestamp === state.timestamp && delta.nodeId > state.nodeId)) {
            return { value: delta.value, timestamp: delta.timestamp, nodeId: delta.nodeId };
        }
        return state;
    }
    merge(a, b) {
        if (b.timestamp > a.timestamp || (b.timestamp === a.timestamp && b.nodeId > a.nodeId)) {
            return b;
        }
        return a;
    }
}
exports.LWWRegister = LWWRegister;
//# sourceMappingURL=lww-register.js.map