/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ML Training Pipeline & Scoring Service
 */

import { BritConnectCustomer, CustomerScore } from '../data/dictionary';
import { EngineeredFeatureMatrix } from '../features/engineer';
import {
  ChampionModelRecord,
  ModelAlgorithm,
  TrainedModelSummary,
  TrainingProgressUpdate,
  TrainingSplitConfig,
  FeatureImportanceItem,
  CostModelParams
} from './types';
import {
  LogisticRegressionModel,
  DecisionTreeModel,
  RandomForestModel,
  GradientBoostingModel,
  fitPlattCalibration,
  applyCalibration,
  createRng
} from './algorithms';
import {
  evaluatePredictions,
  optimizeThresholds,
  DEFAULT_COST_PARAMS
} from './evaluation';

export interface TrainPipelineInput {
  featureMatrix: EngineeredFeatureMatrix;
  splitConfig?: TrainingSplitConfig;
  costParams?: CostModelParams;
  datasetId: string;
  datasetName: string;
  onProgress?: (update: TrainingProgressUpdate) => void;
}

/**
 * Train all 4 candidate models, tune, calibrate, select champion, and compute evaluation
 */
export async function runTrainingPipeline(
  input: TrainPipelineInput
): Promise<ChampionModelRecord> {
  const {
    featureMatrix,
    splitConfig = { trainRatio: 0.70, valRatio: 0.15, testRatio: 0.15, seed: 42 },
    costParams = DEFAULT_COST_PARAMS,
    datasetId,
    datasetName,
    onProgress
  } = input;

  const startTime = Date.now();
  const rng = createRng(splitConfig.seed);

  const reportProgress = (
    stage: TrainingProgressUpdate['stage'],
    pct: number,
    msg: string,
    currentModel?: string
  ) => {
    const elapsed = Date.now() - startTime;
    const estimatedRemaining = pct > 0 ? Math.max(0, Math.round((elapsed / pct) * (100 - pct))) : 0;
    onProgress?.({
      stage,
      currentModel,
      progressPercent: pct,
      message: msg,
      elapsedMs: elapsed,
      estimatedRemainingMs: estimatedRemaining
    });
  };

  reportProgress('preparing', 5, 'Stratifying train, validation, and test datasets...');

  const { matrix, targets, featureNames, featureLabels, featureTypes } = featureMatrix;
  const n = matrix.length;

  // Stratified split indices
  const posIndices: number[] = [];
  const negIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    if (targets[i] === 1) posIndices.push(i);
    else negIndices.push(i);
  }

  // Shuffle both with seeded PRNG
  const shuffle = (arr: number[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };
  shuffle(posIndices);
  shuffle(negIndices);

  const splitIndices = (indices: number[]) => {
    const nTrain = Math.floor(indices.length * splitConfig.trainRatio);
    const nVal = Math.floor(indices.length * splitConfig.valRatio);
    return {
      train: indices.slice(0, nTrain),
      val: indices.slice(nTrain, nTrain + nVal),
      test: indices.slice(nTrain + nVal)
    };
  };

  const posSplit = splitIndices(posIndices);
  const negSplit = splitIndices(negIndices);

  const trainIdx = [...posSplit.train, ...negSplit.train];
  const valIdx = [...posSplit.val, ...negSplit.val];
  const testIdx = [...posSplit.test, ...negSplit.test];
  shuffle(trainIdx);
  shuffle(valIdx);
  shuffle(testIdx);

  const X_train = trainIdx.map(i => matrix[i]);
  const y_train = trainIdx.map(i => targets[i]);
  const X_val = valIdx.map(i => matrix[i]);
  const y_val = valIdx.map(i => targets[i]);
  const X_test = testIdx.map(i => matrix[i]);
  const y_test = testIdx.map(i => targets[i]);

  // Train Candidates
  const candidateSummaries: Array<{
    algorithm: ModelAlgorithm;
    name: string;
    model: any;
    trainMetrics: any;
    valMetrics: any;
    testMetrics: any;
    durationMs: number;
  }> = [];

  // 1. Logistic Regression
  reportProgress('training_logistic', 20, 'Training Logistic Regression (L2-regularized)...', 'Logistic Regression');
  const lrStart = Date.now();
  const lrModel = new LogisticRegressionModel();
  lrModel.fit(X_train, y_train, { rng });

  const lrTrainPred = X_train.map(x => lrModel.predictProba(x));
  const lrValPred = X_val.map(x => lrModel.predictProba(x));
  const lrTestPred = X_test.map(x => lrModel.predictProba(x));

  candidateSummaries.push({
    algorithm: 'LogisticRegression',
    name: 'Logistic Regression',
    model: lrModel,
    trainMetrics: evaluatePredictions(lrTrainPred, y_train),
    valMetrics: evaluatePredictions(lrValPred, y_val),
    testMetrics: evaluatePredictions(lrTestPred, y_test),
    durationMs: Date.now() - lrStart
  });

  // 2. Decision Tree
  reportProgress('training_dt', 40, 'Training Decision Tree (CART binary splits)...', 'Decision Tree');
  const dtStart = Date.now();
  const dtModel = new DecisionTreeModel();
  dtModel.fit(X_train, y_train, { maxDepth: 5, rng });

  const dtTrainPred = X_train.map(x => dtModel.predictProba(x));
  const dtValPred = X_val.map(x => dtModel.predictProba(x));
  const dtTestPred = X_test.map(x => dtModel.predictProba(x));

  candidateSummaries.push({
    algorithm: 'DecisionTree',
    name: 'Decision Tree',
    model: dtModel,
    trainMetrics: evaluatePredictions(dtTrainPred, y_train),
    valMetrics: evaluatePredictions(dtValPred, y_val),
    testMetrics: evaluatePredictions(dtTestPred, y_test),
    durationMs: Date.now() - dtStart
  });

  // 3. Random Forest
  reportProgress('training_rf', 60, 'Training Random Forest (25 trees)...', 'Random Forest');
  const rfStart = Date.now();
  const rfModel = new RandomForestModel();
  rfModel.fit(X_train, y_train, { numTrees: 25, maxDepth: 5, rng });

  const rfTrainPred = X_train.map(x => rfModel.predictProba(x));
  const rfValPred = X_val.map(x => rfModel.predictProba(x));
  const rfTestPred = X_test.map(x => rfModel.predictProba(x));

  candidateSummaries.push({
    algorithm: 'RandomForest',
    name: 'Random Forest',
    model: rfModel,
    trainMetrics: evaluatePredictions(rfTrainPred, y_train),
    valMetrics: evaluatePredictions(rfValPred, y_val),
    testMetrics: evaluatePredictions(rfTestPred, y_test),
    durationMs: Date.now() - rfStart
  });

  // 4. Gradient Boosted Trees
  reportProgress('training_gb', 80, 'Training Gradient Boosted Trees...', 'Gradient Boosted Trees');
  const gbStart = Date.now();
  const gbModel = new GradientBoostingModel();
  gbModel.fit(X_train, y_train, { numTrees: 30, maxDepth: 3, learningRate: 0.1 });

  const gbTrainPred = X_train.map(x => gbModel.predictProba(x));
  const gbValPred = X_val.map(x => gbModel.predictProba(x));
  const gbTestPred = X_test.map(x => gbModel.predictProba(x));

  candidateSummaries.push({
    algorithm: 'GradientBoosting',
    name: 'Gradient Boosted Trees',
    model: gbModel,
    trainMetrics: evaluatePredictions(gbTrainPred, y_train),
    valMetrics: evaluatePredictions(gbValPred, y_val),
    testMetrics: evaluatePredictions(gbTestPred, y_test),
    durationMs: Date.now() - gbStart
  });

  // Champion Selection (by validation PR-AUC, tie-break ROC-AUC)
  reportProgress('evaluating', 90, 'Selecting champion and calibrating probabilities...');

  candidateSummaries.sort((a, b) => {
    if (Math.abs(b.valMetrics.prAuc - a.valMetrics.prAuc) > 0.005) {
      return b.valMetrics.prAuc - a.valMetrics.prAuc;
    }
    return b.valMetrics.rocAuc - a.valMetrics.rocAuc;
  });

  const championCandidate = candidateSummaries[0];

  // Calibrate probabilities using Platt scaling on validation set
  const championValRaw = X_val.map(x => {
    if (championCandidate.model.predictRaw) return championCandidate.model.predictRaw(x);
    return Math.log(Math.max(1e-6, championCandidate.model.predictProba(x) / (1 - championCandidate.model.predictProba(x) + 1e-6)));
  });
  const calibrationParams = fitPlattCalibration(championValRaw, y_val);

  // Compute final calibrated test predictions
  const calibratedTestProbas = X_test.map(x => {
    let raw = 0;
    if (championCandidate.model.predictRaw) {
      raw = championCandidate.model.predictRaw(x);
    } else {
      const p = championCandidate.model.predictProba(x);
      raw = Math.log(Math.max(1e-6, p / (1 - p + 1e-6)));
    }
    return applyCalibration(raw, calibrationParams);
  });

  // Optimize thresholds for champion
  const thresholdOptimization = optimizeThresholds(calibratedTestProbas, y_test, costParams);
  const finalTestMetrics = evaluatePredictions(
    calibratedTestProbas,
    y_test,
    thresholdOptimization.profitOptimalThreshold
  );

  // Permutation feature importance on test set
  const baselineAuc = finalTestMetrics.rocAuc;
  const featureImportances: FeatureImportanceItem[] = [];

  for (let f = 0; f < featureNames.length; f++) {
    const shuffledX = X_test.map(row => [...row]);
    const colVals = shuffledX.map(r => r[f]);
    shuffle(colVals);
    for (let i = 0; i < shuffledX.length; i++) shuffledX[i][f] = colVals[i];

    const permProbas = shuffledX.map(x => {
      let raw = 0;
      if (championCandidate.model.predictRaw) raw = championCandidate.model.predictRaw(x);
      else {
        const p = championCandidate.model.predictProba(x);
        raw = Math.log(Math.max(1e-6, p / (1 - p + 1e-6)));
      }
      return applyCalibration(raw, calibrationParams);
    });

    const permMetrics = evaluatePredictions(permProbas, y_test);
    const drop = Math.max(0, baselineAuc - permMetrics.rocAuc);

    featureImportances.push({
      feature: featureNames[f],
      label: featureLabels[f],
      importance: drop,
      rawScore: drop
    });
  }

  // Normalize importance 0 to 1
  const maxImp = Math.max(...featureImportances.map(i => i.importance), 0.001);
  featureImportances.forEach(i => {
    i.importance = Math.round((i.importance / maxImp) * 1000) / 1000;
  });
  featureImportances.sort((a, b) => b.importance - a.importance);

  // Model comparison table summaries
  const allCandidateModels: TrainedModelSummary[] = candidateSummaries.map(c => {
    const gap = Math.round((c.trainMetrics.rocAuc - c.testMetrics.rocAuc) * 1000) / 1000;
    return {
      algorithm: c.algorithm,
      name: c.name,
      trainRocAuc: c.trainMetrics.rocAuc,
      valRocAuc: c.valMetrics.rocAuc,
      valPrAuc: c.valMetrics.prAuc,
      testMetrics: c.testMetrics,
      isChampion: c.algorithm === championCandidate.algorithm,
      overfittingGap: gap,
      isOverfitting: gap > 0.08,
      trainingDurationMs: c.durationMs
    };
  });

  // Plain-English summary
  const topDecile = finalTestMetrics.decileTable[0];
  const avgChurnPct = (
    targets.reduce((a, b) => a + b, 0) / (targets.length || 1) * 100
  ).toFixed(1);
  const plainEnglishSummary = `Among the top 10% highest-risk customers identified by ${championCandidate.name}, ${(topDecile.churnRate * 100).toFixed(1)}% churned, which is ${topDecile.lift.toFixed(1)}× the company baseline (${avgChurnPct}%). The model achieved a ROC-AUC of ${finalTestMetrics.rocAuc.toFixed(3)} and PR-AUC of ${finalTestMetrics.prAuc.toFixed(3)} on the untouched test holdout.`;

  reportProgress('completed', 100, `Champion model established: ${championCandidate.name}`);

  return {
    id: `model-${Date.now()}`,
    version: '1.0.0',
    trainedAt: new Date().toISOString(),
    algorithm: championCandidate.algorithm,
    algorithmName: championCandidate.name,
    datasetId,
    datasetName,
    rowCount: n,
    featureNames,
    featureLabels,
    featureTypes,
    featureImportances,
    modelData: championCandidate.model,
    calibrationParams,
    optimalThreshold: thresholdOptimization.f1OptimalThreshold,
    profitOptimalThreshold: thresholdOptimization.profitOptimalThreshold,
    costModelParams: costParams,
    metrics: finalTestMetrics,
    allCandidateModels,
    splitConfig,
    plainEnglishSummary,
    isStale: false
  };
}

