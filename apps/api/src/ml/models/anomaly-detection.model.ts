import { Injectable } from '@nestjs/common';

/**
 * Modelo avanzado de detección de anomalías
 * Implementa Isolation Forest simplificado, LOF (Local Outlier Factor), y métodos estadísticos
 */
@Injectable()
export class AnomalyDetectionModel {
  /**
   * Isolation Forest simplificado
   * Detecta anomalías basándose en qué tan fácil es aislar un punto
   */
  isolationForest(
    data: number[],
    contamination: number = 0.1, // Proporción esperada de anomalías
    nTrees: number = 100,
  ): Array<{ index: number; score: number; isAnomaly: boolean }> {
    if (data.length === 0) return [];

    const anomalies: Array<{
      index: number;
      score: number;
      isAnomaly: boolean;
    }> = [];
    const min = Math.min(...data);
    const max = Math.max(...data);

    if (max === min) {
      // Todos los valores son iguales, no hay anomalías
      return data.map((_, i) => ({ index: i, score: 0, isAnomaly: false }));
    }

    // Calcular path length promedio para cada punto
    const scores: number[] = [];
    for (let i = 0; i < data.length; i++) {
      let totalPathLength = 0;
      for (let tree = 0; tree < nTrees; tree++) {
        totalPathLength += this.isolatePoint(data[i], data, min, max, 0);
      }
      const avgPathLength = totalPathLength / nTrees;
      const score = Math.pow(
        2,
        -avgPathLength / this.calculateAveragePathLength(data.length),
      );
      scores.push(score);
    }

    // Normalizar scores
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const normalizedScores = scores.map(
      (s) =>
        (maxScore > minScore ? (s - minScore) / (maxScore - minScore) : 0) *
        100,
    );

    // Determinar umbral basado en contaminación
    const sortedScores = [...normalizedScores].sort((a, b) => b - a);
    const thresholdIndex = Math.floor(data.length * contamination);
    const threshold =
      thresholdIndex > 0 ? sortedScores[thresholdIndex] : sortedScores[0];

    // Marcar anomalías
    for (let i = 0; i < data.length; i++) {
      anomalies.push({
        index: i,
        score: normalizedScores[i],
        isAnomaly: normalizedScores[i] > threshold,
      });
    }

    return anomalies;
  }

  /**
   * Local Outlier Factor (LOF) simplificado
   * Detecta anomalías basándose en densidad local
   */
  localOutlierFactor(
    data: number[],
    k: number = 5, // Número de vecinos
  ): Array<{ index: number; score: number; isAnomaly: boolean }> {
    if (data.length < k + 1) {
      return data.map((_, i) => ({ index: i, score: 0, isAnomaly: false }));
    }

    const scores: number[] = [];

    for (let i = 0; i < data.length; i++) {
      // Encontrar k vecinos más cercanos
      const distances = data.map((val, j) => ({
        index: j,
        distance: Math.abs(val - data[i]),
      }));
      distances.sort((a, b) => a.distance - b.distance);
      const kNeighbors = distances.slice(1, k + 1); // Excluir el punto mismo

      // Calcular reachability distance
      const kDistance = kNeighbors[kNeighbors.length - 1].distance;
      const reachabilityDistances = kNeighbors.map((n) =>
        Math.max(kDistance, Math.abs(data[n.index] - data[i])),
      );

      // Calcular local reachability density
      const lrd = k / reachabilityDistances.reduce((a, b) => a + b, 0);

      // Calcular LOF
      const neighborLRDs: number[] = [];
      for (const neighbor of kNeighbors) {
        const neighborDistances = data.map((val, j) => ({
          index: j,
          distance: Math.abs(val - data[neighbor.index]),
        }));
        neighborDistances.sort((a, b) => a.distance - b.distance);
        const neighborKNeighbors = neighborDistances.slice(1, k + 1);
        const neighborKDistance =
          neighborKNeighbors[neighborKNeighbors.length - 1].distance;
        const neighborReachabilityDistances = neighborKNeighbors.map((n) =>
          Math.max(
            neighborKDistance,
            Math.abs(data[n.index] - data[neighbor.index]),
          ),
        );
        const neighborLRD =
          k / neighborReachabilityDistances.reduce((a, b) => a + b, 0);
        neighborLRDs.push(neighborLRD);
      }

      const avgNeighborLRD =
        neighborLRDs.reduce((a, b) => a + b, 0) / neighborLRDs.length;
      const lof = avgNeighborLRD > 0 ? lrd / avgNeighborLRD : 1;

      scores.push(lof);
    }

    // Normalizar y determinar anomalías
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const normalizedScores = scores.map((s) =>
      maxScore > minScore ? ((s - minScore) / (maxScore - minScore)) * 100 : 50,
    );

    // LOF > 1 indica anomalía
    const threshold = 70; // Ajustado para scores normalizados

    return data.map((_, i) => ({
      index: i,
      score: normalizedScores[i],
      isAnomaly: normalizedScores[i] > threshold,
    }));
  }

  /**
   * Detección estadística avanzada (Z-score + IQR)
   */
  statisticalDetection(
    data: number[],
    method: 'zscore' | 'iqr' | 'both' = 'both',
  ): Array<{
    index: number;
    score: number;
    isAnomaly: boolean;
    method: string;
  }> {
    if (data.length === 0) return [];

    const results: Array<{
      index: number;
      score: number;
      isAnomaly: boolean;
      method: string;
    }> = [];

    // Z-score
    if (method === 'zscore' || method === 'both') {
      const mean = data.reduce((a, b) => a + b, 0) / data.length;
      const variance =
        data.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
        data.length;
      const stdDev = Math.sqrt(variance);

      if (stdDev > 0) {
        for (let i = 0; i < data.length; i++) {
          const zScore = Math.abs((data[i] - mean) / stdDev);
          const score = Math.min(100, zScore * 20);
          results.push({
            index: i,
            score,
            isAnomaly: zScore > 2.5,
            method: 'zscore',
          });
        }
      }
    }

    // IQR (Interquartile Range)
    if (method === 'iqr' || method === 'both') {
      const sorted = [...data].sort((a, b) => a - b);
      const q1Index = Math.floor(sorted.length * 0.25);
      const q3Index = Math.floor(sorted.length * 0.75);
      const q1 = sorted[q1Index];
      const q3 = sorted[q3Index];
      const iqr = q3 - q1;
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;

      for (let i = 0; i < data.length; i++) {
        const isOutlier = data[i] < lowerBound || data[i] > upperBound;
        const distance = isOutlier
          ? Math.min(
              Math.abs(data[i] - lowerBound),
              Math.abs(data[i] - upperBound),
            )
          : 0;
        const score = Math.min(100, (distance / (iqr || 1)) * 50);
        results.push({
          index: i,
          score,
          isAnomaly: isOutlier,
          method: 'iqr',
        });
      }
    }

    return results;
  }

  // ========== Métodos auxiliares ==========

  private isolatePoint(
    value: number,
    data: number[],
    min: number,
    max: number,
    depth: number,
    maxDepth: number = 10,
  ): number {
    if (depth >= maxDepth || max === min) {
      return depth;
    }

    const split = min + Math.random() * (max - min);
    if (value < split) {
      const newMax = Math.min(split, max);
      return this.isolatePoint(value, data, min, newMax, depth + 1, maxDepth);
    } else {
      const newMin = Math.max(split, min);
      return this.isolatePoint(value, data, newMin, max, depth + 1, maxDepth);
    }
  }

  private calculateAveragePathLength(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  }
}
