/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Comprehensive ML Evaluation, Metrics & Threshold Optimizer
 */

import {
  EvaluationMetrics,
  ConfusionMatrix,
  CurvePoint,
  CalibrationBin,
  DecileRow,
  CostModelParams
} from './types';

export const DEFAULT_COST_PARAMS: CostModelParams = {
  contactCostGbp: 5.0,
  offerCostGbp: 30.0,
  acceptanceRate: 0.25,
  avgRevenueSavedGbp: 350.0,
  costOfMissedChurnerGbp: 500.0
};

/**
 * Compute full suite of classification metrics and evaluation curves
 */
export function evaluatePredictions(
  probabilities: number[],
  targets: number[],
  threshold: number = 0.5
): EvaluationMetrics {
  const n = probabilities.length;
  if (n === 0) {
    throw new Error('Cannot evaluate empty predictions array.');
  }

  let tp = 0, fp = 0, tn = 0, fn = 0;
  let logLossSum = 0;
  let brierSum = 0;

  for (let i = 0; i < n; i++) {
    const p = Math.max(1e-12, Math.min(1 - 1e-12, probabilities[i]));
    const y = targets[i];

    // Log-loss and Brier score
    logLossSum += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
    brierSum += Math.pow(p - y, 2);

    // Confusion matrix
    const pred = probabilities[i] >= threshold ? 1 : 0;
    if (pred === 1 && y === 1) tp++;
    else if (pred === 1 && y === 0) fp++;
    else if (pred === 0 && y === 0) tn++;
    else if (pred === 0 && y === 1) fn++;
  }

  const accuracy = (tp + tn) / n;
  const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
  const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
  const specificity = (tn + fp) > 0 ? tn / (tn + fp) : 0;
  const f1Score = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const balancedAccuracy = (recall + specificity) / 2;

  // Matthews Correlation Coefficient
  const mccDenominator = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  const mcc = mccDenominator > 0 ? ((tp * tn) - (fp * fn)) / mccDenominator : 0;

  const logLoss = logLossSum / n;
  const brierScore = brierSum / n;

  // ROC Curve and AUC
  const { rocAuc, rocCurve, ksStatistic } = computeRocCurve(probabilities, targets);

  // PR Curve and PR-AUC
  const { prAuc, prCurve } = computePrCurve(probabilities, targets);

  // Decile table & Lift/Gain
  const decileTable = computeDeciles(probabilities, targets);

  // Calibration curve (10 bins)
  const calibrationCurve = computeCalibrationBins(probabilities, targets);

  return {
    rocAuc: Math.round(rocAuc * 1000) / 1000,
    prAuc: Math.round(prAuc * 1000) / 1000,
    accuracy: Math.round(accuracy * 1000) / 1000,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1Score: Math.round(f1Score * 1000) / 1000,
    specificity: Math.round(specificity * 1000) / 1000,
    balancedAccuracy: Math.round(balancedAccuracy * 1000) / 1000,
    mcc: Math.round(mcc * 1000) / 1000,
    logLoss: Math.round(logLoss * 1000) / 1000,
    brierScore: Math.round(brierScore * 1000) / 1000,
    ksStatistic: Math.round(ksStatistic * 1000) / 1000,
    confusionMatrix: { tp, fp, tn, fn },
    rocCurve,
    prCurve,
    calibrationCurve,
    decileTable,
    threshold
  };
}

/**
 * ROC Curve & AUC via trapezoidal integration + KS statistic
 */
