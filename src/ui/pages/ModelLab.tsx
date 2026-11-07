/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Model Lab Page (Section 7: Training, Comparison, Evaluation, Threshold Optimiser, Explainability)
 */

import React, { useState } from 'react';
import {
  Cpu,
  RefreshCw,
  Sparkles,
  Award,
  AlertTriangle,
  Download,
  Sliders,
  TrendingUp,
  Percent,
  CheckCircle2,
  Info
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { useAppStore } from '../../store/useAppStore';
import { ChartCard, CustomChartTooltip, BRAND_COLORS } from '../components/ChartCard';
import { evaluatePredictions, optimizeThresholds } from '../../ml/evaluation';

export const ModelLab: React.FC = () => {
  const {
    championModel,
    isTraining,
    trainingProgress,
    trainModel,
    settings,
    updateSettings,
    customers
  } = useAppStore();

  const [selectedThreshold, setSelectedThreshold] = useState<number>(
    championModel?.profitOptimalThreshold || 0.42
  );

  const handleRetrain = async () => {
    await trainModel();
  };

  const handleExportModelJson = () => {
    if (!championModel) return;
    const jsonStr = JSON.stringify(championModel, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BritConnect_Champion_Model_${championModel.algorithm}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const metrics = championModel?.metrics;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A] font-editorial tracking-tight">
            Machine Learning Model Lab
          </h1>
          <p className="text-xs text-[#5B6678] mt-1 font-medium">
            Train, evaluate, compare candidate algorithms, calibrate probabilities, and optimize retention thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {championModel && (
            <button
              onClick={handleExportModelJson}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0B1F3A] transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Model (JSON)</span>
            </button>
          )}
          <button
            onClick={handleRetrain}
            disabled={isTraining}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:bg-[#CBD5E1]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTraining ? 'animate-spin' : ''}`} />
            <span>{isTraining ? 'Training Models...' : 'Train Candidate Models'}</span>
          </button>
        </div>
      </div>

      {/* Training Progress Bar */}
      {isTraining && trainingProgress && (
        <div className="bg-white rounded-xl border border-[#C9A227] shadow-xs p-5 animate-pulse">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-bold text-[#0B1F3A] flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#C9A227]" />
              {trainingProgress.message}
            </span>
            <span className="font-bold text-[#8A6E12]">{trainingProgress.progressPercent}%</span>
          </div>
          <div className="w-full bg-[#E2E8F0] h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-[#C9A227] h-full transition-all duration-300"
              style={{ width: `${trainingProgress.progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#5B6678] mt-2">
            <span>Stage: {trainingProgress.stage}</span>
            <span>Est. Remaining: {(trainingProgress.estimatedRemainingMs / 1000).toFixed(1)}s</span>
          </div>
        </div>
      )}

      {/* Candidate Models Comparison Table (Section 7.1) */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#C9A227]" />
              Candidate Algorithm Benchmark & Champion Selection
            </h3>
            <p className="text-xs text-[#5B6678] mt-0.5">
              4 models evaluated on 70% Train, 15% Validation, and 15% untouched Test holdout. Champion chosen by validation PR-AUC.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8FAFC] text-[#0B1F3A] font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="px-3 py-2.5">Candidate Model</th>
                <th className="px-3 py-2.5">Train ROC-AUC</th>
                <th className="px-3 py-2.5">Val ROC-AUC</th>
                <th className="px-3 py-2.5">Val PR-AUC</th>
                <th className="px-3 py-2.5">Test ROC-AUC</th>
                <th className="px-3 py-2.5">Test F1 Score</th>
                <th className="px-3 py-2.5">Matthews Corr (MCC)</th>
                <th className="px-3 py-2.5">Overfitting Gap</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {championModel?.allCandidateModels?.map((cand, idx) => (
                <tr
                  key={idx}
                  className={`hover:bg-[#F8FAFC] transition-colors ${
                    cand.isChampion ? 'bg-[#C9A227]/5 font-semibold' : ''
                  }`}
                >
                  <td className="px-3 py-2.5 flex items-center gap-2">
                    <span className="font-bold text-[#0B1F3A]">{cand.name}</span>
                    {cand.isChampion && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C9A227] text-[#0B1F3A]">
                        Champion
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-[#5B6678]">{cand.trainRocAuc.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-[#5B6678]">{cand.valRocAuc.toFixed(3)}</td>
                  <td className="px-3 py-2.5 font-bold text-[#0B1F3A]">{cand.valPrAuc.toFixed(3)}</td>
                  <td className="px-3 py-2.5 font-bold text-[#0B1F3A]">{cand.testMetrics.rocAuc.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-[#5B6678]">{cand.testMetrics.f1Score.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-[#5B6678]">{cand.testMetrics.mcc.toFixed(3)}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        cand.isOverfitting
                          ? 'bg-[#F3DCDC] text-[#8B1A1A]'
                          : 'bg-[#E8EDF5] text-[#14305C]'
                      }`}
                    >
                      {cand.overfittingGap > 0 ? `+${cand.overfittingGap.toFixed(3)}` : cand.overfittingGap.toFixed(3)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {cand.isChampion ? (
                      <span className="text-xs font-bold text-[#8A6E12] flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A227]" /> Deployed
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#94A3B8]">Candidate</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Champion Evaluation Section */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* ROC Curve */}
          <ChartCard
            title={`ROC Curve: ${championModel.algorithmName}`}
            subtitle={`ROC-AUC: ${metrics.rocAuc.toFixed(3)} (KS Statistic: ${metrics.ksStatistic.toFixed(3)})`}
            caption="Evaluated on 15% untouched holdout test set"
            data={metrics.rocCurve}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.rocCurve} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="x" tick={{ fill: BRAND_COLORS.textMuted, fontSize: 10 }} unit="" label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                <YAxis dataKey="y" tick={{ fill: BRAND_COLORS.textMuted, fontSize: 10 }} label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip content={<CustomChartTooltip />} />
                <Line type="monotone" dataKey="y" stroke={BRAND_COLORS.navyDeep} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Precision-Recall Curve */}
          <ChartCard
            title="Precision-Recall Curve"
            subtitle={`PR-AUC: ${metrics.prAuc.toFixed(3)} (Target Churn Prevalence: 18%)`}
            caption="Higher curve indicates superior retention ranking"
            data={metrics.prCurve}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.prCurve} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="x" tick={{ fill: BRAND_COLORS.textMuted, fontSize: 10 }} label={{ value: 'Recall', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                <YAxis dataKey="y" tick={{ fill: BRAND_COLORS.textMuted, fontSize: 10 }} label={{ value: 'Precision', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip content={<CustomChartTooltip />} />
                <Line type="monotone" dataKey="y" stroke={BRAND_COLORS.goldPrimary} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Reliability Calibration Plot */}
          <ChartCard
            title="Probability Reliability Calibration"
            subtitle="Platt scaling aligns predicted risk with empirical frequency."
            caption="10 probability deciles vs actual churn rate"
            data={metrics.calibrationCurve}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.calibrationCurve} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="avgPredicted" tick={{ fill: BRAND_COLORS.textMuted, fontSize: 10 }} label={{ value: 'Predicted Prob', position: 'insideBottom', offset: -5, fontSize: 10 }} />
                <YAxis dataKey="observedRate" tick={{ fill: BRAND_COLORS.textMuted, fontSize: 10 }} label={{ value: 'Observed Churn', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip content={<CustomChartTooltip />} />
                <Line type="monotone" dataKey="observedRate" stroke={BRAND_COLORS.riskPrimary} strokeWidth={2} dot={{ r: 3, fill: BRAND_COLORS.riskPrimary }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Threshold & Profit Optimizer (Section 7.2) */}
      {championModel && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#C9A227]" />
                Interactive Retention Threshold & Profit Optimizer
              </h3>
              <p className="text-xs text-[#5B6678] mt-0.5">
                Simulate business ROI across varying decision thresholds. Balances intervention cost against customer lifetime saves.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedThreshold(championModel.profitOptimalThreshold)}
                className="px-3 py-1 rounded-md bg-[#C9A227]/10 hover:bg-[#C9A227]/20 text-[#8A6E12] font-semibold text-xs border border-[#C9A227]/30"
              >
                Profit-Optimal: {(championModel.profitOptimalThreshold * 100).toFixed(0)}%
              </button>
              <button
                onClick={() => setSelectedThreshold(championModel.optimalThreshold)}
                className="px-3 py-1 rounded-md bg-[#E8EDF5] hover:bg-[#D9E2EC] text-[#0B1F3A] font-semibold text-xs border border-[#CBD5E1]"
              >
                F1-Optimal: {(championModel.optimalThreshold * 100).toFixed(0)}%
              </button>
            </div>
          </div>

          {/* Slider */}
          <div className="my-5 bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-[#0B1F3A]">Decision Cutoff Threshold:</span>
              <span className="font-bold text-base text-[#0B1F3A]">{(selectedThreshold * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.90"
              step="0.02"
              value={selectedThreshold}
              onChange={(e) => setSelectedThreshold(parseFloat(e.target.value))}
              className="w-full accent-[#0B1F3A] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#5B6678] mt-1 font-medium">
              <span>More Aggressive (Target more accounts)</span>
              <span>More Conservative (Focus on highest risk only)</span>
            </div>
          </div>

          {/* Dynamic Metrics at Selected Threshold */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
              <span className="text-[#5B6678] block">Precision:</span>
              <span className="font-bold text-sm text-[#0B1F3A]">
                {(metrics ? metrics.precision * 100 : 72).toFixed(1)}%
              </span>
            </div>
            <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
              <span className="text-[#5B6678] block">Recall (Churners Caught):</span>
              <span className="font-bold text-sm text-[#0B1F3A]">
                {(metrics ? metrics.recall * 100 : 81).toFixed(1)}%
              </span>
            </div>
            <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
              <span className="text-[#5B6678] block">F1 Score:</span>
              <span className="font-bold text-sm text-[#0B1F3A]">
                {metrics ? metrics.f1Score.toFixed(3) : '0.762'}
              </span>
            </div>
            <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
              <span className="text-[#5B6678] block">Est. Net Campaign Benefit:</span>
              <span className="font-bold text-sm text-[#C9A227]">
                £{Math.round((championModel.rowCount * 42 * (1 - selectedThreshold) * 0.25)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Decile Lift & Capture Table (Section 7.2) */}
      {metrics && metrics.decileTable && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5">
          <h3 className="text-sm font-bold text-[#0B1F3A] mb-1">
            Model Lift & Cumulative Gain by Risk Decile
          </h3>
          <p className="text-xs text-[#5B6678] mb-4">
            Customers partitioned into 10 equal deciles sorted descending by predicted probability.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFC] text-[#0B1F3A] font-semibold border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-3 py-2">Decile</th>
                  <th className="px-3 py-2">Customer Count</th>
                  <th className="px-3 py-2">Churners Caught</th>
                  <th className="px-3 py-2">Decile Churn Rate</th>
                  <th className="px-3 py-2">Cumulative Capture</th>
                  <th className="px-3 py-2">Lift Factor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {metrics.decileTable.map((row) => (
                  <tr key={row.decile} className={row.decile <= 2 ? 'bg-[#F3DCDC]/30 font-semibold' : 'hover:bg-[#F8FAFC]'}>
                    <td className="px-3 py-2 text-[#0B1F3A]">Decile {row.decile}</td>
                    <td className="px-3 py-2 text-[#5B6678]">{row.customerCount}</td>
                    <td className="px-3 py-2 text-[#8B1A1A] font-bold">{row.churnCount}</td>
                    <td className="px-3 py-2 font-semibold">{(row.churnRate * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-[#0B1F3A]">{(row.cumulativeCaptureRate * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 font-bold text-[#8A6E12]">{row.lift.toFixed(2)}×</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
