/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Machine Learning Engine Types & Interfaces
 */

export type ModelAlgorithm = 'LogisticRegression' | 'DecisionTree' | 'RandomForest' | 'GradientBoosting';

export interface ModelHyperparameters {
  // Logistic Regression
  learningRate?: number;
  l2Penalty?: number;
  maxEpochs?: number;
  // Trees & Forests
  maxDepth?: number;
  minSamplesSplit?: number;
  numTrees?: number;
  subsampleFeatures?: number;
  // Gradient Boosting
  shrinkage?: number;
  // Shared
  useClassWeights?: boolean;
}

export interface TrainingSplitConfig {
  trainRatio: number; // e.g. 0.70
  valRatio: number;   // e.g. 0.15
  testRatio: number;  // e.g. 0.15
  seed: number;
}

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}

export interface DecileRow {
  decile: number; // 1 to 10 (1 = highest risk)
  customerCount: number;
  churnCount: number;
  churnRate: number; // 0 to 1
  cumulativeCaptureRate: number; // 0 to 1
  lift: number; // ratio vs overall average churn
  avgPredictedProbability: number;
}

export interface CurvePoint {
  x: number;
  y: number;
  threshold?: number;
}

export interface CalibrationBin {
  bin: number;
  avgPredicted: number;
  observedRate: number;
  count: number;
}

export interface EvaluationMetrics {
  rocAuc: number;
  prAuc: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  specificity: number;
  balancedAccuracy: number;
  mcc: number; // Matthews Correlation Coefficient (-1 to 1)
  logLoss: number;
  brierScore: number;
  ksStatistic: number; // Kolmogorov-Smirnov statistic
  confusionMatrix: ConfusionMatrix;
  rocCurve: CurvePoint[];
  prCurve: CurvePoint[];
  calibrationCurve: CalibrationBin[];
  decileTable: DecileRow[];
  threshold: number;
}

export interface FeatureImportanceItem {
  feature: string;
  label: string;
  importance: number; // normalized 0 to 1
  stdDev?: number;
  rawScore: number;
}

export interface LocalDriverContribution {
  feature: string;
  label: string;
  value: number | string;
  contribution: number; // Delta on log-odds / probability (positive = risk up, negative = risk down)
  percentagePointsDelta: number; // e.g. +8.5 percentage points
  explanation: string;
}

export interface TrainedModelSummary {
  algorithm: ModelAlgorithm;
  name: string;
  trainRocAuc: number;
  valRocAuc: number;
  valPrAuc: number;
  testMetrics: EvaluationMetrics;
  isChampion: boolean;
  overfittingGap: number; // trainRocAuc - testRocAuc
  isOverfitting: boolean; // gap > 0.08
  trainingDurationMs: number;
}

export interface CostModelParams {
  contactCostGbp: number;        // e.g. £5 per outreach
  offerCostGbp: number;          // e.g. £30 per accepted offer
  acceptanceRate: number;        // e.g. 0.25 (25%)
  avgRevenueSavedGbp: number;    // e.g. £350 per retained customer
  costOfMissedChurnerGbp: number;// e.g. £500
}

export interface ChampionModelRecord {
  id: string;
  version: string;
  trainedAt: string;
  algorithm: ModelAlgorithm;
  algorithmName: string;
  datasetId: string;
  datasetName: string;
  rowCount: number;
  featureNames: string[];
  featureLabels: string[];
  featureTypes: Record<string, 'numeric' | 'binary' | 'onehot'>;
  featureImportances: FeatureImportanceItem[];
  modelData: any; // Serialized weights / tree structures
  calibrationParams: { a: number; b: number }; // Platt scaling
  optimalThreshold: number;
  profitOptimalThreshold: number;
  costModelParams: CostModelParams;
  metrics: EvaluationMetrics;
  allCandidateModels: TrainedModelSummary[];
  splitConfig: TrainingSplitConfig;
  plainEnglishSummary: string;
  isStale: boolean;
}

export interface TrainingProgressUpdate {
  stage: 'preparing' | 'training_logistic' | 'training_dt' | 'training_rf' | 'training_gb' | 'evaluating' | 'completed' | 'error';
  currentModel?: string;
  progressPercent: number; // 0 to 100
  message: string;
  elapsedMs: number;
  estimatedRemainingMs: number;
}