export function computeRocCurve(probabilities: number[], targets: number[]): {
  rocAuc: number;
  rocCurve: CurvePoint[];
  ksStatistic: number;
} {
  const n = probabilities.length;
  const pairs = probabilities.map((p, i) => ({ p, y: targets[i] }));
  pairs.sort((a, b) => b.p - a.p); // Descending

  let totalPos = 0;
  for (let i = 0; i < n; i++) if (targets[i] === 1) totalPos++;
  const totalNeg = n - totalPos;

  if (totalPos === 0 || totalNeg === 0) {
    return {
      rocAuc: 0.5,
      rocCurve: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      ksStatistic: 0
    };
  }

  const rocCurve: CurvePoint[] = [{ x: 0, y: 0, threshold: 1.0 }];
  let cumPos = 0;
  let cumNeg = 0;
  let auc = 0;
  let prevFpr = 0;
  let prevTpr = 0;
  let maxKs = 0;

  for (let i = 0; i < n; i++) {
    if (pairs[i].y === 1) cumPos++;
    else cumNeg++;

    const tpr = cumPos / totalPos;
    const fpr = cumNeg / totalNeg;

    // KS is max separation between TPR and FPR
    const ks = Math.abs(tpr - fpr);
    if (ks > maxKs) maxKs = ks;

    // Sample points evenly or at threshold transitions
    if (i === n - 1 || pairs[i].p !== pairs[i + 1].p || i % Math.max(1, Math.floor(n / 50)) === 0) {
      auc += (fpr - prevFpr) * (tpr + prevTpr) / 2; // Trapezoid rule
      rocCurve.push({
        x: Math.round(fpr * 1000) / 1000,
        y: Math.round(tpr * 1000) / 1000,
        threshold: Math.round(pairs[i].p * 1000) / 1000
      });
      prevFpr = fpr;
      prevTpr = tpr;
    }
  }

  // Ensure end point is 1,1
  if (prevFpr < 1) {
    auc += (1 - prevFpr) * (1 + prevTpr) / 2;
    rocCurve.push({ x: 1, y: 1, threshold: 0.0 });
  }

  return { rocAuc: auc, rocCurve, ksStatistic: maxKs };
}

/**
 * Precision-Recall Curve & Average Precision (PR-AUC)
 */
export function computePrCurve(probabilities: number[], targets: number[]): {
  prAuc: number;
  prCurve: CurvePoint[];
} {
  const n = probabilities.length;
  const pairs = probabilities.map((p, i) => ({ p, y: targets[i] }));
  pairs.sort((a, b) => b.p - a.p);

  let totalPos = 0;
  for (let i = 0; i < n; i++) if (targets[i] === 1) totalPos++;
  if (totalPos === 0) {
    return { prAuc: 0, prCurve: [{ x: 0, y: 0 }] };
  }

  let cumPos = 0;
  let cumTotal = 0;
  let prAuc = 0;
  let prevRecall = 0;
  const prCurve: CurvePoint[] = [];

  for (let i = 0; i < n; i++) {
    cumTotal++;
    if (pairs[i].y === 1) {
      cumPos++;
      const precision = cumPos / cumTotal;
      const recall = cumPos / totalPos;
      prAuc += precision * (recall - prevRecall);
      prevRecall = recall;

      if (i % Math.max(1, Math.floor(n / 40)) === 0 || i === n - 1) {
        prCurve.push({
          x: Math.round(recall * 1000) / 1000,
          y: Math.round(precision * 1000) / 1000,
          threshold: Math.round(pairs[i].p * 1000) / 1000
        });
      }
    }
  }

  return { prAuc, prCurve };
}

/**
 * Decile Analysis (Lift and Cumulative Gain)
 */
export function computeDeciles(probabilities: number[], targets: number[]): DecileRow[] {
  const n = probabilities.length;
  const pairs = probabilities.map((p, i) => ({ p, y: targets[i] }));
  pairs.sort((a, b) => b.p - a.p); // Highest risk first

  let totalPos = 0;
  for (let i = 0; i < n; i++) if (targets[i] === 1) totalPos++;
  const overallChurnRate = totalPos / (n || 1);

  const deciles: DecileRow[] = [];
  const decileSize = Math.floor(n / 10);
  let cumChurnCaptured = 0;

  for (let d = 1; d <= 10; d++) {
    const start = (d - 1) * decileSize;
    const end = d === 10 ? n : d * decileSize;
    const count = end - start;

    let dPos = 0;
    let pSum = 0;
    for (let i = start; i < end; i++) {
      if (pairs[i].y === 1) dPos++;
      pSum += pairs[i].p;
    }

    cumChurnCaptured += dPos;
    const dChurnRate = count > 0 ? dPos / count : 0;
    const captureRate = totalPos > 0 ? cumChurnCaptured / totalPos : 0;
    const lift = overallChurnRate > 0 ? dChurnRate / overallChurnRate : 1.0;

    deciles.push({
      decile: d,
      customerCount: count,
      churnCount: dPos,
      churnRate: Math.round(dChurnRate * 1000) / 1000,
      cumulativeCaptureRate: Math.round(captureRate * 1000) / 1000,
      lift: Math.round(lift * 100) / 100,
      avgPredictedProbability: Math.round((pSum / (count || 1)) * 1000) / 1000
    });
  }

  return deciles;
}

/**
 * Reliability Calibration Bins
 */
