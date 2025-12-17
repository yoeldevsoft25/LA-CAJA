import { Injectable } from '@nestjs/common';

/**
 * Servicio de Feature Engineering avanzado
 * Genera características temporales, categóricas y numéricas para modelos ML
 */
@Injectable()
export class FeatureEngineeringService {
  /**
   * Genera características temporales avanzadas
   */
  generateTemporalFeatures(date: Date): {
    day_of_week: number;
    day_of_month: number;
    week_of_year: number;
    month: number;
    quarter: number;
    is_weekend: number;
    is_month_start: number;
    is_month_end: number;
    days_from_month_start: number;
    days_to_month_end: number;
  } {
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    // Calcular semana del año
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor(
      (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
    );
    const weekOfYear = Math.ceil((days + startOfYear.getDay() + 1) / 7);

    // Calcular trimestre
    const quarter = Math.ceil(month / 3);

    // Días desde inicio del mes
    const monthStart = new Date(year, month - 1, 1);
    const daysFromMonthStart = Math.floor(
      (date.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000),
    );

    // Días hasta fin del mes
    const monthEnd = new Date(year, month, 0);
    const daysToMonthEnd = Math.floor(
      (monthEnd.getTime() - date.getTime()) / (24 * 60 * 60 * 1000),
    );

    return {
      day_of_week: dayOfWeek,
      day_of_month: dayOfMonth,
      week_of_year: weekOfYear,
      month,
      quarter,
      is_weekend: dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0,
      is_month_start: dayOfMonth === 1 ? 1 : 0,
      is_month_end: dayOfMonth === monthEnd.getDate() ? 1 : 0,
      days_from_month_start: daysFromMonthStart,
      days_to_month_end: daysToMonthEnd,
    };
  }

  /**
   * Genera características de lag (valores históricos)
   */
  generateLagFeatures(
    data: Array<{ date: Date; value: number }>,
    lags: number[] = [1, 7, 14, 30],
  ): Map<string, number> {
    const features = new Map<string, number>();
    const sortedData = [...data].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    if (sortedData.length === 0) {
      lags.forEach((lag) => {
        features.set(`lag_${lag}`, 0);
      });
      return features;
    }

    const latestValue = sortedData[sortedData.length - 1].value;

    lags.forEach((lag) => {
      const targetDate = new Date(sortedData[sortedData.length - 1].date);
      targetDate.setDate(targetDate.getDate() - lag);

      const lagData = sortedData.find(
        (d) =>
          d.date.toISOString().split('T')[0] ===
          targetDate.toISOString().split('T')[0],
      );

      features.set(`lag_${lag}`, lagData ? lagData.value : latestValue);
    });

    return features;
  }

  /**
   * Genera características de rolling statistics
   */
  generateRollingFeatures(
    data: Array<{ date: Date; value: number }>,
    windows: number[] = [7, 14, 30],
  ): Map<string, number> {
    const features = new Map<string, number>();
    const sortedData = [...data].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    windows.forEach((window) => {
      const windowData = sortedData.slice(-window);
      if (windowData.length === 0) {
        features.set(`rolling_mean_${window}`, 0);
        features.set(`rolling_std_${window}`, 0);
        features.set(`rolling_min_${window}`, 0);
        features.set(`rolling_max_${window}`, 0);
        return;
      }

      const values = windowData.map((d) => d.value);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
        values.length;
      const stdDev = Math.sqrt(variance);
      const min = Math.min(...values);
      const max = Math.max(...values);

      features.set(`rolling_mean_${window}`, mean);
      features.set(`rolling_std_${window}`, stdDev);
      features.set(`rolling_min_${window}`, min);
      features.set(`rolling_max_${window}`, max);
    });

    return features;
  }

  /**
   * Genera características de tendencia
   */
  generateTrendFeatures(data: Array<{ date: Date; value: number }>): {
    trend: number;
    acceleration: number;
    volatility: number;
  } {
    const sortedData = [...data].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    if (sortedData.length < 2) {
      return { trend: 0, acceleration: 0, volatility: 0 };
    }

    // Tendencia lineal simple
    const n = sortedData.length;
    const x = sortedData.map((_, i) => i);
    const y = sortedData.map((d) => d.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumXX = x.reduce((acc, xi) => acc + xi * xi, 0);

    const trend = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Aceleración (cambio en la tendencia)
    const recentTrend =
      sortedData.length >= 7
        ? this.calculateTrend(sortedData.slice(-7))
        : trend;
    const acceleration = recentTrend - trend;

    // Volatilidad (desviación estándar de los cambios)
    const changes = sortedData
      .slice(1)
      .map((d, i) => d.value - sortedData[i].value);
    const meanChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const variance =
      changes.reduce((acc, val) => acc + Math.pow(val - meanChange, 2), 0) /
      changes.length;
    const volatility = Math.sqrt(variance);

    return { trend, acceleration, volatility };
  }

  private calculateTrend(data: Array<{ date: Date; value: number }>): number {
    if (data.length < 2) return 0;
    const first = data[0].value;
    const last = data[data.length - 1].value;
    const days = data.length - 1;
    return days > 0 ? (last - first) / days : 0;
  }

  /**
   * Normaliza características numéricas usando min-max scaling
   */
  normalizeFeature(value: number, min: number, max: number): number {
    if (max === min) return 0.5;
    return (value - min) / (max - min);
  }

  /**
   * Normaliza características usando z-score
   */
  standardizeFeature(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }
}
