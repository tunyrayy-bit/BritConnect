/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Retention Playbook Page (Section 10: AI-Generated Structured Recommendations)
 */

import React, { useState } from 'react';
import {
  BookOpenCheck,
  Sparkles,
  ShieldAlert,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Download,
  Calendar,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  Megaphone,
  RefreshCw,
  FileText
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { RecommendationCardData, generateRecommendation } from '../../recommendations/engine';
import { exportTableToCsv, generateExecutivePdfReport } from '../../reports/engine';

export const RetentionPlaybook: React.FC = () => {
  const {
    companyRecommendation,
    customers,
    scores,
    championModel,
    ruleBasedSegments,
    campaigns,
    validationReport,
    setCurrentPage,
    setSelectedCustomerId
  } = useAppStore();

  const [activeLevel, setActiveLevel] = useState<'company' | 'segments' | 'queue'>('company');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>(ruleBasedSegments[0]?.id || '');
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active Retention Queue: Ranked by Churn Probability * Annual Revenue
  const activeQueue = React.useMemo(() => {
    return customers
      .filter(c => c.churnStatus !== 'Churned')
      .map(c => {
        const s = scores.find(sc => sc.customerId === c.customerId);
        const prob = s?.churnProbability || 0.15;
        const annualRev = c.monthlyChargeGbp * 12;
        const annualExposure = annualRev * prob;
        return {
          customer: c,
          score: s,
          prob,
          annualRev,
          annualExposure,
          priority: s?.priority || (prob >= 0.75 ? 'P1' : 'P2')
        };
      })
      .sort((a, b) => b.annualExposure - a.annualExposure);
  }, [customers, scores]);

  const handleCopyText = (card: RecommendationCardData) => {
    const text = `${card.headline}\nPriority: ${card.priority} (${card.priorityRationale})\nDiagnosis: ${card.diagnosis}\nActions:\n${card.actions.map(a => `- ${a.title}: ${a.description} (Target: ${a.kpis[0]?.target || ''})`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedId(card.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = (cardId: string, vote: 'up' | 'down') => {
    setFeedbackGiven(prev => ({ ...prev, [cardId]: vote }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A] font-editorial tracking-tight">
            Retention Playbook & Action Recommendations
          </h1>
          <p className="text-xs text-[#5B6678] mt-1 font-medium">
            Evidence-based retention strategies across company-wide programmes, operational segments, and ranked customer queue.
          </p>
        </div>

        <button
          onClick={() => {
            generateExecutivePdfReport(
              customers,
              scores,
              championModel,
              campaigns,
              ruleBasedSegments,
              validationReport
            );
          }}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] text-white text-xs font-semibold transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-[#C9A227]" />
          <span>Export Full Strategy PDF</span>
        </button>
      </div>

      {/* Level Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0]">
        <button
          onClick={() => setActiveLevel('company')}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeLevel === 'company'
              ? 'border-[#0B1F3A] text-[#0B1F3A]'
              : 'border-transparent text-[#5B6678] hover:text-[#0B1F3A]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-[#C9A227]" />
          <span>Company-Wide Strategic Plan</span>
        </button>
        <button
          onClick={() => setActiveLevel('segments')}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeLevel === 'segments'
              ? 'border-[#0B1F3A] text-[#0B1F3A]'
              : 'border-transparent text-[#5B6678] hover:text-[#0B1F3A]'
          }`}
        >
          <BookOpenCheck className="w-4 h-4" />
          <span>Segment-Specific Presets</span>
        </button>
        <button
          onClick={() => setActiveLevel('queue')}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeLevel === 'queue'
              ? 'border-[#0B1F3A] text-[#0B1F3A]'
              : 'border-transparent text-[#5B6678] hover:text-[#0B1F3A]'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-[#8B1A1A]" />
          <span>Prioritized Retention Queue ({activeQueue.length.toLocaleString()})</span>
        </button>
      </div>

      {/* LEVEL 1: COMPANY STRATEGY */}
      {activeLevel === 'company' && companyRecommendation && (
        <div className="space-y-6">
          {/* Main Card */}
          <div className="bg-white rounded-xl border border-[#0B1F3A] shadow-xs p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-[#8B1A1A] text-white">
                    {companyRecommendation.priority} (Act within 7 Days)
                  </span>
                  <span className="text-xs font-bold text-[#8A6E12] bg-[#C9A227]/15 px-2 py-0.5 rounded">
                    Confidence: {companyRecommendation.confidence}
                  </span>
                  <span className="text-[11px] text-[#5B6678]">
                    Generated {new Date(companyRecommendation.generatedAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-[#0B1F3A] mt-2 tracking-tight">
                  {companyRecommendation.headline}
                </h2>
                <p className="text-xs text-[#5B6678] mt-1 italic">
                  Rationale: {companyRecommendation.priorityRationale}
                </p>
              </div>

              {/* Feedback & Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyText(companyRecommendation)}
                  className="p-1.5 rounded-md border border-[#CBD5E1] text-[#5B6678] hover:text-[#0B1F3A]"
                  title="Copy recommendation text"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleFeedback(companyRecommendation.id, 'up')}
                  className={`p-1.5 rounded-md border border-[#CBD5E1] ${
                    feedbackGiven[companyRecommendation.id] === 'up' ? 'bg-[#E8EDF5] text-[#0B1F3A]' : 'text-[#5B6678]'
                  }`}
                  title="Helpful recommendation"
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleFeedback(companyRecommendation.id, 'down')}
                  className={`p-1.5 rounded-md border border-[#CBD5E1] ${
                    feedbackGiven[companyRecommendation.id] === 'down' ? 'bg-[#F3DCDC] text-[#8B1A1A]' : 'text-[#5B6678]'
                  }`}
                  title="Needs refinement"
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Diagnosis */}
            <div className="my-5 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <span className="text-[10px] font-bold text-[#5B6678] uppercase tracking-wider block mb-1">
                Diagnostic Grounding & Empirical Evidence
              </span>
              <p className="text-xs text-[#1B2433] leading-relaxed">
                {companyRecommendation.diagnosis}
              </p>
            </div>

            {/* Actions List (Section 10.2) */}
            <div className="space-y-5">
              <h3 className="text-sm font-bold text-[#0B1F3A]">
                Prescribed Interventions ({companyRecommendation.actions.length} Action Tracks)
              </h3>

              {companyRecommendation.actions.map((act, idx) => (
                <div key={idx} className="p-5 rounded-xl border border-[#E2E8F0] bg-white shadow-2xs">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <span className="text-[10px] font-bold text-[#C9A227] uppercase tracking-wider">
                        Track {idx + 1} · {act.timing}
                      </span>
                      <h4 className="text-sm font-bold text-[#0B1F3A] mt-0.5">{act.title}</h4>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-[#E8EDF5] text-[#0B1F3A] text-xs font-semibold">
                      Channel: {act.channel}
                    </span>
                  </div>

                  <p className="text-xs text-[#1B2433] leading-relaxed my-2">{act.description}</p>

                  {/* Steps & Guardrails */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs bg-[#F8FAFC] p-3 rounded-lg border border-[#F1F5F9]">
                    <div>
                      <span className="font-bold text-[#0B1F3A] block mb-1 text-[11px]">Implementation Steps:</span>
                      <ul className="space-y-1 text-[#5B6678]">
                        {act.implementationSteps.map((step, sIdx) => (
                          <li key={sIdx}>{step}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-bold text-[#8B1A1A] block mb-1 text-[11px]">Eligibility & Margin Guardrails:</span>
                      <ul className="space-y-1 text-[#5B6678]">
                        {act.eligibilityGuardrails.map((g, gIdx) => (
                          <li key={gIdx}>• {g}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Expected Impact & Assumptions Formula (Section 10.2) */}
                  <div className="mt-4 pt-3 border-t border-[#F1F5F9] grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                    <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                      <span className="text-[#5B6678] block text-[10px]">Churn Reduction</span>
                      <span className="font-bold text-sm text-[#0B1F3A]">{act.expectedImpact.churnReductionPercentRange}</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                      <span className="text-[#5B6678] block text-[10px]">Saved Accounts</span>
                      <span className="font-bold text-sm text-[#0B1F3A]">{act.expectedImpact.customersSavedEst}</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                      <span className="text-[#5B6678] block text-[10px]">Annual Protected</span>
                      <span className="font-bold text-sm text-[#8A6E12]">£{act.expectedImpact.annualRevenueProtectedGbp.toLocaleString()}</span>
                    </div>
                    <div className="p-2 bg-white rounded border border-[#E2E8F0]">
                      <span className="text-[#5B6678] block text-[10px]">Est. Net Benefit</span>
                      <span className="font-bold text-sm text-[#C9A227]">£{act.expectedImpact.netBenefitGbp.toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#5B6678] mt-2 italic text-center">
                    {act.expectedImpact.assumptionsFormula}
                  </p>
                </div>
              ))}
            </div>

            {/* 30/60/90 Day Roadmap */}
            <div className="mt-6 pt-5 border-t border-[#F1F5F9]">
              <h3 className="text-sm font-bold text-[#0B1F3A] mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#C9A227]" />
                30 / 60 / 90-Day Implementation Roadmap
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-3.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC]">
                  <span className="font-bold text-[#0B1F3A] block mb-1 text-xs">Day 1 – 30 (Immediate)</span>
                  <p className="text-[#5B6678] leading-relaxed">{companyRecommendation.roadmap.day30}</p>
                </div>
                <div className="p-3.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC]">
                  <span className="font-bold text-[#0B1F3A] block mb-1 text-xs">Day 31 – 60 (Expansion)</span>
                  <p className="text-[#5B6678] leading-relaxed">{companyRecommendation.roadmap.day60}</p>
                </div>
                <div className="p-3.5 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC]">
                  <span className="font-bold text-[#0B1F3A] block mb-1 text-xs">Day 61 – 90 (Review & Scale)</span>
                  <p className="text-[#5B6678] leading-relaxed">{companyRecommendation.roadmap.day90}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEVEL 2: SEGMENT PLAYBOOK */}
      {activeLevel === 'segments' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5B6678]">Select Target Operational Segment:</span>
            <select
              value={selectedSegmentId}
              onChange={(e) => setSelectedSegmentId(e.target.value)}
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] outline-none"
            >
              {ruleBasedSegments.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.customerCount} accounts)</option>
              ))}
            </select>
          </div>

          {/* Render selected segment action card */}
          {ruleBasedSegments.filter(s => s.id === selectedSegmentId).map(seg => (
            <div key={seg.id} className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#0B1F3A]">{seg.name}</h3>
                  <p className="text-xs text-[#5B6678] mt-0.5">{seg.description}</p>
                </div>
                <span className="px-3 py-1 rounded bg-[#E8EDF5] text-[#0B1F3A] text-xs font-bold">
                  {seg.customerCount.toLocaleString()} Accounts
                </span>
              </div>

              <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-xs text-[#1B2433]">
                <span className="font-bold text-[#8A6E12] block mb-1 text-[11px]">Recommended Playbook Action:</span>
                <p className="leading-relaxed">{seg.suggestedAction}</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9]">
                <span className="text-xs text-[#5B6678]">
                  Monthly revenue at stake: <strong>£{seg.monthlyRevenueAtRiskGbp.toLocaleString()}</strong>
                </span>
                <button
                  onClick={() => setCurrentPage('campaigns')}
                  className="px-3.5 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Megaphone className="w-3.5 h-3.5 text-[#C9A227]" />
                  <span>Deploy Campaign to this Cohort</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LEVEL 3: RANKED RETENTION QUEUE */}
      {activeLevel === 'queue' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#0B1F3A]">
                Ranked Retention Queue: Top High-Exposure Accounts
              </h3>
              <p className="text-xs text-[#5B6678] mt-0.5">
                Active subscribers ranked strictly by (Churn Probability × Annual Subscription Value).
              </p>
            </div>

            <button
              onClick={() => {
                const data = activeQueue.map(q => ({
                  'Customer ID': q.customer.customerId,
                  'Segment': q.customer.customerSegment,
                  'Contract': q.customer.contractType,
                  'Monthly Charge (£)': q.customer.monthlyChargeGbp,
                  'Churn Probability': `${(q.prob * 100).toFixed(1)}%`,
                  'Annual Exposure (£)': q.annualExposure.toFixed(2),
                  'Action': q.score?.recommendedAction || ''
                }));
                exportTableToCsv(data, 'BritConnect_Retention_Queue');
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-md border border-[#CBD5E1] text-xs font-semibold text-[#0B1F3A] hover:bg-[#F8FAFC]"
            >
              <Download className="w-3.5 h-3.5" /> Export Queue (CSV)
            </button>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFC] text-[#0B1F3A] font-semibold sticky top-0 border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5">Customer ID</th>
                  <th className="px-3 py-2.5">Segment</th>
                  <th className="px-3 py-2.5">Contract</th>
                  <th className="px-3 py-2.5">Monthly Charge</th>
                  <th className="px-3 py-2.5">Churn Risk</th>
                  <th className="px-3 py-2.5">Annual Risk (£)</th>
                  <th className="px-3 py-2.5">Recommended Next Action</th>
                  <th className="px-3 py-2.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {activeQueue.slice(0, 30).map((item, idx) => (
                  <tr key={idx} className="hover:bg-[#F8FAFC]">
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.priority === 'P1' ? 'bg-[#F3DCDC] text-[#8B1A1A]' : 'bg-[#E8EDF5] text-[#0B1F3A]'
                      }`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-code font-bold text-[#0B1F3A]">{item.customer.customerId}</td>
                    <td className="px-3 py-2.5 text-[#5B6678]">{item.customer.customerSegment}</td>
                    <td className="px-3 py-2.5 text-[#5B6678]">{item.customer.contractType}</td>
                    <td className="px-3 py-2.5 font-semibold text-[#1B2433]">£{item.customer.monthlyChargeGbp.toFixed(2)}</td>
                    <td className="px-3 py-2.5 font-bold text-[#8B1A1A]">{(item.prob * 100).toFixed(0)}%</td>
                    <td className="px-3 py-2.5 font-bold text-[#8B1A1A]">£{item.annualExposure.toFixed(0)}</td>
                    <td className="px-3 py-2.5 text-[#1B2433] max-w-xs truncate">{item.score?.recommendedAction || 'Outbound loyalty renewal call'}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => {
                          setSelectedCustomerId(item.customer.customerId);
                          setCurrentPage('customers');
                        }}
                        className="px-2.5 py-1 rounded bg-[#0B1F3A] text-white text-[10px] font-semibold hover:bg-[#14305C]"
                      >
                        Inspect
                      </button>
                    </td>
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
