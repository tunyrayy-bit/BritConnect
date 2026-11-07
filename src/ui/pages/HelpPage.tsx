/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Help, Methodology & Regulatory Limitations Page (Section 16 & 17)
 */

import React from 'react';
import {
  HelpCircle,
  BookOpen,
  ShieldAlert,
  Database,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { DATA_DICTIONARY } from '../../data/dictionary';

export const HelpPage: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0B1F3A] font-editorial tracking-tight">
          Platform Documentation, Methodology & Regulatory Principles
        </h1>
        <p className="text-xs text-[#5B6678] mt-1 font-medium">
          Comprehensive reference for the UK telecoms retention workflow, metric definitions, and limitations.
        </p>
      </div>

      {/* Honest Limitations & Governance (Section 17) */}
      <div className="bg-white rounded-xl border border-[#C9A227]/40 shadow-xs p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-[#8A6E12]" />
          <h2 className="text-base font-bold text-[#0B1F3A]">
            Core Limitations & Analytical Principles (Section 17)
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#1B2433]">
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
            <span className="font-bold text-[#0B1F3A] block">1. Probabilities vs Certainties</span>
            <p className="text-[#5B6678] leading-relaxed">
              Model scores represent calibrated empirical probabilities, not deterministic certainties. Business impact and revenue figures are projections based on declared assumptions.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
            <span className="font-bold text-[#0B1F3A] block">2. Causal Uplift vs Correlation</span>
            <p className="text-[#5B6678] leading-relaxed">
              Observational churn patterns are correlational. True causal retention impact is only demonstrated when evaluated against randomized control holdout groups via two-proportion z-testing.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
            <span className="font-bold text-[#0B1F3A] block">3. UK GDPR & Algorithmic Fairness</span>
            <p className="text-[#5B6678] leading-relaxed">
              Demographic variables (Gender, Age Band) are excluded from predictive scoring models by default to prevent proxy discrimination and uphold UK data minimisation standards.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
            <span className="font-bold text-[#0B1F3A] block">4. AI Grounding & Anti-Hallucination</span>
            <p className="text-[#5B6678] leading-relaxed">
              All quantitative figures are computed in deterministic TypeScript prior to narrative synthesis. The generative model never performs arithmetic on raw customer tables.
            </p>
          </div>
        </div>
      </div>

      {/* Recommended 5-Step Workflow */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-6 space-y-4">
        <h3 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#0B1F3A]" />
          Recommended 5-Step Retention Workflow
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="w-6 h-6 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-xs mb-2">1</span>
            <span className="font-bold text-[#0B1F3A] block">Ingest & Map</span>
            <p className="text-[#5B6678] mt-1 text-[11px]">Upload Excel, CSV, or JSON and audit data quality against canonical constraints.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="w-6 h-6 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-xs mb-2">2</span>
            <span className="font-bold text-[#0B1F3A] block">Train Models</span>
            <p className="text-[#5B6678] mt-1 text-[11px]">Compare 4 candidate models with 70/15/15 split and calibrate probabilities.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="w-6 h-6 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-xs mb-2">3</span>
            <span className="font-bold text-[#0B1F3A] block">Optimize Cutoff</span>
            <p className="text-[#5B6678] mt-1 text-[11px]">Use cost slider to identify profit-optimal threshold for outreach.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="w-6 h-6 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-xs mb-2">4</span>
            <span className="font-bold text-[#0B1F3A] block">Segment & Target</span>
            <p className="text-[#5B6678] mt-1 text-[11px]">Deploy targeted campaigns with 15% randomized control holdouts.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <span className="w-6 h-6 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-xs mb-2">5</span>
            <span className="font-bold text-[#0B1F3A] block">Track & Report</span>
            <p className="text-[#5B6678] mt-1 text-[11px]">Measure causal uplift, export executive PDF report, and update playbook.</p>
          </div>
        </div>
      </div>

      {/* Authoritative Data Dictionary Reference */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-6 space-y-3">
        <h3 className="text-base font-bold text-[#0B1F3A] flex items-center gap-2">
          <Database className="w-5 h-5 text-[#C9A227]" />
          Authoritative Data Dictionary (38 Canonical Attributes)
        </h3>
        <p className="text-xs text-[#5B6678]">
          BritConnect canonical schema. All validation, cleaning, and model feature matrices adhere to this schema.
        </p>

        <div className="overflow-x-auto max-h-96 border border-[#E2E8F0] rounded-lg mt-3">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8FAFC] text-[#0B1F3A] font-semibold sticky top-0 border-b border-[#E2E8F0]">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Column Name</th>
                <th className="px-3 py-2">Data Type</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {DATA_DICTIONARY.map((field) => (
                <tr key={field.number} className="hover:bg-[#F8FAFC]">
                  <td className="px-3 py-2 font-code text-[#5B6678]">{field.number}</td>
                  <td className="px-3 py-2 font-bold text-[#0B1F3A]">{field.name}</td>
                  <td className="px-3 py-2 text-[#5B6678]">{field.type}</td>
                  <td className="px-3 py-2 text-[#1B2433]">{field.description}</td>
                  <td className="px-3 py-2">
                    {field.isTarget ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#8B1A1A] text-white">
                        Target Variable
                      </span>
                    ) : field.isLeakage ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F3DCDC] text-[#8B1A1A]">
                        Outcome Leakage (Excluded)
                      </span>
                    ) : (
                      <span className="text-[#5B6678]">Predictor Feature</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
