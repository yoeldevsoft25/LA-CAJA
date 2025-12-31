/**
 * A/B Testing Service
 * Sistema simple de A/B testing client-side
 */

import { analyticsService } from './analytics.service'

export interface ABTestVariant {
  id: string
  name: string
  weight: number // 0-100
  config: Record<string, unknown>
}

export interface ABTest {
  id: string
  name: string
  variants: ABTestVariant[]
  enabled: boolean
}

class ABTestingService {
  private tests: Map<string, ABTest> = new Map()
  private userVariants: Map<string, string> = new Map()
  private storageKey = 'ab_test_variants'

  constructor() {
    this.loadFromStorage()
    this.initializeTests()
  }

  /**
   * Define los tests A/B disponibles
   */
  private initializeTests() {
    // Test: CTA Button Text
    this.registerTest({
      id: 'cta_button_text',
      name: 'CTA Button Text Test',
      enabled: true,
      variants: [
        {
          id: 'control',
          name: 'Control - Empezar Gratis Ahora',
          weight: 50,
          config: { text: 'Empezar Gratis Ahora' },
        },
        {
          id: 'variant_a',
          name: 'Variant A - Comenzar Ahora',
          weight: 50,
          config: { text: 'Comenzar Ahora' },
        },
      ],
    })

    // Test: Pricing Toggle Default
    this.registerTest({
      id: 'pricing_default',
      name: 'Pricing Default Selection',
      enabled: true,
      variants: [
        {
          id: 'control',
          name: 'Control - Monthly',
          weight: 50,
          config: { defaultCycle: 'monthly' },
        },
        {
          id: 'variant_a',
          name: 'Variant A - Annual',
          weight: 50,
          config: { defaultCycle: 'annual' },
        },
      ],
    })

    // Test: Hero Subheadline
    this.registerTest({
      id: 'hero_subheadline',
      name: 'Hero Subheadline Test',
      enabled: true,
      variants: [
        {
          id: 'control',
          name: 'Control - Features list',
          weight: 50,
          config: {
            type: 'features',
            text: '85% cumplimiento SENIAT • Offline-first real • IA integrada • Multi-plataforma',
          },
        },
        {
          id: 'variant_a',
          name: 'Variant A - Benefit focused',
          weight: 50,
          config: {
            type: 'benefit',
            text: 'Aumenta tus ventas 15%, ahorra 20 horas/mes en contabilidad. 500+ negocios confían en nosotros.',
          },
        },
      ],
    })
  }

  /**
   * Registra un test A/B
   */
  private registerTest(test: ABTest) {
    // Validar que los pesos sumen 100
    const totalWeight = test.variants.reduce((sum, v) => sum + v.weight, 0)
    if (Math.abs(totalWeight - 100) > 0.01) {
      console.error(`[ABTesting] Test "${test.id}" pesos no suman 100: ${totalWeight}`)
      return
    }

    this.tests.set(test.id, test)
  }

  /**
   * Obtiene la variante asignada para un test
   */
  getVariant(testId: string): ABTestVariant | null {
    const test = this.tests.get(testId)
    if (!test || !test.enabled) return null

    // Si ya tiene una variante asignada, devolverla
    const assignedVariantId = this.userVariants.get(testId)
    if (assignedVariantId) {
      const variant = test.variants.find((v) => v.id === assignedVariantId)
      if (variant) return variant
    }

    // Asignar nueva variante aleatoria basada en pesos
    const variant = this.assignVariant(test)
    this.userVariants.set(testId, variant.id)
    this.saveToStorage()

    // Track assignment
    analyticsService.trackEvent({
      category: 'AB Test',
      action: 'Variant Assigned',
      label: `${testId}:${variant.id}`,
    })

    return variant
  }

  /**
   * Asigna una variante basada en los pesos
   */
  private assignVariant(test: ABTest): ABTestVariant {
    const random = Math.random() * 100
    let cumulative = 0

    for (const variant of test.variants) {
      cumulative += variant.weight
      if (random <= cumulative) {
        return variant
      }
    }

    // Fallback al control
    return test.variants[0]
  }

  /**
   * Trackea una conversión para un test
   */
  trackConversion(testId: string, value?: number) {
    const variantId = this.userVariants.get(testId)
    if (!variantId) return

    analyticsService.trackEvent({
      category: 'AB Test',
      action: 'Conversion',
      label: `${testId}:${variantId}`,
      value,
    })
  }

  /**
   * Carga variantes del localStorage
   */
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        this.userVariants = new Map(Object.entries(data))
      }
    } catch (error) {
      console.error('[ABTesting] Error loading from storage:', error)
    }
  }

  /**
   * Guarda variantes en localStorage
   */
  private saveToStorage() {
    try {
      const data = Object.fromEntries(this.userVariants)
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    } catch (error) {
      console.error('[ABTesting] Error saving to storage:', error)
    }
  }

  /**
   * Reinicia las asignaciones de variantes (útil para testing)
   */
  reset() {
    this.userVariants.clear()
    localStorage.removeItem(this.storageKey)
  }

  /**
   * Obtiene todos los tests activos
   */
  getActiveTests(): ABTest[] {
    return Array.from(this.tests.values()).filter((t) => t.enabled)
  }
}

// Singleton
export const abTestingService = new ABTestingService()
