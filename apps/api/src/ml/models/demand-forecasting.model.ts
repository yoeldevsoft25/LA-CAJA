import { Injectable } from '@nestjs/common';

/**
 * Modelo avanzado de forecasting de demanda
 * Implementa múltiples algoritmos: Exponential Smoothing, ARIMA simplificado, Ensemble
 */
@Injectable()
export class DemandForecastingModel {
  /**
   * Exponential Smoothing (Holt-Winters simplificado)
   * Mejor para datos con tendencia y estacionalidad
   */
  exponentialSmoothing(
    data: number[],
    alpha: number = 0.3,
    beta: number = 0.1,
    gamma: number = 0.1,
    seasonLength: number = 7,
  ): { forecast: number; level: number; trend: number; seasonal: number } {
    if (data.length === 0) {
      return { forecast: 0, level: 0, trend: 0, seasonal: 0 };
    }

    if (data.length < seasonLength * 2) {
      // Si no hay suficientes datos para estacionalidad, usar Holt (sin estacionalidad)
      return this.holtSmoothing(data, alpha, beta);
    }

    // Inicializar componentes
    let level = data[0];
    let trend = 0;
    const seasonal: number[] = new Array(seasonLength).fill(0);

    // Inicializar estacionalidad con promedio de primeros ciclos
    for (let i = 0; i < seasonLength && i < data.length; i++) {
      seasonal[i] =
        data[i] /
        (data.slice(0, seasonLength).reduce((a, b) => a + b, 0) / seasonLength);
    }

    // Aplicar Holt-Winters
    for (let i = 1; i < data.length; i++) {
      const prevLevel = level;
      const prevTrend = trend;
      const prevSeasonal = seasonal[i % seasonLength];

      // Actualizar nivel
      level =
        alpha * (data[i] / prevSeasonal) +
        (1 - alpha) * (prevLevel + prevTrend);

      // Actualizar tendencia
      trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;

      // Actualizar estacionalidad
      seasonal[i % seasonLength] =
        gamma * (data[i] / level) + (1 - gamma) * prevSeasonal;
    }

    // Pronóstico
    const forecast = (level + trend) * seasonal[data.length % seasonLength];

    return {
      forecast,
      level,
      trend,
      seasonal: seasonal[data.length % seasonLength],
    };
  }

  /**
   * Holt's Linear Exponential Smoothing (sin estacionalidad)
   */
  private holtSmoothing(
    data: number[],
    alpha: number = 0.3,
    beta: number = 0.1,
  ): { forecast: number; level: number; trend: number; seasonal: number } {
    if (data.length === 0) {
      return { forecast: 0, level: 0, trend: 0, seasonal: 0 };
    }

    let level = data[0];
    let trend = data.length > 1 ? data[1] - data[0] : 0;

    for (let i = 1; i < data.length; i++) {
      const prevLevel = level;
      level = alpha * data[i] + (1 - alpha) * (level + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
    }

    const forecast = level + trend;
    return { forecast, level, trend, seasonal: 0 };
  }

  /**
   * ARIMA simplificado (AutoRegressive Integrated Moving Average)
   * Implementación básica para series estacionarias
   */
  simpleARIMA(
    data: number[],
    p: number = 2, // AR order
    d: number = 1, // Differencing order
    q: number = 1, // MA order
  ): number {
    if (data.length < Math.max(p, q) + d + 1) {
      // No hay suficientes datos, usar promedio
      return data.length > 0
        ? data.reduce((a, b) => a + b, 0) / data.length
        : 0;
    }

    // Diferenciación
    const differenced = this.difference(data, d);

    // Calcular coeficientes AR simplificados (usando Yule-Walker aproximado)
    const arCoeffs = this.estimateARCoefficients(differenced, p);

    // Calcular componente AR
    let arComponent = 0;
    for (let i = 0; i < p && i < differenced.length; i++) {
      arComponent += arCoeffs[i] * differenced[differenced.length - 1 - i];
    }

    // Componente MA simplificado (promedio móvil de errores)
    const errors = this.calculateErrors(differenced, arCoeffs);
    const maComponent =
      errors.length > 0
        ? errors.slice(-q).reduce((a, b) => a + b, 0) /
          Math.min(q, errors.length)
        : 0;

    // Pronóstico en escala diferenciada
    const forecastDiff = arComponent + maComponent;

    // Revertir diferenciación
    const forecast = this.integrate([...data].slice(-d), forecastDiff, d);

    return forecast;
  }

  /**
   * Ensemble de múltiples modelos (weighted average)
   */
  ensembleForecast(
    data: number[],
    weights: { exponential: number; arima: number; moving_avg: number } = {
      exponential: 0.4,
      arima: 0.3,
      moving_avg: 0.3,
    },
  ): {
    forecast: number;
    confidence: number;
    model_contributions: Record<string, number>;
  } {
    const exponential = this.exponentialSmoothing(data);
    const arima = this.simpleARIMA(data);
    const movingAvg = this.calculateMovingAverage(data, 7);

    const forecast =
      exponential.forecast * weights.exponential +
      arima * weights.arima +
      movingAvg * weights.moving_avg;

    // Calcular confianza basada en variabilidad de predicciones
    const predictions = [exponential.forecast, arima, movingAvg];
    const mean = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    const variance =
      predictions.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
      predictions.length;
    const stdDev = Math.sqrt(variance);
    const confidence = Math.max(0, Math.min(100, 100 - (stdDev / mean) * 100));

    return {
      forecast,
      confidence,
      model_contributions: {
        exponential: exponential.forecast,
        arima,
        moving_avg: movingAvg,
      },
    };
  }

  // ========== Métodos auxiliares ==========

  private difference(data: number[], order: number): number[] {
    let result = [...data];
    for (let i = 0; i < order; i++) {
      const diffed: number[] = [];
      for (let j = 1; j < result.length; j++) {
        diffed.push(result[j] - result[j - 1]);
      }
      result = diffed;
    }
    return result;
  }

  private integrate(
    original: number[],
    forecastDiff: number,
    _order: number,
  ): number {
    let result = forecastDiff;
    for (let i = original.length - 1; i >= 0; i--) {
      result = original[i] + result;
    }
    return result;
  }

  private estimateARCoefficients(data: number[], order: number): number[] {
    if (data.length < order + 1) {
      return new Array(order).fill(0);
    }

    // Yule-Walker simplificado usando autocorrelación
    const coeffs: number[] = [];
    for (let i = 0; i < order; i++) {
      const autocorr = this.autocorrelation(data, i + 1);
      coeffs.push(autocorr * 0.5); // Simplificación
    }

    return coeffs;
  }

  private autocorrelation(data: number[], lag: number): number {
    if (data.length < lag + 1) return 0;

    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    let numerator = 0;
    let denominator = 0;

    for (let i = lag; i < data.length; i++) {
      numerator += (data[i] - mean) * (data[i - lag] - mean);
      denominator += Math.pow(data[i] - mean, 2);
    }

    return denominator > 0 ? numerator / denominator : 0;
  }

  private calculateErrors(data: number[], arCoeffs: number[]): number[] {
    const errors: number[] = [];
    for (let i = arCoeffs.length; i < data.length; i++) {
      let predicted = 0;
      for (let j = 0; j < arCoeffs.length; j++) {
        predicted += arCoeffs[j] * data[i - 1 - j];
      }
      errors.push(data[i] - predicted);
    }
    return errors;
  }

  private calculateMovingAverage(data: number[], window: number): number {
    if (data.length === 0) return 0;
    const recent = data.slice(-window);
    return recent.reduce((a, b) => a + b, 0) / recent.length;
  }
}
