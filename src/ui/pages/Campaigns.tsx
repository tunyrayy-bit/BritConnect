/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Retention Campaigns Tracking & Causal Uplift Page (Section 9)
 */

import React, { useState } from 'react';
import {
  Megaphone,
  Plus,
  ShieldCheck,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Users,
  Calendar,
  X
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
import { CampaignRecord, computeCampaignKpis, CampaignChannel, CampaignOfferType } from '../../campaigns/engine';
import { ChartCard, CustomChartTooltip, BRAND_COLORS } from '../components/ChartCard';
import { exportTableToCsv } from '../../reports/engine';

export const Campaigns: React.FC = () => {
  const { campaigns, addCampaign, customers, ruleBasedSegments } = useAppStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaigns[0]?.id || '');

  // Form State for New Campaign
  const [campName, setCampName] = useState('');
  const [campObjective, setCampObjective] = useState('');
  const [campSegment, setCampSegment] = useState(ruleBasedSegments[0]?.name || 'Out of Contract & Unhappy');
  const [campChannel, setCampChannel] = useState<CampaignChannel>('Outbound Call');
  const [campOffer, setCampOffer] = useState<CampaignOfferType>('Contract Extension');
  const [campBudget, setCampBudget] = useState(10000);
  const [campCostPerContact, setCampCostPerContact] = useState(6.0);
  const [campCostPerOffer, setCampCostPerOffer] = useState(25.0);
  const [campControlRatio, setCampControlRatio] = useState(0.15);

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];
  const selectedKpis = selectedCampaign ? computeCampaignKpis(selectedCampaign) : null;

  // Funnel data for selected campaign
  const funnelData = selectedKpis ? [
    { name: 'Targeted', count: selectedKpis.targetedCount },
    { name: 'Contacted', count: selectedKpis.contactedCount },
    { name: 'Accepted', count: selectedKpis.acceptedCount },
    { name: 'Treated Retained', count: Math.round(selectedKpis.treatedCount * selectedKpis.treatedRetentionRate) },
    { name: 'Causal Saves', count: selectedKpis.customersSaved }
  ] : [];

  // Comparison data: Treated vs Control Retention
  const treatedControlData = selectedKpis ? [
    { name: 'Control (Holdout)', rate: Math.round(selectedKpis.controlRetentionRate * 1000) / 10 },
    { name: 'Treated (Campaign)', rate: Math.round(selectedKpis.treatedRetentionRate * 1000) / 10 }
  ] : [];

  const handleCreateCampaign = async () => {
    if (!campName.trim()) return;

    // Build audience from matching segment customers
    const targetSeg = ruleBasedSegments.find(s => s.name === campSegment);
    const audienceIds = targetSeg?.customerIds?.length ? targetSeg.customerIds : customers.slice(0, 300).map(c => c.customerId);

    const audience = audienceIds.map((cid, i) => {
      const isControl = (i % Math.round(1 / campControlRatio) === 0);
      const cust = customers.find(c => c.customerId === cid);
      const charge = cust?.monthlyChargeGbp || 42;
      return {
        customerId: cid,
        group: isControl ? ('Control' as const) : ('Treated' as const),
        contacted: !isControl,
        responded: !isControl && Math.random() < 0.8,
        accepted: !isControl && Math.random() < 0.45,
        retained: !isControl ? Math.random() < 0.78 : Math.random() < 0.55,
        monthlyChargeGbp: charge
      };
    });

    const newCamp: CampaignRecord = {
      id: `camp-${Date.now()}`,
      name: campName.trim(),
      objective: campObjective.trim() || 'Maximize net subscriber retention and contract extension',
      targetSegment: campSegment,
      channel: campChannel,
      offerType: campOffer,
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
      owner: 'Retention Operations Lead',
      budgetGbp: campBudget,
      costPerContactGbp: campCostPerContact,
      offerCostPerAcceptedGbp: campCostPerOffer,
      controlGroupRatio: campControlRatio,
      status: 'Active',
      createdAt: new Date().toISOString(),
      audience
    };

    await addCampaign(newCamp);
    setSelectedCampaignId(newCamp.id);
    setShowCreateModal(false);
  };

  const handleExportCampaigns = () => {
    const data = campaigns.map(camp => {
      const k = computeCampaignKpis(camp);
      return {
        'Campaign Name': camp.name,
        'Offer Type': camp.offerType,
        'Channel': camp.channel,
        'Audience': k.targetedCount,
        'Treated Retained': `${(k.treatedRetentionRate * 100).toFixed(1)}%`,
        'Control Retained': `${(k.controlRetentionRate * 100).toFixed(1)}%`,
        'Incremental Uplift': `+${(k.incrementalUplift * 100).toFixed(1)}%`,
        'P-Value': k.pValue,
        'Customers Saved': k.customersSaved,
        'Revenue Saved (£)': k.revenueSavedGbp,
        'Total Cost (£)': k.totalCostGbp,
        'Net Benefit (£)': k.netBenefitGbp,
        'ROI (%)': `${k.roiPercent}%`
      };
    });
    exportTableToCsv(data, 'BritConnect_Retention_Campaigns');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A] font-editorial tracking-tight">
            Retention Campaign Intelligence & Uplift Tracking
          </h1>
          <p className="text-xs text-[#5B6678] mt-1 font-medium">
            Measure true causal retention uplift, A/B holdout test significance, and financial ROI.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCampaigns}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0B1F3A] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Campaigns (CSV)</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#C9A227]" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Campaign Leaderboard */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5">
        <h3 className="text-sm font-bold text-[#0B1F3A] mb-3">
          Campaign Performance Leaderboard
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8FAFC] text-[#0B1F3A] font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="px-3 py-2.5">Campaign Name</th>
                <th className="px-3 py-2.5">Target Cohort</th>
                <th className="px-3 py-2.5">Channel & Offer</th>
                <th className="px-3 py-2.5">Audience</th>
                <th className="px-3 py-2.5">Causal Uplift</th>
                <th className="px-3 py-2.5">Z-Test Significance</th>
                <th className="px-3 py-2.5">Net Benefit (£)</th>
                <th className="px-3 py-2.5">ROI (%)</th>
                <th className="px-3 py-2.5 text-center">Select</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {campaigns.map((camp) => {
                const k = computeCampaignKpis(camp);
                const isSelected = camp.id === selectedCampaign?.id;
                return (
                  <tr
                    key={camp.id}
                    onClick={() => setSelectedCampaignId(camp.id)}
                    className={`hover:bg-[#F8FAFC] transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#C9A227]/10 font-semibold' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 font-bold text-[#0B1F3A]">{camp.name}</td>
                    <td className="px-3 py-2.5 text-[#5B6678]">{camp.targetSegment}</td>
                    <td className="px-3 py-2.5 text-[#1B2433]">{camp.channel} · {camp.offerType}</td>
                    <td className="px-3 py-2.5 text-[#5B6678]">{k.targetedCount.toLocaleString()}</td>
                    <td className="px-3 py-2.5 font-bold text-[#8A6E12]">
                      +{ (k.incrementalUplift * 100).toFixed(1) }%
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          k.isSignificant
                            ? 'bg-[#E8EDF5] text-[#0B1F3A]'
                            : 'bg-[#F1F5F9] text-[#5B6678]'
                        }`}
                      >
                        {k.isSignificant ? 'Significant (p<0.05)' : 'Inconclusive'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-[#0B1F3A]">
                      £{k.netBenefitGbp.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 font-bold text-[#8A6E12]">
                      {k.roiPercent}%
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[11px] text-[#0B1F3A] hover:underline font-semibold">
                        {isSelected ? 'Viewing' : 'Inspect'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Campaign Detailed Performance */}
      {selectedCampaign && selectedKpis && (
        <div className="space-y-6">
          {/* Header Card for Selected Campaign */}
          <div className="bg-white rounded-xl border border-[#0B1F3A] shadow-xs p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#0B1F3A]">{selectedCampaign.name}</h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8EDF5] text-[#0B1F3A]">
                    {selectedCampaign.status}
                  </span>
                </div>
                <p className="text-xs text-[#5B6678] mt-1">{selectedCampaign.objective}</p>
              </div>

              <div className="text-xs text-right">
                <span className="text-[#5B6678] block">Control Group Holdout:</span>
                <span className="font-bold text-[#0B1F3A]">{(selectedCampaign.controlGroupRatio * 100).toFixed(0)}% Randomized</span>
              </div>
            </div>

            {/* Causal Significance Callout */}
            <div className={`p-3 rounded-lg text-xs flex items-start gap-2.5 ${
              selectedKpis.isSignificant ? 'bg-[#E8EDF5] text-[#0B1F3A] border border-[#CBD5E1]' : 'bg-[#F8FAFC] text-[#5B6678] border border-[#E2E8F0]'
            }`}>
              <ShieldCheck className="w-4 h-4 text-[#C9A227] shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">{selectedKpis.significanceSummary}</span>
                <span className="text-[11px] text-[#5B6678] block mt-0.5">
                  Two-proportion Z-score: {selectedKpis.zScore} (p-value = {selectedKpis.pValue}). Eliminates selection bias through uncontacted holdout baseline.
                </span>
              </div>
            </div>

            {/* KPI Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 text-xs">
              <div className="p-3 bg-[#F8FAFC] rounded-lg">
                <span className="text-[#5B6678] block text-[10px]">Treated Retention</span>
                <span className="font-bold text-base text-[#0B1F3A]">
                  {(selectedKpis.treatedRetentionRate * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-[#5B6678]">vs {(selectedKpis.controlRetentionRate * 100).toFixed(1)}% Control</span>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-lg">
                <span className="text-[#5B6678] block text-[10px]">Causal Uplift</span>
                <span className="font-bold text-base text-[#8A6E12]">
                  +{(selectedKpis.incrementalUplift * 100).toFixed(1)} pp
                </span>
                <span className="text-[10px] text-[#5B6678]">True Incremental</span>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-lg">
                <span className="text-[#5B6678] block text-[10px]">Customers Saved</span>
                <span className="font-bold text-base text-[#0B1F3A]">
                  {selectedKpis.customersSaved} accounts
                </span>
                <span className="text-[10px] text-[#5B6678]">Uplift × Treated</span>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-lg">
                <span className="text-[#5B6678] block text-[10px]">Revenue Protected</span>
                <span className="font-bold text-base text-[#0B1F3A]">
                  £{selectedKpis.revenueSavedGbp.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#5B6678]">12-Month Horizon</span>
              </div>

              <div className="p-3 bg-[#F8FAFC] rounded-lg">
                <span className="text-[#5B6678] block text-[10px]">Financial ROI</span>
                <span className="font-bold text-base text-[#C9A227]">
                  {selectedKpis.roiPercent}%
                </span>
                <span className="text-[10px] text-[#5B6678]">Payback: {selectedKpis.paybackPeriodMonths} mos</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Treated vs Control Retention */}
            <ChartCard
              title="Treated vs Control Group Retention Rate"
              subtitle="Holdout analysis proves real causal effect rather than passive correlation."
              caption="Treated vs 15% Randomized Control Holdout"
              data={treatedControlData}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={treatedControlData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
                  <XAxis dataKey="name" tick={{ fill: BRAND_COLORS.textMain, fontSize: 11 }} axisLine={{ stroke: BRAND_COLORS.borderSubtle }} tickLine={false} />
                  <YAxis tick={{ fill: BRAND_COLORS.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip content={<CustomChartTooltip unit="%" />} />
                  <Bar dataKey="rate" fill={BRAND_COLORS.navyMid} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Campaign Funnel */}
            <ChartCard
              title="Retention Funnel Breakdown"
              subtitle="Step-by-step conversion from targeted cohort to verified saved accounts."
              caption="Targeted -> Contacted -> Responded -> Accepted -> Saved"
              data={funnelData}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={funnelData} margin={{ top: 10, right: 20, left: 35, bottom: 5 }}>
                  <XAxis type="number" tick={{ fill: BRAND_COLORS.textMuted, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: BRAND_COLORS.textMain, fontSize: 10 }} axisLine={false} tickLine={false} width={105} />
                  <Tooltip content={<CustomChartTooltip />} />
                  <Bar dataKey="count" fill={BRAND_COLORS.goldPrimary} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}

      {/* CREATE CAMPAIGN MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 border border-[#E2E8F0] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#0B1F3A]">Create New Retention Campaign</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-md hover:bg-[#F1F5F9] text-[#5B6678]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-[#5B6678] block font-medium mb-1">Campaign Name:</label>
                <input
                  type="text"
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  placeholder="e.g. Q4 Month-to-Month Re-Contracting Blitz"
                  className="w-full bg-[#F6F8FB] border border-[#CBD5E1] rounded-lg p-2.5 text-xs text-[#0B1F3A] outline-none"
                />
              </div>

              <div>
                <label className="text-[#5B6678] block font-medium mb-1">Strategic Objective:</label>
                <input
                  type="text"
                  value={campObjective}
                  onChange={(e) => setCampObjective(e.target.value)}
                  placeholder="e.g. Convert high-value out-of-contract users to 12M tariff with 15% discount"
                  className="w-full bg-[#F6F8FB] border border-[#CBD5E1] rounded-lg p-2.5 text-xs text-[#0B1F3A] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#5B6678] block font-medium mb-1">Target Segment:</label>
                  <select
                    value={campSegment}
                    onChange={(e) => setCampSegment(e.target.value)}
                    className="w-full bg-[#F6F8FB] border border-[#CBD5E1] rounded-lg p-2 text-xs text-[#0B1F3A] outline-none"
                  >
                    {ruleBasedSegments.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.customerCount})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[#5B6678] block font-medium mb-1">Delivery Channel:</label>
                  <select
                    value={campChannel}
                    onChange={(e) => setCampChannel(e.target.value as CampaignChannel)}
                    className="w-full bg-[#F6F8FB] border border-[#CBD5E1] rounded-lg p-2 text-xs text-[#0B1F3A] outline-none"
                  >
                    <option value="Outbound Call">Outbound Call</option>
                    <option value="Email">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="In-App Message">In-App Message</option>
                    <option value="Direct Mail Letter">Direct Mail Letter</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#5B6678] block font-medium mb-1">Offer Type:</label>
                  <select
                    value={campOffer}
                    onChange={(e) => setCampOffer(e.target.value as CampaignOfferType)}
                    className="w-full bg-[#F6F8FB] border border-[#CBD5E1] rounded-lg p-2 text-xs text-[#0B1F3A] outline-none"
                  >
                    <option value="Contract Extension">Contract Extension</option>
                    <option value="Discount">Discount</option>
                    <option value="Plan Upgrade">Plan Upgrade</option>
                    <option value="Loyalty Credit">Loyalty Credit</option>
                    <option value="Proactive Service Fix">Proactive Service Fix</option>
                    <option value="Data Boost">Data Boost</option>
                  </select>
                </div>

                <div>
                  <label className="text-[#5B6678] block font-medium mb-1">Control Holdout (%):</label>
                  <select
                    value={campControlRatio}
                    onChange={(e) => setCampControlRatio(parseFloat(e.target.value))}
                    className="w-full bg-[#F6F8FB] border border-[#CBD5E1] rounded-lg p-2 text-xs text-[#0B1F3A] outline-none"
                  >
                    <option value="0.10">10% Control Holdout</option>
                    <option value="0.15">15% Control Holdout (Recommended)</option>
                    <option value="0.20">20% Control Holdout</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-[#F1F5F9] mt-5">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3.5 py-1.5 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#5B6678] hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                className="px-4 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] text-white text-xs font-semibold"
              >
                Launch Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
