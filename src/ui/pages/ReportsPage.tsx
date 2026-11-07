/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Reports and Downloads Center (Section 15)
 */

import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  CheckSquare,
  Square,
  Printer,
  Sparkles,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import {
  generateExecutivePdfReport,
  generateExcelWorkbook,
  exportTableToCsv,
  ReportGenerationOptions
} from '../../reports/engine';

export const ReportsPage: React.FC = () => {
  const {
    customers,
    scores,
    championModel,
    campaigns,
    ruleBasedSegments,
    validationReport,
    cleaningLog,
    activeDatasetName
  } = useAppStore();

  const [sections, setSections] = useState<ReportGenerationOptions>({
    includeExecutiveSummary: true,
    includeKpiSnapshot: true,
    includeModelMetrics: true,
    includeTopDrivers: true,
    includeSegments: true,
    includeRecommendations: true,
    includeCampaigns: true,
    includeDataQuality: true,
    includeMethodologyAppendix: true
  });

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

  const toggleSection = (key: keyof ReportGenerationOptions) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    setTimeout(() => {
      try {
        generateExecutivePdfReport(
          customers,
          scores,
          championModel,
          campaigns,
          ruleBasedSegments,
          validationReport,
          sections
        );
      } catch (e) {
        console.error('PDF generation error:', e);
      } finally {
        setIsGeneratingPdf(false);
      }
    }, 100);
  };

  const handleDownloadExcel = () => {
    setIsGeneratingExcel(true);
    setTimeout(() => {
      try {
        generateExcelWorkbook(
          customers,
          scores,
          championModel,
          ruleBasedSegments,
          campaigns,
          validationReport,
          cleaningLog
        );
      } catch (e) {
        console.error('Excel generation error:', e);
      } finally {
        setIsGeneratingExcel(false);
      }
    }, 100);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A] font-editorial tracking-tight">
            Reports & Analytical Deliverables
          </h1>
          <p className="text-xs text-[#5B6678] mt-1 font-medium">
            Generate branded executive PDF dossiers, comprehensive multi-tab Excel workbooks, and raw data extracts.
          </p>
        </div>
      </div>

      {/* Main Grid: PDF Builder vs Excel Workbook */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Executive PDF Dossier */}
        <div className="bg-white rounded-xl border border-[#0B1F3A] shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#0B1F3A] text-white flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#C9A227]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#0B1F3A]">Executive PDF Dossier</h3>
                <span className="text-[11px] text-[#5B6678]">
                  C-Suite branded PDF report with KPI tables, driver charts, and 30/60/90 roadmap
                </span>
              </div>
            </div>

            <p className="text-xs text-[#1B2433] leading-relaxed my-3">
              Formatted according to BritConnect Navy (#0B1F3A), Gold (#C9A227), and Dark Red (#8B1A1A) branding standards. Includes cover, situation briefing, top 5 retention initiatives, and regulatory methodology appendix.
            </p>

            {/* Section Toggles */}
            <div className="space-y-2 mt-4 pt-4 border-t border-[#F1F5F9] text-xs">
              <span className="font-bold text-[11px] text-[#5B6678] uppercase tracking-wider block mb-1">
                Included Report Chapters:
              </span>

              {[
                { key: 'includeExecutiveSummary', label: '1. Executive Situation & Financial Risk Exposure' },
                { key: 'includeKpiSnapshot', label: '2. High-Level KPI Reconciled Scorecard' },
                { key: 'includeTopDrivers', label: '3. Machine Learning Primary Churn Drivers' },
                { key: 'includeSegments', label: '4. Risk × Value Matrix & Cohort Analysis' },
                { key: 'includeRecommendations', label: '5. Tactical P1–P3 Retention Playbook & Roadmap' },
                { key: 'includeCampaigns', label: '6. Retention Campaign Causal Uplift & ROI' },
                { key: 'includeDataQuality', label: '7. Data Quality Audit & Schema Reconciliation' },
                { key: 'includeMethodologyAppendix', label: '8. Governance, Limitations & UK GDPR Appendix' }
              ].map(({ key, label }) => {
                const isChecked = (sections as any)[key];
                return (
                  <button
                    key={key}
                    onClick={() => toggleSection(key as any)}
                    className="w-full flex items-center gap-2 text-left py-1 text-[#1B2433] hover:text-[#0B1F3A] transition-colors"
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-[#C9A227] shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-[#CBD5E1] shrink-0" />
                    )}
                    <span className="text-xs">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="mt-6 w-full py-2.5 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] disabled:bg-[#CBD5E1] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#C9A227]" />
            <span>{isGeneratingPdf ? 'Compiling PDF Dossier...' : 'Download Executive PDF Report'}</span>
          </button>
        </div>

        {/* Card 2: Multi-Sheet Excel Workbook */}
        <div className="bg-white rounded-xl border border-[#C9A227]/50 shadow-xs p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-lg bg-[#C9A227]/15 text-[#8A6E12] flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-[#8A6E12]" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[#0B1F3A]">Multi-Sheet Excel Workbook (.xlsx)</h3>
                <span className="text-[11px] text-[#5B6678]">
                  Operational spreadsheets for commercial retention and data science teams
                </span>
              </div>
            </div>

            <p className="text-xs text-[#1B2433] leading-relaxed my-3">
              Generates a clean workbook complete with formatted headers, frozen rows, and pre-calculated fields across 5 dedicated sheets:
            </p>

            <div className="space-y-2 mt-4 pt-4 border-t border-[#F1F5F9] text-xs">
              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#0B1F3A] block">Sheet 1: Scored Customers</span>
                  <span className="text-[11px] text-[#5B6678]">Customer ID, Risk %, Tier, Monthly Risk (£), Top Drivers, Action</span>
                </div>
                <span className="font-code font-bold text-xs text-[#0B1F3A]">{customers.length.toLocaleString()} rows</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#0B1F3A] block">Sheet 2: Segments Summary</span>
                  <span className="text-[11px] text-[#5B6678]">Counts, Share of Base, Observed Churn, Predicted Risk</span>
                </div>
                <span className="font-code font-bold text-xs text-[#0B1F3A]">{ruleBasedSegments.length} segments</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#0B1F3A] block">Sheet 3: Model Evaluation Metrics</span>
                  <span className="text-[11px] text-[#5B6678]">ROC-AUC, PR-AUC, F1, Log-loss, MCC, Feature Importances</span>
                </div>
                <span className="font-code font-bold text-xs text-[#0B1F3A]">Full Audit</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#0B1F3A] block">Sheet 4: Retention Campaigns</span>
                  <span className="text-[11px] text-[#5B6678]">Treated vs Control, Causal Uplift %, P-Value, Saved Revenue, ROI</span>
                </div>
                <span className="font-code font-bold text-xs text-[#0B1F3A]">{campaigns.length} campaigns</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                <div>
                  <span className="font-bold text-[#0B1F3A] block">Sheet 5: Cleaning Audit Log</span>
                  <span className="text-[11px] text-[#5B6678]">Imputations, deduplications, Winsorization records</span>
                </div>
                <span className="font-code font-bold text-xs text-[#0B1F3A]">{cleaningLog.length} actions</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleDownloadExcel}
            disabled={isGeneratingExcel}
            className="mt-6 w-full py-2.5 rounded-lg bg-[#C9A227] hover:bg-[#E3C766] disabled:bg-[#CBD5E1] text-[#0B1F3A] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4 text-[#0B1F3A]" />
            <span>{isGeneratingExcel ? 'Building Workbook...' : 'Download Complete Excel Workbook (.xlsx)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
