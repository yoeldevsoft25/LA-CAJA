import { CRDTService } from './crdt.service';
import { VectorClockService } from './vector-clock.service';

describe('CRDTService', () => {
  let service: CRDTService;
  let vcService: VectorClockService;

  beforeEach(() => {
    vcService = new VectorClockService();
    service = new CRDTService(vcService);
  });

  describe('LWW Register', () => {
    it('should merge LWW registers by timestamp', () => {
      const registerA = service.createLWW(
        'Coca Cola 1L',
        1704067200000,
        'device-a',
        { 'device-a': 5 },
      );

      const registerB = service.createLWW(
        'Coca-Cola 1000ml',
        1704067500000, // Posterior
        'device-b',
        { 'device-b': 3 },
      );

      const winner = service.mergeLWW(registerA, registerB);

      expect(winner.value).toBe('Coca-Cola 1000ml');
      expect(winner.device_id).toBe('device-b');
    });

    it('should use device_id as tie-breaker for equal timestamps', () => {
      const registerA = service.createLWW(
        'Value A',
        1704067200000,
        'device-a',
        { 'device-a': 5 },
      );

      const registerB = service.createLWW(
        'Value B',
        1704067200000, // Mismo timestamp
        'device-b',
        { 'device-b': 3 },
      );

      const winner = service.mergeLWW(registerA, registerB);

      // device-b > device-a lexicográficamente
      expect(winner.value).toBe('Value B');
    });

    it('should resolve multiple LWW registers', () => {
      const registers = [
        service.createLWW('v1', 100, 'device-a', {}),
        service.createLWW('v2', 200, 'device-b', {}),
        service.createLWW('v3', 150, 'device-c', {}),
      ];

      const winner = service.resolveLWW(registers);

      expect(winner.value).toBe('v2'); // Timestamp más alto
    });
  });

  describe('Add-Wins Set (AWSet)', () => {
    it('should add elements to AWSet', () => {
      let awset = service.createAWSet<string>();

      awset = service.addToAWSet(awset, 'id-1', 'Item 1', 1000, 'device-a');
      awset = service.addToAWSet(awset, 'id-2', 'Item 2', 2000, 'device-a');

      const values = service.getAWSetValues(awset);

      expect(values).toEqual(['Item 1', 'Item 2']);
    });

    it('should remove elements from AWSet', () => {
      let awset = service.createAWSet<string>();

      awset = service.addToAWSet(awset, 'id-1', 'Item 1', 1000, 'device-a');
      awset = service.removeFromAWSet(awset, 'id-1');

      const values = service.getAWSetValues(awset);

      expect(values).toEqual([]);
    });

    it('should merge AWSets with add-wins semantics', () => {
      let awsetA = service.createAWSet<string>();
      awsetA = service.addToAWSet(awsetA, 'id-1', 'Item 1', 1000, 'device-a');

      let awsetB = service.createAWSet<string>();
      awsetB = service.addToAWSet(awsetB, 'id-1', 'Item 1', 2000, 'device-b');
      awsetB = service.addToAWSet(awsetB, 'id-2', 'Item 2', 2000, 'device-b');

      const merged = service.mergeAWSet(awsetA, awsetB);
      const values = service.getAWSetValues(merged);

      expect(values).toHaveLength(2);
      expect(values).toContain('Item 1');
      expect(values).toContain('Item 2');
    });
  });

  describe('Multi-Value Register (MVR)', () => {
    it('should create and add values to MVR', () => {
      let mvr = service.createMVR<number>();

      mvr = service.addToMVR(mvr, 5.0, 1000, 'device-a', { 'device-a': 5 });
      mvr = service.addToMVR(mvr, 5.5, 2000, 'device-b', { 'device-b': 3 });

      const values = service.getMVRValues(mvr);

      expect(values).toHaveLength(2);
      expect(values).toContain(5.0);
      expect(values).toContain(5.5);
    });

    it('should detect conflicts in MVR', () => {
      let mvr = service.createMVR<number>();

      mvr = service.addToMVR(mvr, 5.0, 1000, 'device-a', { 'device-a': 5 });
      mvr = service.addToMVR(mvr, 5.5, 2000, 'device-b', { 'device-b': 3 });

      expect(service.hasMVRConflict(mvr)).toBe(true);
    });

    it('should merge MVRs eliminating causally preceded values', () => {
      const mvrA = service.createMVR<number>();
      const mvrB = service.createMVR<number>();

      // mvrA tiene valor con vector clock {device-a: 5}
      const mvrA1 = service.addToMVR(mvrA, 5.0, 1000, 'device-a', {
        'device-a': 5,
      });

      // mvrB tiene valor con vector clock {device-a: 10} (posterior)
      const mvrB1 = service.addToMVR(mvrB, 5.5, 2000, 'device-a', {
        'device-a': 10,
      });

      const merged = service.mergeMVR(mvrA1, mvrB1);
      const values = service.getMVRValues(merged);

      // Solo queda el valor posterior
      expect(values).toHaveLength(1);
      expect(values).toContain(5.5);
    });
  });

  describe('G-Counter', () => {
    it('should increment G-Counter', () => {
      let counter = service.createGCounter();

      counter = service.incrementGCounter(counter, 'device-a', 5);
      counter = service.incrementGCounter(counter, 'device-a', 3);
      counter = service.incrementGCounter(counter, 'device-b', 10);

      expect(service.getGCounterValue(counter)).toBe(18); // 5 + 3 + 10
    });

    it('should merge G-Counters taking max', () => {
      let counterA = service.createGCounter();
      counterA = service.incrementGCounter(counterA, 'device-a', 5);
      counterA = service.incrementGCounter(counterA, 'device-b', 3);

      let counterB = service.createGCounter();
      counterB = service.incrementGCounter(counterB, 'device-a', 3);
      counterB = service.incrementGCounter(counterB, 'device-b', 7);

      const merged = service.mergeGCounter(counterA, counterB);

      // device-a: max(5, 3) = 5
      // device-b: max(3, 7) = 7
      expect(service.getGCounterValue(merged)).toBe(12);
    });
  });

  describe('recommendStrategy', () => {
    it('should recommend LWW for simple product fields', () => {
      expect(service.recommendStrategy('product', 'name')).toBe('lww');
      expect(service.recommendStrategy('product', 'active')).toBe('lww');
    });

    it('should recommend MVR for critical fields', () => {
      expect(service.recommendStrategy('product', 'price_bs')).toBe('mvr');
      expect(service.recommendStrategy('product', 'price_usd')).toBe('mvr');
    });

    it('should recommend AWSet for collections', () => {
      expect(service.recommendStrategy('inventory_movement', 'quantity')).toBe(
        'awset',
      );
    });

    it('should default to LWW for unknown fields', () => {
      expect(service.recommendStrategy('unknown', 'field')).toBe('lww');
    });
  });
});
