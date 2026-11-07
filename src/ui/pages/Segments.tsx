/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Customer Segmentation Page (Section 8: Risk x Value Matrix, K-Means Clustering, 8 Presets)
 */

import React, { useState } from 'react';
import {
  PieChart as PieIcon,
  ShieldAlert,
  HeartHandshake,
  Wrench,
  CheckCircle,
  Megaphone,
  ArrowRight,
  Sliders,
  Download,
  Users
} from 'lucide-react';
import {
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
import { computeKMeansClusters } from '../../segmentation/engine';
import { exportTableToCsv } from '../../reports/engine';

export const Segments: React.FC = () => {
  const {
    ruleBasedSegments,
    riskValueMatrix,
    kMeansResult,
    customers,
    scoresMap,
    setCurrentPage,
    setSelectedCustomerId
  } = useAppStore();

  const [kClusters, setKClusters] = useState<number>(4);
  const [activeSegmentTab, setActiveSegmentTab] = useState<'matrix' | 'presets' | 'kmeans'>('matrix');

  // Compute live KMeans if k changes
  const currentKMeans = React.useMemo(() => {
    return computeKMeansClusters(customers, scoresMap, kClusters);
  }, [customers, scoresMap, kClusters]);

  // Comparison data: Segment Churn Rate vs Baseline
  const baselineChurn = 18.0;
  const segmentComparisonData = ruleBasedSegments.map(s => ({
    name: s.name.length > 22 ? s.name.substring(0, 20) + '...' : s.name,
    fullName: s.name,
    churnRate: Math.round(s.observedChurnRate * 1000) / 10,
    riskRate: Math.round(s.avgPredictedRisk * 1000) / 10,
    customerCount: s.customerCount
  }));

  const handleExportSegments = () => {
    const data = ruleBasedSegments.map(s => ({
      'Segment Name': s.name,
      'Quadrant': s.quadrant || 'General',
      'Customer Count': s.customerCount,
      'Share of Base (%)': `${(s.shareOfBase * 100).toFixed(1)}%`,
      'Observed Churn (%)': `${(s.observedChurnRate * 100).toFixed(1)}%`,
      'Predicted Risk (%)': `${(s.avgPredictedRisk * 100).toFixed(1)}%`,
      'Monthly Revenue at Risk (£)': s.monthlyRevenueAtRiskGbp,
      'Suggested Action': s.suggestedAction
    }));
    exportTableToCsv(data, 'BritConnect_Customer_Segments');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A] font-editorial tracking-tight">
            Customer Segmentation & Strategic Cohorts
          </h1>
          <p className="text-xs text-[#5B6678] mt-1 font-medium">
            Multi-dimensional risk-value matrix, behavioral k-means clustering, and 8 rule-based retention cohorts.
          </p>
        </div>

        <button
          onClick={handleExportSegments}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0B1F3A] transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Segments (CSV)</span>
        </button>
      </div>

      {/* Segment Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0]">
        <button
          onClick={() => setActiveSegmentTab('matrix')}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeSegmentTab === 'matrix'
              ? 'border-[#0B1F3A] text-[#0B1F3A]'
              : 'border-transparent text-[#5B6678] hover:text-[#0B1F3A]'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-[#8B1A1A]" />
          <span>Risk × Value Matrix</span>
        </button>
        <button
          onClick={() => setActiveSegmentTab('presets')}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeSegmentTab === 'presets'
              ? 'border-[#0B1F3A] text-[#0B1F3A]'
              : 'border-transparent text-[#5B6678] hover:text-[#0B1F3A]'
          }`}
        >
          <PieIcon className="w-4 h-4 text-[#C9A227]" />
          <span>8 Rule-Based Presets</span>
        </button>
        <button
          onClick={() => setActiveSegmentTab('kmeans')}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeSegmentTab === 'kmeans'
              ? 'border-[#0B1F3A] text-[#0B1F3A]'
              : 'border-transparent text-[#5B6678] hover:text-[#0B1F3A]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>K-Means Behavioral Clusters (k={kClusters})</span>
        </button>
      </div>

      {/* VIEW 1: RISK X VALUE MATRIX (Section 8) */}
      {activeSegmentTab === 'matrix' && riskValueMatrix && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Quadrant 1: Protect Now */}
            <div className="bg-white p-5 rounded-xl border border-[#8B1A1A]/30 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-1 rounded text-xs font-bold bg-[#8B1A1A] text-white flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Protect Now (High Value, High Risk)
                </span>
                <span className="text-xs font-bold text-[#8B1A1A]">
                  {riskValueMatrix.quadrants.protect_now.percentOfTotal}% of Base
                </span>
              </div>
              <p className="text-xs text-[#5B6678] mt-1">
                {riskValueMatrix.quadrants.protect_now.description}
              </p>
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Customers</span>
                  <span className="font-bold text-[#0B1F3A] text-sm">
                    {riskValueMatrix.quadrants.protect_now.customerCount}
                  </span>
                </div>
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Avg Churn Prob</span>
                  <span className="font-bold text-[#8B1A1A] text-sm">
                    {(riskValueMatrix.quadrants.protect_now.avgChurnRisk * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Monthly Risk</span>
                  <span className="font-bold text-[#8B1A1A] text-sm">
                    £{riskValueMatrix.quadrants.protect_now.monthlyRevenueAtRisk.toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCurrentPage('campaigns')}
                className="mt-4 w-full py-2 rounded-lg bg-[#8B1A1A] hover:bg-[#6D1414] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Megaphone className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>Launch Retention Blitz for Protect Now Cohort</span>
              </button>
            </div>

            {/* Quadrant 2: Nurture & Grow */}
            <div className="bg-white p-5 rounded-xl border border-[#C9A227]/40 shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-1 rounded text-xs font-bold bg-[#C9A227] text-[#0B1F3A] flex items-center gap-1.5">
                  <HeartHandshake className="w-3.5 h-3.5" /> Nurture & Grow (High Value, Low Risk)
                </span>
                <span className="text-xs font-bold text-[#8A6E12]">
                  {riskValueMatrix.quadrants.nurture.percentOfTotal}% of Base
                </span>
              </div>
              <p className="text-xs text-[#5B6678] mt-1">
                {riskValueMatrix.quadrants.nurture.description}
              </p>
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Customers</span>
                  <span className="font-bold text-[#0B1F3A] text-sm">
                    {riskValueMatrix.quadrants.nurture.customerCount}
                  </span>
                </div>
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Avg Churn Prob</span>
                  <span className="font-bold text-[#0B1F3A] text-sm">
                    {(riskValueMatrix.quadrants.nurture.avgChurnRisk * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Monthly Risk</span>
                  <span className="font-bold text-[#0B1F3A] text-sm">
                    £{riskValueMatrix.quadrants.nurture.monthlyRevenueAtRisk.toLocaleString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setCurrentPage('campaigns')}
                className="mt-4 w-full py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Megaphone className="w-3.5 h-3.5 text-[#C9A227]" />
                <span>Launch Loyalty VIP Campaign</span>
              </button>
            </div>

            {/* Quadrant 3: Triage */}
            <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-1 rounded text-xs font-bold bg-[#B23A3A] text-white flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" /> Triage / Low-Cost (Entry Value, High Risk)
                </span>
                <span className="text-xs font-bold text-[#5B6678]">
                  {riskValueMatrix.quadrants.triage.percentOfTotal}% of Base
                </span>
              </div>
              <p className="text-xs text-[#5B6678] mt-1">
                {riskValueMatrix.quadrants.triage.description}
              </p>
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Customers</span>
                  <span className="font-bold text-[#0B1F3A] text-sm">
                    {riskValueMatrix.quadrants.triage.customerCount}
                  </span>
                </div>
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Avg Churn Prob</span>
                  <span className="font-bold text-[#8B1A1A] text-sm">
                    {(riskValueMatrix.quadrants.triage.avgChurnRisk * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Monthly Risk</span>
                  <span className="font-bold text-[#8B1A1A] text-sm">
                    £{riskValueMatrix.quadrants.triage.monthlyRevenueAtRisk.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quadrant 4: Maintain & Automate */}
            <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-1 rounded text-xs font-bold bg-[#14305C] text-white flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#C9A227]" /> Maintain & Automate (Entry Value, Low Risk)
                </span>
                <span className="text-xs font-bold text-[#5B6678]">
                  {riskValueMatrix.quadrants.maintain.percentOfTotal}% of Base
                </span>
              </div>
              <p className="text-xs text-[#5B6678] mt-1">
                {riskValueMatrix.quadrants.maintain.description}
              </p>
              <div className="mt-4 pt-3 border-t border-[#F1F5F9] grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Customers</span>
                  <span className="font-bold text-[#0B1F3A] text-sm">
                    {riskValueMatrix.quadrants.maintain.customerCount}
                  </span>
                </div>
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Avg Churn Prob</span>
                  <span className="font-bold text-[#0B1F3A] text-sm">
                    {(riskValueMatrix.quadrants.maintain.avgChurnRisk * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="bg-[#F8FAFC] p-2 rounded">
                  <span className="text-[#5B6678] block text-[10px]">Monthly Risk</span>
                  <span className="font-bold text-[#0B1F3A] text-sm">
                    £{riskValueMatrix.quadrants.maintain.monthlyRevenueAtRisk.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: 8 RULE-BASED PRESETS */}
      {activeSegmentTab === 'presets' && (
        <div className="space-y-6">
          {/* Segment Comparison Chart */}
          <ChartCard
            title="Segment Churn Rate vs Company Average Baseline"
            subtitle="Observed churn across 8 predefined operational cohorts."
            caption="Baseline company average = 18.0%"
            data={segmentComparisonData}
            benchmarkValue={18.0}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={segmentComparisonData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: BRAND_COLORS.textMain, fontSize: 10 }} axisLine={{ stroke: BRAND_COLORS.borderSubtle }} tickLine={false} />
                <YAxis tick={{ fill: BRAND_COLORS.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<CustomChartTooltip unit="%" baseline={18.0} />} />
                <ReferenceLine y={18.0} stroke={BRAND_COLORS.goldPrimary} strokeDasharray="4 4" />
                <Bar dataKey="churnRate" fill={BRAND_COLORS.navyMid} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Presets Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ruleBasedSegments.map((seg) => (
              <div key={seg.id} className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="font-bold text-sm text-[#0B1F3A]">{seg.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8EDF5] text-[#0B1F3A]">
                      {seg.customerCount.toLocaleString()} accounts ({((seg.shareOfBase || 0.1) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6678] mb-3 leading-relaxed">{seg.description}</p>

                  <div className="p-3 bg-[#F8FAFC] rounded-lg border border-[#F1F5F9] grid grid-cols-3 gap-2 text-center text-xs mb-3">
                    <div>
                      <span className="text-[10px] text-[#5B6678] block">Observed Churn</span>
                      <span className="font-bold text-[#8B1A1A]">{(seg.observedChurnRate * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#5B6678] block">Predicted Risk</span>
                      <span className="font-bold text-[#0B1F3A]">{(seg.avgPredictedRisk * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#5B6678] block">Monthly Risk (£)</span>
                      <span className="font-bold text-[#8B1A1A]">£{seg.monthlyRevenueAtRiskGbp.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="text-xs text-[#1B2433] bg-[#C9A227]/10 p-2.5 rounded-lg border border-[#C9A227]/20">
                    <span className="font-bold text-[#8A6E12] block text-[11px]">Recommended Playbook Action:</span>
                    <span className="text-[11px] mt-0.5 block">{seg.suggestedAction}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F1F5F9] flex items-center justify-between">
                  <button
                    onClick={() => {
                      exportTableToCsv(
                        customers.filter(c => seg.customerIds.includes(c.customerId)),
                        `BritConnect_Segment_${seg.id}`
                      );
                    }}
                    className="text-xs text-[#5B6678] hover:text-[#0B1F3A] font-semibold flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Audience
                  </button>

                  <button
                    onClick={() => setCurrentPage('campaigns')}
                    className="px-3 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Megaphone className="w-3.5 h-3.5 text-[#C9A227]" />
                    <span>Create Campaign</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: K-MEANS BEHAVIORAL CLUSTERS */}
      {activeSegmentTab === 'kmeans' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#0B1F3A]">
                Unsupervised K-Means Behavioral Clustering (Lloyd's Algorithm)
              </h3>
              <p className="text-xs text-[#5B6678] mt-0.5">
                Standardized on monthly charge, tenure, data usage ratio, support tickets, and network outages.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[#5B6678]">Number of Clusters (k):</span>
              {[3, 4, 5, 6].map((num) => (
                <button
                  key={num}
                  onClick={() => setKClusters(num)}
                  className={`w-7 h-7 rounded-md font-bold transition-colors ${
                    kClusters === num ? 'bg-[#0B1F3A] text-white' : 'bg-[#F1F5F9] text-[#5B6678]'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {currentKMeans.clusters.map((cluster) => (
              <div key={cluster.clusterId} className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-sm text-[#0B1F3A]">{cluster.name}</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8EDF5] text-[#0B1F3A]">
                    {cluster.size.toLocaleString()} accounts ({cluster.share}%)
                  </span>
                </div>
                <p className="text-xs text-[#5B6678] mb-3">{cluster.dominantTrait}</p>

                <div className="grid grid-cols-4 gap-2 text-center text-xs bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  <div>
                    <span className="text-[10px] text-[#5B6678] block">Avg Risk</span>
                    <span className="font-bold text-[#8B1A1A]">{(cluster.avgRisk * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#5B6678] block">Avg Charge</span>
                    <span className="font-bold text-[#0B1F3A]">£{cluster.avgMonthlyCharge}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#5B6678] block">Avg Tenure</span>
                    <span className="font-bold text-[#0B1F3A]">{cluster.avgTenure}m</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#5B6678] block">Avg Outages</span>
                    <span className="font-bold text-[#0B1F3A]">{cluster.avgOutages}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
