/**
 * Test de ejemplo para verificar que Vitest funciona correctamente
 * Este archivo puede eliminarse cuando tengas tests reales
 */

import { describe, it, expect } from 'vitest';

describe('Vitest Setup', () => {
  it('should run tests correctly', () => {
    expect(true).toBe(true);
  });

  it('should have access to global test functions', () => {
    const result = 2 + 2;
    expect(result).toBe(4);
  });
});