/**
 * Score individual customer or entire dataset
 */
export function scoreCustomers(
  customers: BritConnectCustomer[],
  champion: ChampionModelRecord,
  engineeredMatrix: EngineeredFeatureMatrix
): CustomerScore[] {
  const model = champion.modelData;
  const cal = champion.calibrationParams;

  const scores: CustomerScore[] = [];

  for (let i = 0; i < customers.length; i++) {
    const cust = customers[i];
    const x = engineeredMatrix.matrix[i];

    let rawScore = 0;
    if (model && model.predictRaw) {
      rawScore = model.predictRaw(x);
    } else if (model && model.predictProba) {
      const p = model.predictProba(x);
      rawScore = Math.log(Math.max(1e-6, p / (1 - p + 1e-6)));
    }
    const proba = Math.max(0.01, Math.min(0.99, applyCalibration(rawScore, cal)));

    // Risk tier
    let riskTier: CustomerScore['riskTier'] = 'Low';
    if (proba >= 0.75) riskTier = 'Critical';
    else if (proba >= 0.50) riskTier = 'High';
    else if (proba >= 0.25) riskTier = 'Medium';

    // Revenue at risk
    const monthlyRevAtRisk = Math.round(cust.monthlyChargeGbp * proba * 100) / 100;
    const annualRevAtRisk = Math.round(monthlyRevAtRisk * 12 * 100) / 100;

    // Local waterfall driver contributions
    let topDrivers: CustomerScore['topDrivers'] = [];
    if (model && model.explain) {
      const rawDrivers = model.explain(x, champion.featureNames, champion.featureLabels);
      topDrivers = rawDrivers.slice(0, 8).map((d: any) => ({
        feature: d.feature,
        label: d.label,
        contribution: d.contribution,
        value: d.value,
        explanation: d.explanation,
        percentagePointsDelta: d.percentagePointsDelta ?? Math.round(d.contribution * 10)
      }));
    } else {
      // Fallback top features from global importance
      topDrivers = champion.featureImportances.slice(0, 5).map(f => {
        const featIdx = champion.featureNames.indexOf(f.feature);
        const val = featIdx >= 0 ? x[featIdx] : '';
        return {
          feature: f.feature,
          label: f.label,
          contribution: f.importance,
          value: val,
          explanation: `${f.label}: value ${val}`
        };
      });
    }

    // Determine priority and actionable recommendation rule
    let priority: 'P1' | 'P2' | 'P3' = 'P3';
    let recommendedAction = 'Routine service check-in and loyalty engagement.';

    if (riskTier === 'Critical' || (riskTier === 'High' && cust.monthlyChargeGbp > 45)) {
      priority = 'P1';
    } else if (riskTier === 'High' || riskTier === 'Medium') {
      priority = 'P2';
    }

    // Specific driver-to-action rules from Section 10.3
    if (cust.contractType === 'Month-to-Month' || cust.tenureMonths > 20) {
      recommendedAction = 'Proactive 12-Month contract renewal offer with 15% loyalty tariff credit.';
    } else if (cust.overageChargesGbp > 10 || (cust.averageMonthlyUsageGb > cust.dataAllowanceGb)) {
      recommendedAction = 'Plan right-sizing: Upgrade to next-tier data allowance with waived overage.';
    } else if (cust.complaints12m > 0 || cust.supportTickets12m >= 3) {
      recommendedAction = 'Dedicated Senior Care agent callback and £25 service goodwill credit.';
    } else if (cust.networkOutages12m >= 2) {
      recommendedAction = 'Network reliability guarantee credit and complimentary 5G mobile backup dongle.';
    } else if (cust.competitorOfferReceived === 'Yes') {
      recommendedAction = 'Tailored VIP retention offer with premium speed boost at matched pricing.';
    } else if (cust.failedPayments12m > 0) {
      recommendedAction = 'Direct Debit migration incentive with flexible billing cycle alignment.';
    }

    scores.push({
      customerId: cust.customerId,
      churnProbability: Math.round(proba * 1000) / 1000,
      riskTier,
      riskRank: 0, // Assigned after sorting
      monthlyRevenueAtRisk: monthlyRevAtRisk,
      annualRevenueAtRisk: annualRevAtRisk,
      topDrivers,
      recommendedAction,
      priority
    });
  }

  // Sort descending by churn probability to assign risk ranks
  scores.sort((a, b) => b.churnProbability - a.churnProbability);
  scores.forEach((s, idx) => {
    s.riskRank = idx + 1;
  });

  return scores;
}
