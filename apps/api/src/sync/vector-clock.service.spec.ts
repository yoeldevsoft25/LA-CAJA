import { VectorClockService, CausalRelation } from './vector-clock.service';

describe('VectorClockService', () => {
  let service: VectorClockService;

  beforeEach(() => {
    service = new VectorClockService();
  });

  describe('createEmpty', () => {
    it('should create an empty vector clock', () => {
      const clock = service.createEmpty();
      expect(clock).toEqual({});
    });
  });

  describe('increment', () => {
    it('should increment a device counter', () => {
      let clock = service.createEmpty();
      clock = service.increment(clock, 'device-a');
      expect(clock).toEqual({ 'device-a': 1 });

      clock = service.increment(clock, 'device-a');
      expect(clock).toEqual({ 'device-a': 2 });
    });

    it('should set a specific value', () => {
      let clock = service.createEmpty();
      clock = service.increment(clock, 'device-a', 42);
      expect(clock).toEqual({ 'device-a': 42 });
    });
  });

  describe('compare', () => {
    it('should detect EQUAL clocks', () => {
      const clockA = { 'device-a': 5, 'device-b': 3 };
      const clockB = { 'device-a': 5, 'device-b': 3 };

      expect(service.compare(clockA, clockB)).toBe(CausalRelation.EQUAL);
    });

    it('should detect AFTER relation (A happened-after B)', () => {
      const clockA = { 'device-a': 5, 'device-b': 3 };
      const clockB = { 'device-a': 4, 'device-b': 3 };

      expect(service.compare(clockA, clockB)).toBe(CausalRelation.AFTER);
    });

    it('should detect BEFORE relation (A happened-before B)', () => {
      const clockA = { 'device-a': 4, 'device-b': 3 };
      const clockB = { 'device-a': 5, 'device-b': 3 };

      expect(service.compare(clockA, clockB)).toBe(CausalRelation.BEFORE);
    });

    it('should detect CONCURRENT relation (split-brain)', () => {
      const clockA = { 'device-a': 5, 'device-b': 3 };
      const clockB = { 'device-a': 4, 'device-b': 7 };

      expect(service.compare(clockA, clockB)).toBe(CausalRelation.CONCURRENT);
    });
  });

  describe('merge', () => {
    it('should merge two vector clocks taking max', () => {
      const clockA = { 'device-a': 5, 'device-b': 3 };
      const clockB = { 'device-a': 4, 'device-b': 7, 'device-c': 2 };

      const merged = service.merge(clockA, clockB);

      expect(merged).toEqual({
        'device-a': 5, // max(5, 4)
        'device-b': 7, // max(3, 7)
        'device-c': 2, // max(0, 2)
      });
    });
  });

  describe('happenedBefore', () => {
    it('should return true when A happened-before B', () => {
      const clockA = { 'device-a': 4, 'device-b': 3 };
      const clockB = { 'device-a': 5, 'device-b': 3 };

      expect(service.happenedBefore(clockA, clockB)).toBe(true);
    });

    it('should return false when A did not happen-before B', () => {
      const clockA = { 'device-a': 5, 'device-b': 3 };
      const clockB = { 'device-a': 4, 'device-b': 3 };

      expect(service.happenedBefore(clockA, clockB)).toBe(false);
    });
  });

  describe('areConcurrent', () => {
    it('should return true for concurrent events', () => {
      const clockA = { 'device-a': 5, 'device-b': 3 };
      const clockB = { 'device-a': 4, 'device-b': 7 };

      expect(service.areConcurrent(clockA, clockB)).toBe(true);
    });

    it('should return false for non-concurrent events', () => {
      const clockA = { 'device-a': 5, 'device-b': 3 };
      const clockB = { 'device-a': 4, 'device-b': 3 };

      expect(service.areConcurrent(clockA, clockB)).toBe(false);
    });
  });

  describe('distance', () => {
    it('should calculate distance between clocks', () => {
      const clockA = { 'device-a': 5, 'device-b': 3 };
      const clockB = { 'device-a': 8, 'device-b': 1, 'device-c': 2 };

      const distance = service.distance(clockA, clockB);

      // |5-8| + |3-1| + |0-2| = 3 + 2 + 2 = 7
      expect(distance).toBe(7);
    });
  });

  describe('serialize/deserialize', () => {
    it('should serialize and deserialize correctly', () => {
      const clock = { 'device-b': 3, 'device-a': 5 };

      const serialized = service.serialize(clock);
      expect(serialized).toBe('device-a:5,device-b:3'); // Ordenado alfabéticamente

      const deserialized = service.deserialize(serialized);
      expect(deserialized).toEqual(clock);
    });

    it('should handle empty string', () => {
      const deserialized = service.deserialize('');
      expect(deserialized).toEqual({});
    });
  });

  describe('isValid', () => {
    it('should validate correct vector clocks', () => {
      expect(service.isValid({ 'device-a': 5, 'device-b': 3 })).toBe(true);
      expect(service.isValid({})).toBe(true);
    });

    it('should reject invalid vector clocks', () => {
      expect(service.isValid({ 'device-a': -5 })).toBe(false); // Negative
      expect(service.isValid({ 'device-a': 5.5 })).toBe(false); // Float
      expect(service.isValid({ '': 5 })).toBe(false); // Empty key
    });
  });

  describe('fromEvent', () => {
    it('should create vector clock from event', () => {
      const clock = service.fromEvent('device-a', 42);
      expect(clock).toEqual({ 'device-a': 42 });
    });
  });
});
