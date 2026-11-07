/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Machine Learning Algorithms Implemented from Scratch
 */

import { LocalDriverContribution } from './types';

// Reproducible PRNG (Mulberry32)
export function createRng(seed: number) {
  let s = seed >>> 0;
  return function next(): number {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sigmoid function with numeric stability
export function sigmoid(z: number): number {
  if (z > 35) return 1.0;
  if (z < -35) return 0.0;
  return 1.0 / (1.0 + Math.exp(-z));
}

// =========================================================================
// 1. LOGISTIC REGRESSION (L2 Regularized, Class Weighted, Gradient Descent)
// =========================================================================
export class LogisticRegressionModel {
  weights: number[] = [];
  bias: number = 0;
  featureMeans: number[] = [];
  featureStds: number[] = [];

  fit(
    X: number[][],
    y: number[],
    params: {
      learningRate?: number;
      l2Penalty?: number;
      epochs?: number;
      useClassWeights?: boolean;
      rng?: () => number;
    } = {}
  ) {
    const {
      learningRate = 0.05,
      l2Penalty = 0.001,
      epochs = 120,
      useClassWeights = true,
      rng = Math.random
    } = params;

    const n = X.length;
    const numFeatures = X[0].length;

    // Standardize features
    this.featureMeans = new Array(numFeatures).fill(0);
    this.featureStds = new Array(numFeatures).fill(1);

    for (let j = 0; j < numFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += X[i][j];
      this.featureMeans[j] = sum / n;

      let varSum = 0;
      for (let i = 0; i < n; i++) varSum += Math.pow(X[i][j] - this.featureMeans[j], 2);
      this.featureStds[j] = Math.sqrt(varSum / (n - 1 || 1)) || 1;
    }

    // Class weights
    let posCount = 0;
    for (let i = 0; i < n; i++) if (y[i] === 1) posCount++;
    const negCount = n - posCount;
    const weightPos = useClassWeights && posCount > 0 ? (n / (2 * posCount)) : 1.0;
    const weightNeg = useClassWeights && negCount > 0 ? (n / (2 * negCount)) : 1.0;

    // Initialize weights
    this.weights = new Array(numFeatures).fill(0).map(() => (rng() - 0.5) * 0.02);
    this.bias = 0;

    // Mini-batch Gradient Descent
    const batchSize = Math.min(64, n);
    for (let epoch = 0; epoch < epochs; epoch++) {
      const lr = learningRate / (1 + 0.005 * epoch); // Learning rate decay

      // Shuffle indices
      const indices = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      for (let b = 0; b < n; b += batchSize) {
        const batchEnd = Math.min(b + batchSize, n);
        const actualBatchSize = batchEnd - b;

        const gradW = new Array(numFeatures).fill(0);
        let gradB = 0;

        for (let idx = b; idx < batchEnd; idx++) {
          const i = indices[idx];
          let z = this.bias;
          for (let j = 0; j < numFeatures; j++) {
            const normX = (X[i][j] - this.featureMeans[j]) / this.featureStds[j];
            z += this.weights[j] * normX;
          }
          const p = sigmoid(z);
          const weight = y[i] === 1 ? weightPos : weightNeg;
          const error = (p - y[i]) * weight;

          for (let j = 0; j < numFeatures; j++) {
            const normX = (X[i][j] - this.featureMeans[j]) / this.featureStds[j];
            gradW[j] += error * normX;
          }
          gradB += error;
        }

        // Apply gradients with L2 penalty
        for (let j = 0; j < numFeatures; j++) {
          this.weights[j] -= lr * (gradW[j] / actualBatchSize + l2Penalty * this.weights[j]);
        }
        this.bias -= lr * (gradB / actualBatchSize);
      }
    }
  }

  predictRaw(x: number[]): number {
    let z = this.bias;
    for (let j = 0; j < x.length; j++) {
      const normX = (x[j] - this.featureMeans[j]) / this.featureStds[j];
      z += this.weights[j] * normX;
    }
    return z;
  }

  predictProba(x: number[]): number {
    return sigmoid(this.predictRaw(x));
  }

  // Exact linear attribution for logistic regression
  explain(x: number[], featureNames: string[], featureLabels: string[]): LocalDriverContribution[] {
    const rawOutput = this.predictRaw(x);
    const contributions: LocalDriverContribution[] = [];

    for (let j = 0; j < x.length; j++) {
      const normX = (x[j] - this.featureMeans[j]) / this.featureStds[j];
      const contrib = this.weights[j] * normX; // linear contribution to log-odds
      // Approximate probability delta
      const pBaseline = sigmoid(this.bias);
      const pWithContrib = sigmoid(this.bias + contrib);
      const ppDelta = Math.round((pWithContrib - pBaseline) * 1000) / 10;

      let explanation = '';
      if (Math.abs(contrib) > 0.05) {
        if (contrib > 0) {
          explanation = `${featureLabels[j]} (${x[j]}) increases risk by approx ${Math.abs(ppDelta).toFixed(1)} percentage points.`;
        } else {
          explanation = `${featureLabels[j]} (${x[j]}) helps protect customer, reducing risk by approx ${Math.abs(ppDelta).toFixed(1)} percentage points.`;
        }
      }

      contributions.push({
        feature: featureNames[j],
        label: featureLabels[j],
        value: x[j],
        contribution: contrib,
        percentagePointsDelta: ppDelta,
        explanation
      });
    }

    return contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  }
}

// =========================================================================
// 2. DECISION TREE (Binary Classification CART)
// =========================================================================
interface TreeNode {
  isLeaf: boolean;
  prediction: number; // probability of class 1
  featureIndex?: number;
  splitThreshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  sampleCount: number;
}

export class DecisionTreeModel {
  root: TreeNode | null = null;
  maxDepth: number = 5;
  minSamplesSplit: number = 10;

  fit(
    X: number[][],
    y: number[],
    params: { maxDepth?: number; minSamplesSplit?: number; rng?: () => number } = {}
  ) {
    this.maxDepth = params.maxDepth ?? 5;
    this.minSamplesSplit = params.minSamplesSplit ?? 10;
    const indices = Array.from({ length: X.length }, (_, i) => i);
    this.root = this.buildTree(X, y, indices, 0);
  }

  private buildTree(X: number[][], y: number[], indices: number[], depth: number): TreeNode {
    const numSamples = indices.length;
    let posCount = 0;
    for (const idx of indices) if (y[idx] === 1) posCount++;
    const prob = numSamples > 0 ? posCount / numSamples : 0;

    // Stop conditions
    if (depth >= this.maxDepth || numSamples < this.minSamplesSplit || posCount === 0 || posCount === numSamples) {
      return { isLeaf: true, prediction: prob, sampleCount: numSamples };
    }

    const numFeatures = X[0].length;
    let bestGini = Infinity;
    let bestFeature = -1;
    let bestThreshold = 0;
    let bestLeftIndices: number[] = [];
    let bestRightIndices: number[] = [];

    // Evaluate splits
    for (let f = 0; f < numFeatures; f++) {
      const vals = indices.map(i => X[i][f]);
      vals.sort((a, b) => a - b);

      // Candidate split percentiles
      const step = Math.max(1, Math.floor(vals.length / 10));
      for (let s = step; s < vals.length; s += step) {
        const threshold = (vals[s - 1] + vals[s]) / 2;
        let leftPos = 0, leftTotal = 0;
        let rightPos = 0, rightTotal = 0;

        for (const idx of indices) {
          if (X[idx][f] <= threshold) {
            leftTotal++;
            if (y[idx] === 1) leftPos++;
          } else {
            rightTotal++;
            if (y[idx] === 1) rightPos++;
          }
        }

        if (leftTotal < 4 || rightTotal < 4) continue;

        const pL = leftPos / leftTotal;
        const giniL = 1 - (pL * pL + (1 - pL) * (1 - pL));
        const pR = rightPos / rightTotal;
        const giniR = 1 - (pR * pR + (1 - pR) * (1 - pR));
        const weightedGini = (leftTotal * giniL + rightTotal * giniR) / numSamples;

        if (weightedGini < bestGini) {
          bestGini = weightedGini;
          bestFeature = f;
          bestThreshold = threshold;
        }
      }
    }

    if (bestFeature === -1) {
      return { isLeaf: true, prediction: prob, sampleCount: numSamples };
    }

    for (const idx of indices) {
      if (X[idx][bestFeature] <= bestThreshold) {
        bestLeftIndices.push(idx);
      } else {
        bestRightIndices.push(idx);
      }
    }

    return {
      isLeaf: false,
      prediction: prob,
      featureIndex: bestFeature,
      splitThreshold: bestThreshold,
      sampleCount: numSamples,
      left: this.buildTree(X, y, bestLeftIndices, depth + 1),
      right: this.buildTree(X, y, bestRightIndices, depth + 1)
    };
  }

  predictProba(x: number[]): number {
    let curr = this.root;
    while (curr && !curr.isLeaf) {
      if (x[curr.featureIndex!] <= curr.splitThreshold!) {
        curr = curr.left!;
      } else {
        curr = curr.right!;
      }
    }
    return curr ? curr.prediction : 0.5;
  }
}

// =========================================================================
// 3. RANDOM FOREST (Bagged Trees with Feature Subsampling)
// =========================================================================
export class RandomForestModel {
  trees: DecisionTreeModel[] = [];
  numTrees: number = 25;

  fit(
    X: number[][],
    y: number[],
    params: { numTrees?: number; maxDepth?: number; rng?: () => number } = {}
  ) {
    this.numTrees = params.numTrees ?? 25;
    const maxDepth = params.maxDepth ?? 5;
    const rng = params.rng ?? Math.random;
    const n = X.length;

    this.trees = [];
    for (let t = 0; t < this.numTrees; t++) {
      // Bootstrap sample
      const bootX: number[][] = [];
      const bootY: number[] = [];
      for (let i = 0; i < n; i++) {
        const randIdx = Math.floor(rng() * n);
        bootX.push(X[randIdx]);
        bootY.push(y[randIdx]);
      }

      const tree = new DecisionTreeModel();
      tree.fit(bootX, bootY, { maxDepth, rng });
      this.trees.push(tree);
    }
  }

  predictProba(x: number[]): number {
    if (!this.trees.length) return 0.5;
    let sum = 0;
    for (const tree of this.trees) {
      sum += tree.predictProba(x);
    }
    return sum / this.trees.length;
  }
}

// =========================================================================
// 4. GRADIENT BOOSTED TREES (Regression Trees on Log-Loss Pseudo-Residuals)
// =========================================================================
interface RegressionNode {
  isLeaf: boolean;
  value: number; // leaf adjustment
  featureIndex?: number;
  splitThreshold?: number;
  left?: RegressionNode;
  right?: RegressionNode;
}

class RegressionTree {
  root: RegressionNode | null = null;

  fit(X: number[][], residuals: number[], maxDepth: number = 3) {
    const indices = Array.from({ length: X.length }, (_, i) => i);
    this.root = this.buildNode(X, residuals, indices, 0, maxDepth);
  }

  private buildNode(
    X: number[][],
    residuals: number[],
    indices: number[],
    depth: number,
    maxDepth: number
  ): RegressionNode {
    const numSamples = indices.length;
    let sum = 0;
    for (const idx of indices) sum += residuals[idx];
    const mean = numSamples > 0 ? sum / numSamples : 0;

    if (depth >= maxDepth || numSamples < 8) {
      return { isLeaf: true, value: mean };
    }

    const numFeatures = X[0].length;
    let bestVar = Infinity;
    let bestFeature = -1;
    let bestThreshold = 0;

    for (let f = 0; f < numFeatures; f++) {
      const vals = indices.map(i => X[i][f]);
      vals.sort((a, b) => a - b);
      const step = Math.max(1, Math.floor(vals.length / 8));

      for (let s = step; s < vals.length; s += step) {
        const threshold = (vals[s - 1] + vals[s]) / 2;
        let leftSum = 0, leftCount = 0;
        let rightSum = 0, rightCount = 0;

        for (const idx of indices) {
          if (X[idx][f] <= threshold) {
            leftSum += residuals[idx];
            leftCount++;
          } else {
            rightSum += residuals[idx];
            rightCount++;
          }
        }

        if (leftCount < 3 || rightCount < 3) continue;

        const leftMean = leftSum / leftCount;
        const rightMean = rightSum / rightCount;
        let sse = 0;
        for (const idx of indices) {
          const pred = X[idx][f] <= threshold ? leftMean : rightMean;
          sse += Math.pow(residuals[idx] - pred, 2);
        }

        if (sse < bestVar) {
          bestVar = sse;
          bestFeature = f;
          bestThreshold = threshold;
        }
      }
    }

    if (bestFeature === -1) {
      return { isLeaf: true, value: mean };
    }

    const leftIdx = indices.filter(i => X[i][bestFeature] <= bestThreshold);
    const rightIdx = indices.filter(i => X[i][bestFeature] > bestThreshold);

    return {
      isLeaf: false,
      value: mean,
      featureIndex: bestFeature,
      splitThreshold: bestThreshold,
      left: this.buildNode(X, residuals, leftIdx, depth + 1, maxDepth),
      right: this.buildNode(X, residuals, rightIdx, depth + 1, maxDepth)
    };
  }

  predict(x: number[]): number {
    let curr = this.root;
    while (curr && !curr.isLeaf) {
      if (x[curr.featureIndex!] <= curr.splitThreshold!) {
        curr = curr.left!;
      } else {
        curr = curr.right!;
      }
    }
    return curr ? curr.value : 0;
  }
}

export class GradientBoostingModel {
  initialLogOdds: number = 0;
  trees: RegressionTree[] = [];
  learningRate: number = 0.1;
  featureMeans: number[] = [];

  fit(
    X: number[][],
    y: number[],
    params: { numTrees?: number; maxDepth?: number; learningRate?: number } = {}
  ) {
    const numTrees = params.numTrees ?? 30;
    const maxDepth = params.maxDepth ?? 3;
    this.learningRate = params.learningRate ?? 0.1;

    const n = X.length;
    let posCount = 0;
    for (let i = 0; i < n; i++) if (y[i] === 1) posCount++;
    const p0 = Math.max(0.01, Math.min(0.99, posCount / n));
    this.initialLogOdds = Math.log(p0 / (1 - p0));

    // Store feature means for SHAP / attribution baseline
    const numFeatures = X[0].length;
    this.featureMeans = new Array(numFeatures).fill(0);
    for (let j = 0; j < numFeatures; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += X[i][j];
      this.featureMeans[j] = sum / n;
    }

    // Current raw log-odds predictions
    const rawScores = new Array(n).fill(this.initialLogOdds);

    this.trees = [];
    for (let t = 0; t < numTrees; t++) {
      // Compute negative log-loss gradients: residual = y_i - p_i
      const residuals = new Array(n);
      for (let i = 0; i < n; i++) {
        const p = sigmoid(rawScores[i]);
        residuals[i] = y[i] - p;
      }

      const tree = new RegressionTree();
      tree.fit(X, residuals, maxDepth);

      // Update scores
      for (let i = 0; i < n; i++) {
        rawScores[i] += this.learningRate * tree.predict(X[i]);
      }
      this.trees.push(tree);
    }
  }

  predictRaw(x: number[]): number {
    let score = this.initialLogOdds;
    for (const tree of this.trees) {
      score += this.learningRate * tree.predict(x);
    }
    return score;
  }

  predictProba(x: number[]): number {
    return sigmoid(this.predictRaw(x));
  }

  // Feature attribution: marginal log-odds contribution per feature vs mean baseline
  explain(x: number[], featureNames: string[], featureLabels: string[]): LocalDriverContribution[] {
    const pBaseline = sigmoid(this.initialLogOdds);
    const contributions: LocalDriverContribution[] = [];

    // Marginal contribution per feature by substituting mean feature baseline
    const baseRaw = this.predictRaw(x);

    for (let j = 0; j < x.length; j++) {
      const occludedX = [...x];
      occludedX[j] = this.featureMeans[j];
      const occludedRaw = this.predictRaw(occludedX);
      const deltaLogOdds = baseRaw - occludedRaw;

      const pWith = sigmoid(this.initialLogOdds + deltaLogOdds);
      const ppDelta = Math.round((pWith - pBaseline) * 1000) / 10;

      let explanation = '';
      if (Math.abs(deltaLogOdds) > 0.04) {
        if (deltaLogOdds > 0) {
          explanation = `${featureLabels[j]} (${x[j]}) contributes to heightened risk (+${Math.abs(ppDelta).toFixed(1)} percentage points).`;
        } else {
          explanation = `${featureLabels[j]} (${x[j]}) acts as a protective factor (-${Math.abs(ppDelta).toFixed(1)} percentage points).`;
        }
      }

      contributions.push({
        feature: featureNames[j],
        label: featureLabels[j],
        value: x[j],
        contribution: deltaLogOdds,
        percentagePointsDelta: ppDelta,
        explanation
      });
    }

    return contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  }
}

// =========================================================================
// 5. PROBABILITY CALIBRATION (Platt Scaling)
// =========================================================================
export function fitPlattCalibration(valScores: number[], valTargets: number[]): { a: number; b: number } {
  // Fit 1D logistic regression on valScores: P(y=1|s) = 1 / (1 + exp(A*s + B))
  let a = 1.0;
  let b = 0.0;
  const lr = 0.08;
  const n = valScores.length;

  for (let iter = 0; iter < 100; iter++) {
    let gradA = 0;
    let gradB = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid(a * valScores[i] + b);
      const err = p - valTargets[i];
      gradA += err * valScores[i];
      gradB += err;
    }
    a -= lr * (gradA / n);
    b -= lr * (gradB / n);
  }

  return { a, b };
}

export function applyCalibration(rawScore: number, cal: { a: number; b: number }): number {
  return sigmoid(cal.a * rawScore + cal.b);
}
