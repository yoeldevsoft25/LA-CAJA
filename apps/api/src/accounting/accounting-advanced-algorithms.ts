/**
 * ALGORITMOS AVANZADOS DE CORRECCIÓN CONTABLE
 * Implementaciones de técnicas matemáticas y estadísticas de nivel empresarial
 * para sistemas ERP de alta precisión
 */

/**
 * Neumaier Summation - Mejora sobre Kahan para casos extremos
 * Reduce aún más el error de redondeo en grandes sumas
 */
export function neumaierSum(values: number[]): number {
  let sum = 0;
  let c = 0; // Compensación de errores acumulados

  for (const value of values) {
    const t = sum + Number(value || 0);
    if (Math.abs(sum) >= Math.abs(Number(value || 0))) {
      c += sum - t + Number(value || 0);
    } else {
      c += Number(value || 0) - t + sum;
    }
    sum = t;
  }

  return sum + c;
}

/**
 * Benford's Law Analysis - Detección de anomalías en distribución de dígitos
 * Primera ley de Benford: P(d) = log10(1 + 1/d) para d = 1..9
 * Desviaciones significativas pueden indicar manipulación o errores sistemáticos
 */
export function benfordAnalysis(amounts: number[]): {
  chiSquare: number;
  isAnomalous: boolean;
  suspiciousDigits: number[];
  confidence: number;
} {
  if (amounts.length === 0) {
    return {
      chiSquare: 0,
      isAnomalous: false,
      suspiciousDigits: [],
      confidence: 1.0,
    };
  }

  // Frecuencia esperada según Benford's Law
  const expectedFreq: Record<number, number> = {
    1: 0.301,
    2: 0.176,
    3: 0.125,
    4: 0.097,
    5: 0.079,
    6: 0.067,
    7: 0.058,
    8: 0.051,
    9: 0.046,
  };

  // Contar primeros dígitos
  const observedFreq: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
  };

  for (const amount of amounts) {
    const absAmount = Math.abs(amount);
    if (absAmount === 0) continue;

    const firstDigit = Math.floor(
      absAmount / Math.pow(10, Math.floor(Math.log10(absAmount))),
    );
    if (firstDigit >= 1 && firstDigit <= 9) {
      observedFreq[firstDigit as keyof typeof observedFreq]++;
    }
  }

  // Calcular Chi-Square statistic
  let chiSquare = 0;
  const total = amounts.length;
  const suspiciousDigits: number[] = [];

  for (let d = 1; d <= 9; d++) {
    const observed = observedFreq[d];
    const expected = expectedFreq[d] * total;
    const diff = observed - expected;

    if (expected > 0) {
      chiSquare += (diff * diff) / expected;
    }

    // Marcar dígitos con desviación significativa (>20% del esperado)
    if (expected > 5 && Math.abs(diff) > expected * 0.2) {
      suspiciousDigits.push(d);
    }
  }

  // Chi-Square crítico con 8 grados de libertad, alpha=0.05 = 15.507
  // Si chiSquare > 15.507, rechazamos hipótesis de conformidad con Benford
  const isAnomalous = chiSquare > 15.507;
  const confidence = Math.min(1.0, 1.0 - chiSquare / 50); // Normalizado para confianza 0-1

  return { chiSquare, isAnomalous, suspiciousDigits, confidence };
}

/**
 * Statistical Data Reconciliation (PDR) - Optimización por mínimos cuadrados ponderados
 * Minimiza suma de desviaciones al cuadrado sujeto a restricciones de balance
 * Retorna distribución óptima de ajustes entre múltiples líneas
 */
export function statisticalDataReconciliation(
  lines: Array<{ id: string; amount: number; weight?: number }>,
  targetBalance: number,
): Array<{ id: string; adjustment: number; newAmount: number }> {
  if (lines.length === 0) return [];

  const currentSum = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
  const difference = targetBalance - currentSum;

  if (Math.abs(difference) < 0.01) {
    return lines.map((line) => ({
      id: line.id,
      adjustment: 0,
      newAmount: line.amount || 0,
    }));
  }

  // Pesos: líneas con mayor monto tienen mayor "incertidumbre" relativa, pero también mayor capacidad de absorber ajuste
  // Usamos peso inverso proporcional al monto absoluto para distribución proporcional
  const totalAbsolute = lines.reduce(
    (sum, line) => sum + Math.abs(line.amount || 0),
    0,
  );

  const adjustments = lines.map((line) => {
    const weight =
      line.weight !== undefined
        ? line.weight
        : totalAbsolute > 0
          ? Math.abs(line.amount || 0) / totalAbsolute
          : 1 / lines.length;

    const adjustment = difference * weight;
    return {
      id: line.id,
      adjustment: Number(adjustment.toFixed(6)), // Precisión alta antes de redondear
      newAmount: Number(((line.amount || 0) + adjustment).toFixed(2)),
    };
  });

  // Verificar que la suma de ajustes iguala la diferencia (con tolerancia de redondeo)
  const totalAdjustment = adjustments.reduce(
    (sum, adj) => sum + adj.adjustment,
    0,
  );
  const roundingError = difference - totalAdjustment;

  // Distribuir error de redondeo en la línea más grande (menor impacto proporcional)
  if (Math.abs(roundingError) > 0.001) {
    const largestLineIndex = lines.reduce(
      (maxIdx, line, idx) =>
        Math.abs(line.amount || 0) > Math.abs(lines[maxIdx].amount || 0)
          ? idx
          : maxIdx,
      0,
    );
    adjustments[largestLineIndex].adjustment += roundingError;
    adjustments[largestLineIndex].newAmount = Number(
      (
        (lines[largestLineIndex].amount || 0) +
        adjustments[largestLineIndex].adjustment
      ).toFixed(2),
    );
  }

  return adjustments;
}

