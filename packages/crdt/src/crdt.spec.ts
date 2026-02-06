import { describe, it, expect } from 'vitest';
import { PNCounter } from './pn-counter';
import { LWWRegister } from './lww-register';
import { ORSet } from './or-set';

describe('PNCounter', () => {
    it('should merge increments correctly', () => {
        const counter = new PNCounter();
        const state1 = { increments: { A: 10 }, decrements: {} };

        // applyDelta handles nodal updates
        const merged = counter.applyDelta(state1, { nodeId: 'A', increment: 20 });
        expect(merged.increments.A).toBe(20);

        // Verify idempotent max()
        const merged2 = counter.applyDelta(merged, { nodeId: 'A', increment: 15 });
        expect(merged2.increments.A).toBe(20);
    });

    it('should compute value', () => {
        const counter = new PNCounter();
        const state = { increments: { A: 10, B: 5 }, decrements: { A: 2 } };
        expect(counter.computeValue(state)).toBe(13);
    });
});

describe('LWWRegister', () => {
    it('should respect last write wins by timestamp', () => {
        const lww = new LWWRegister<string>();
        const state = { value: 'initial', timestamp: 100, nodeId: 'A' };

        // Older update ignored
        const merged1 = lww.applyDelta(state, { value: 'old', timestamp: 50, nodeId: 'B' });
        expect(merged1.value).toBe('initial');

        // Newer update accepted
        const merged2 = lww.applyDelta(state, { value: 'new', timestamp: 150, nodeId: 'B' });
        expect(merged2.value).toBe('new');
    });

    it('should use nodeId as tie breaker', () => {
        const lww = new LWWRegister<string>();
        const state = { value: 'A', timestamp: 100, nodeId: 'A' };

        // 'B' > 'A' so 'B' wins same timestamp
        const merged = lww.applyDelta(state, { value: 'B', timestamp: 100, nodeId: 'B' });
        expect(merged.value).toBe('B');
    });
});

describe('ORSet', () => {
    it('should add elements', () => {
        const set = new ORSet();
        const state = { elements: {}, tombstones: new Set<string>() };

        const delta = set.createDelta({ type: 'add', element: 'apple', tag: 'tag1' }, state);
        const merged = set.applyDelta(state, delta);

        expect(merged.elements['apple']).toContain('tag1');
        expect(set.computeValue(merged)).toContain('apple');
    });

    it('should remove elements', () => {
        const set = new ORSet();
        const state = { elements: { 'apple': ['tag1'] }, tombstones: new Set<string>() };

        // Remove 'apple'
        const delta = set.createDelta({ type: 'remove', element: 'apple', tag: '' }, state);
        const merged = set.applyDelta(state, delta);

        expect(merged.elements['apple']).toBeUndefined();
        expect(merged.tombstones.has('tag1')).toBe(true);
        expect(set.computeValue(merged)).not.toContain('apple');
    });
});
