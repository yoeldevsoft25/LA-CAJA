import { Injectable } from '@nestjs/common';

/**
 * Servicio de evaluación de modelos ML
 * Calcula métricas de rendimiento: MAE, RMSE, MAPE, R²
 */
@Injectable()
export class ModelEvaluationService {
  /**
   * Mean Absolute Error (MAE)
   */
  calculateMAE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) {
      return 0;
    }

    const errors = actual.map((a, i) => Math.abs(a - predicted[i]));
    return errors.reduce((a, b) => a + b, 0) / errors.length;
  }

  /**
   * Root Mean Squared Error (RMSE)
   */
  calculateRMSE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) {
      return 0;
    }

    const squaredErrors = actual.map((a, i) => Math.pow(a - predicted[i], 2));
    const mse = squaredErrors.reduce((a, b) => a + b, 0) / squaredErrors.length;
    return Math.sqrt(mse);
  }

  /**
   * Mean Absolute Percentage Error (MAPE)
   */
  calculateMAPE(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) {
      return 0;
    }

    const errors = actual
      .map((a, i) => {
        if (a === 0) return 0; // Evitar división por cero
        return Math.abs((a - predicted[i]) / a);
      })
      .filter((e) => !isNaN(e) && isFinite(e));

    if (errors.length === 0) return 0;

    return (errors.reduce((a, b) => a + b, 0) / errors.length) * 100;
  }

  /**
   * R-squared (Coeficiente de determinación)
   */
  calculateR2(actual: number[], predicted: number[]): number {
    if (actual.length !== predicted.length || actual.length === 0) {
      return 0;
    }

    const meanActual = actual.reduce((a, b) => a + b, 0) / actual.length;
    const ssRes = actual.reduce(
      (acc, a, i) => acc + Math.pow(a - predicted[i], 2),
      0,
    );
    const ssTot = actual.reduce(
      (acc, a) => acc + Math.pow(a - meanActual, 2),
      0,
    );

    if (ssTot === 0) return 0;

    return 1 - ssRes / ssTot;
  }

  /**
   * Calcula todas las métricas
   */
  calculateAllMetrics(
    actual: number[],
    predicted: number[],
  ): {
    mae: number;
    rmse: number;
    mape: number;
    r2: number;
  } {
    return {
      mae: this.calculateMAE(actual, predicted),
      rmse: this.calculateRMSE(actual, predicted),
      mape: this.calculateMAPE(actual, predicted),
      r2: this.calculateR2(actual, predicted),
    };
  }

  /**
   * Validación cruzada k-fold
   */
  crossValidate(
    data: Array<{ date: Date; value: number }>,
    k: number = 5,
    predictFn: (train: Array<{ date: Date; value: number }>) => number,
  ): {
    mae: number;
    rmse: number;
    mape: number;
    r2: number;
    fold_scores: Array<{
      fold: number;
      mae: number;
      rmse: number;
      mape: number;
      r2: number;
    }>;
  } {
    if (data.length < k) {
      // Si no hay suficientes datos, usar todos para entrenar y validar
      const sorted = [...data].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      const train = sorted.slice(0, Math.floor(sorted.length * 0.8));
      const test = sorted.slice(Math.floor(sorted.length * 0.8));

      const predictions = test.map(() => predictFn(train));
      const actual = test.map((d) => d.value);

      const metrics = this.calculateAllMetrics(actual, predictions);

      return {
        ...metrics,
        fold_scores: [{ fold: 1, ...metrics }],
      };
    }

    const foldSize = Math.floor(data.length / k);
    const sorted = [...data].sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
    const foldScores: Array<{
      fold: number;
      mae: number;
      rmse: number;
      mape: number;
      r2: number;
    }> = [];

    let totalMAE = 0;
    let totalRMSE = 0;
    let totalMAPE = 0;
    let totalR2 = 0;

    for (let fold = 0; fold < k; fold++) {
      const testStart = fold * foldSize;
      const testEnd = fold === k - 1 ? data.length : (fold + 1) * foldSize;

      const test = sorted.slice(testStart, testEnd);
      const train = [...sorted.slice(0, testStart), ...sorted.slice(testEnd)];

      if (train.length === 0 || test.length === 0) continue;

      const predictions = test.map(() => predictFn(train));
      const actual = test.map((d) => d.value);

      const metrics = this.calculateAllMetrics(actual, predictions);
      foldScores.push({ fold: fold + 1, ...metrics });

      totalMAE += metrics.mae;
      totalRMSE += metrics.rmse;
      totalMAPE += metrics.mape;
      totalR2 += metrics.r2;
    }

    const validFolds = foldScores.length;

    return {
      mae: validFolds > 0 ? totalMAE / validFolds : 0,
      rmse: validFolds > 0 ? totalRMSE / validFolds : 0,
      mape: validFolds > 0 ? totalMAPE / validFolds : 0,
      r2: validFolds > 0 ? totalR2 / validFolds : 0,
      fold_scores: foldScores,
    };
  }
}