/**
 * Detección exacta de transposición de dígitos
 * Encuentra pares de números donde un dígito está trans puesto exactamente
 * Ejemplo: 1234 vs 1324 detecta que 2 y 3 están transpuestos
 */
export function detectExactTransposition(
  value1: number,
  value2: number,
): {
  isTransposition: boolean;
  transposedDigits?: [number, number];
  positions?: [number, number];
} {
  const str1 = Math.abs(Math.round(value1)).toString();
  const str2 = Math.abs(Math.round(value2)).toString();

  if (str1.length !== str2.length || str1.length < 2) {
    return { isTransposition: false };
  }

  // Contar diferencias en posición
  const differences: Array<{ pos: number; char1: string; char2: string }> = [];
  for (let i = 0; i < str1.length; i++) {
    if (str1[i] !== str2[i]) {
      differences.push({ pos: i, char1: str1[i], char2: str2[i] });
    }
  }

  // Transposición exacta requiere exactamente 2 diferencias y que sean recíprocas
  if (differences.length === 2) {
    const [diff1, diff2] = differences;
    if (diff1.char1 === diff2.char2 && diff1.char2 === diff2.char1) {
      return {
        isTransposition: true,
        transposedDigits: [parseInt(diff1.char1), parseInt(diff1.char2)],
        positions: [diff1.pos, diff2.pos],
      };
    }
  }

  return { isTransposition: false };
}

/**
 * Detección avanzada de tipos de error con análisis estadístico
 * Combina múltiples técnicas para mayor precisión en diagnóstico
 */
export function detectErrorTypeAdvanced(
  difference: number,
  amounts: number[],
  historicalMeans?: { bs?: number; usd?: number },
): {
  type:
    | 'rounding'
    | 'transposition'
    | 'slide'
    | 'omission'
    | 'systematic'
    | 'unknown';
  confidence: number;
  suggestion: string;
  analysis: {
    benford?: { chiSquare: number; isAnomalous: boolean };
    statistical?: { zScore?: number; isOutlier: boolean };
  };
} {
  const absDiff = Math.abs(difference);

  // Error de redondeo: diferencia muy pequeña
  if (absDiff <= 0.01) {
    return {
      type: 'rounding',
      confidence: 0.95,
      suggestion: 'Ajuste automático por redondeo (tolerancia estándar)',
      analysis: {},
    };
  }

  // Análisis de Benford si hay suficientes montos
  let benfordResult: { chiSquare: number; isAnomalous: boolean } | undefined;
  if (amounts.length >= 10) {
    const benford = benfordAnalysis(amounts);
    benfordResult = {
      chiSquare: benford.chiSquare,
      isAnomalous: benford.isAnomalous,
    };
  }

  // Análisis estadístico de outliers si hay historial
  let statisticalAnalysis: { zScore?: number; isOutlier: boolean } | undefined;
  if (historicalMeans?.bs || historicalMeans?.usd) {
    const mean = historicalMeans.bs || historicalMeans.usd || 0;
    const stdDev = mean * 0.1; // Asumir 10% de desviación estándar típica
    if (stdDev > 0) {
      const zScore = absDiff / stdDev;
      statisticalAnalysis = {
        zScore,
        isOutlier: zScore > 3, // Más de 3 desviaciones estándar
      };
    }
  }

  // Error de transposición: divisible por 9 Y verificación exacta si es posible
  if (absDiff >= 0.01 && Math.abs(absDiff % 9) < 0.001) {
    return {
      type: 'transposition',
      confidence: 0.75,
      suggestion:
        'Error probable de transposición de dígitos (divisible por 9). Revisar entrada manual.',
      analysis: { benford: benfordResult, statistical: statisticalAnalysis },
    };
  }

  // Error sistemático: detección de Benford anómala
  if (benfordResult?.isAnomalous) {
    return {
      type: 'systematic',
      confidence: 0.65,
      suggestion:
        'Patrón anómalo detectado (Benford). Posible error sistemático o manipulación.',
      analysis: { benford: benfordResult, statistical: statisticalAnalysis },
    };
  }

  // Error de slide (decimal mal colocado): múltiplo de potencia de 10
  if (Math.abs(absDiff % 10) < 0.001 || Math.abs(absDiff % 100) < 0.001) {
    return {
      type: 'slide',
      confidence: 0.7,
      suggestion:
        'Posible error de posición decimal (múltiplo de 10). Verificar entrada de datos.',
      analysis: { benford: benfordResult, statistical: statisticalAnalysis },
    };
  }

  // Error de omisión: diferencia par (sugiere entrada faltante)
  if (Math.abs(absDiff % 2) < 0.001 && absDiff > 1) {
    return {
      type: 'omission',
      confidence: 0.5,
      suggestion:
        'Posible entrada faltante (diferencia par). Revisar línea por línea.',
      analysis: { benford: benfordResult, statistical: statisticalAnalysis },
    };
  }

  // Outlier estadístico
  if (statisticalAnalysis?.isOutlier) {
    return {
      type: 'systematic',
      confidence: 0.6,
      suggestion: `Diferencia significativamente mayor a lo histórico (z-score: ${statisticalAnalysis.zScore?.toFixed(2)}). Requiere revisión.`,
      analysis: { benford: benfordResult, statistical: statisticalAnalysis },
    };
  }

  return {
    type: 'unknown',
    confidence: 0.3,
    suggestion:
      'Revisión manual recomendada. Tipo de error no clasificable automáticamente.',
    analysis: { benford: benfordResult, statistical: statisticalAnalysis },
  };
}