export function computeCalibrationBins(probabilities: number[], targets: number[], numBins: number = 10): CalibrationBin[] {
  const bins: CalibrationBin[] = [];
  const binWidth = 1.0 / numBins;

  for (let b = 0; b < numBins; b++) {
    const low = b * binWidth;
    const high = (b + 1) * binWidth;

    let sumPred = 0;
    let sumActual = 0;
    let count = 0;

    for (let i = 0; i < probabilities.length; i++) {
      const p = probabilities[i];
      if ((p >= low && p < high) || (b === numBins - 1 && p >= low && p <= high)) {
        sumPred += p;
        sumActual += targets[i];
        count++;
      }
    }

    bins.push({
      bin: b + 1,
      avgPredicted: count > 0 ? Math.round((sumPred / count) * 1000) / 1000 : (low + high) / 2,
      observedRate: count > 0 ? Math.round((sumActual / count) * 1000) / 1000 : 0,
      count
    });
  }

  return bins;
}

/**
 * Interactive Business Threshold & Profit Optimizer
 */
export function optimizeThresholds(
  probabilities: number[],
  targets: number[],
  costParams: CostModelParams = DEFAULT_COST_PARAMS
): {
  f1OptimalThreshold: number;
  maxF1: number;
  profitOptimalThreshold: number;
  maxNetBenefitGbp: number;
  thresholdCurve: Array<{
    threshold: number;
    precision: number;
    recall: number;
    f1: number;
    netBenefitGbp: number;
    totalCostGbp: number;
    revenueSavedGbp: number;
  }>;
} {
  const candidates: number[] = [];
  for (let t = 0.05; t <= 0.95; t += 0.02) {
    candidates.push(Math.round(t * 100) / 100);
  }

  let bestF1 = -1;
  let f1OptimalThreshold = 0.5;

  let bestProfit = -Infinity;
  let profitOptimalThreshold = 0.5;

  const thresholdCurve: Array<{
    threshold: number;
    precision: number;
    recall: number;
    f1: number;
    netBenefitGbp: number;
    totalCostGbp: number;
    revenueSavedGbp: number;
  }> = [];

  for (const t of candidates) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    for (let i = 0; i < probabilities.length; i++) {
      const pred = probabilities[i] >= t ? 1 : 0;
      const y = targets[i];
      if (pred === 1 && y === 1) tp++;
      else if (pred === 1 && y === 0) fp++;
      else if (pred === 0 && y === 0) tn++;
      else fn++;
    }

    const precision = (tp + fp) > 0 ? tp / (tp + fp) : 0;
    const recall = (tp + fn) > 0 ? tp / (tp + fn) : 0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    if (f1 > bestF1) {
      bestF1 = f1;
      f1OptimalThreshold = t;
    }

    // Business net financial benefit formula:
    // Targeted audience = TP + FP
    // Contact cost = (TP + FP) * contactCost
    // Responding/accepted customers = (TP + FP) * acceptanceRate
    // Offer cost = (TP + FP) * acceptanceRate * offerCost
    // Retained churners = TP * acceptanceRate
    // Revenue protected = TP * acceptanceRate * avgRevenueSaved
    // Cost of missed churners = FN * costOfMissedChurner
    const targeted = tp + fp;
    const totalCost = (targeted * costParams.contactCostGbp) + (targeted * costParams.acceptanceRate * costParams.offerCostGbp);
    const revenueSaved = tp * costParams.acceptanceRate * costParams.avgRevenueSavedGbp;
    const costOfMissed = fn * costParams.costOfMissedChurnerGbp;
    const netBenefit = revenueSaved - totalCost - costOfMissed;

    if (netBenefit > bestProfit) {
      bestProfit = netBenefit;
      profitOptimalThreshold = t;
    }

    thresholdCurve.push({
      threshold: t,
      precision: Math.round(precision * 1000) / 1000,
      recall: Math.round(recall * 1000) / 1000,
      f1: Math.round(f1 * 1000) / 1000,
      netBenefitGbp: Math.round(netBenefit),
      totalCostGbp: Math.round(totalCost),
      revenueSavedGbp: Math.round(revenueSaved)
    });
  }

  return {
    f1OptimalThreshold,
    maxF1: Math.round(bestF1 * 1000) / 1000,
    profitOptimalThreshold,
    maxNetBenefitGbp: Math.round(bestProfit),
    thresholdCurve
  };
}
