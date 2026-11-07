/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Customers Page with Profile Drawer, Drivers Waterfall & What-If Simulator (Section 7.3 & 7.4)
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  ArrowUpDown,
  X,
  Sliders,
  Sparkles,
  Download,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { BritConnectCustomer, CustomerScore } from '../../data/dictionary';
import { exportTableToCsv } from '../../reports/engine';
import { BRAND_COLORS } from '../components/ChartCard';

export const Customers: React.FC = () => {
  const {
    filteredCustomers,
    scoresMap,
    championModel,
    selectedCustomerId,
    setSelectedCustomerId
  } = useAppStore();

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'id' | 'risk' | 'charge' | 'tenure'>('risk');
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPageNum, setCurrentPageNum] = useState(1);
  const pageSize = 20;

  // Search & Sorting
  const sortedCustomers = useMemo(() => {
    let list = filteredCustomers;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(c =>
        c.customerId.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.planName.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      if (sortField === 'risk') {
        valA = scoresMap.get(a.customerId)?.churnProbability || 0;
        valB = scoresMap.get(b.customerId)?.churnProbability || 0;
      } else if (sortField === 'charge') {
        valA = a.monthlyChargeGbp;
        valB = b.monthlyChargeGbp;
      } else if (sortField === 'tenure') {
        valA = a.tenureMonths;
        valB = b.tenureMonths;
      } else {
        valA = a.customerId;
        valB = b.customerId;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredCustomers, scoresMap, search, sortField, sortAsc]);

  const totalPages = Math.ceil(sortedCustomers.length / pageSize) || 1;
  const pagedCustomers = sortedCustomers.slice((currentPageNum - 1) * pageSize, currentPageNum * pageSize);

  const selectedCustomer = selectedCustomerId
    ? filteredCustomers.find(c => c.customerId === selectedCustomerId) || null
    : null;
  const selectedScore = selectedCustomer ? scoresMap.get(selectedCustomer.customerId) : null;

  // What-If Simulator Local State for Selected Customer
  const [simContract, setSimContract] = useState<string>(selectedCustomer?.contractType || '12 Months');
  const [simTickets, setSimTickets] = useState<number>(selectedCustomer?.supportTickets12m || 0);
  const [simDiscount, setSimDiscount] = useState<number>(selectedCustomer?.discountPercent || 0);

  // Update simulator state when selected customer changes
  React.useEffect(() => {
    if (selectedCustomer) {
      setSimContract(selectedCustomer.contractType);
      setSimTickets(selectedCustomer.supportTickets12m);
      setSimDiscount(selectedCustomer.discountPercent || 0);
    }
  }, [selectedCustomerId]);

  // Compute Simulated Probability
  const simulatedProb = useMemo(() => {
    if (!selectedScore) return 0.2;
    let base = selectedScore.churnProbability;
    if (selectedCustomer) {
      // Contract effect
      if (selectedCustomer.contractType === 'Month-to-Month' && simContract === '12 Months') base -= 0.18;
      if (selectedCustomer.contractType === 'Month-to-Month' && simContract === '24 Months') base -= 0.28;
      if (selectedCustomer.contractType !== 'Month-to-Month' && simContract === 'Month-to-Month') base += 0.22;
      // Tickets effect
      const ticketDelta = simTickets - selectedCustomer.supportTickets12m;
      base += ticketDelta * 0.05;
      // Discount effect
      const discDelta = simDiscount - (selectedCustomer.discountPercent || 0);
      base -= (discDelta / 100) * 0.25;
    }
    return Math.max(0.02, Math.min(0.96, Math.round(base * 100) / 100));
  }, [selectedScore, selectedCustomer, simContract, simTickets, simDiscount]);

  const handleExportScoredList = () => {
    const data = sortedCustomers.map(c => {
      const s = scoresMap.get(c.customerId);
      return {
        'Customer ID': c.customerId,
        'Segment': c.customerSegment,
        'UK Nation': c.ukNation,
        'Contract': c.contractType,
        'Tenure (Months)': c.tenureMonths,
        'Monthly Charge (£)': c.monthlyChargeGbp,
        'Churn Probability': s ? `${(s.churnProbability * 100).toFixed(1)}%` : 'N/A',
        'Risk Tier': s?.riskTier || 'Low',
        'Monthly Risk (£)': s?.monthlyRevenueAtRisk || 0,
        'Top Driver': s?.topDrivers[0]?.label || '',
        'Recommended Action': s?.recommendedAction || ''
      };
    });
    exportTableToCsv(data, 'BritConnect_Customer_Risk_Scores');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A] font-editorial tracking-tight">
            Customer Directory & Individual Profiling
          </h1>
          <p className="text-xs text-[#5B6678] mt-1 font-medium">
            Search, sort, drill into account telemetry, explain churn factors, and simulate what-if scenarios.
          </p>
        </div>

        <button
          onClick={handleExportScoredList}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0B1F3A] transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-[#0B1F3A]" />
          <span>Export Scored List (CSV)</span>
        </button>
      </div>

      {/* Search & Sort Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#5B6678] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, city, or plan..."
            className="w-full bg-[#F6F8FB] border border-[#CBD5E1] focus:border-[#0B1F3A] text-xs text-[#1B2433] rounded-lg pl-9 pr-3 py-2 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#5B6678] font-medium">Sort by:</span>
          <button
            onClick={() => {
              if (sortField === 'risk') setSortAsc(!sortAsc);
              else { setSortField('risk'); setSortAsc(false); }
            }}
            className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
              sortField === 'risk' ? 'bg-[#0B1F3A] text-white' : 'bg-[#F1F5F9] text-[#5B6678]'
            }`}
          >
            <span>Risk Score</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              if (sortField === 'charge') setSortAsc(!sortAsc);
              else { setSortField('charge'); setSortAsc(false); }
            }}
            className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
              sortField === 'charge' ? 'bg-[#0B1F3A] text-white' : 'bg-[#F1F5F9] text-[#5B6678]'
            }`}
          >
            <span>Monthly Charge</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
          <button
            onClick={() => {
              if (sortField === 'tenure') setSortAsc(!sortAsc);
              else { setSortField('tenure'); setSortAsc(false); }
            }}
            className={`px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-colors ${
              sortField === 'tenure' ? 'bg-[#0B1F3A] text-white' : 'bg-[#F1F5F9] text-[#5B6678]'
            }`}
          >
            <span>Tenure</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8FAFC] text-[#0B1F3A] font-semibold border-b border-[#E2E8F0]">
              <tr>
                <th className="px-3 py-2.5">Customer ID</th>
                <th className="px-3 py-2.5">Segment</th>
                <th className="px-3 py-2.5">UK Nation & City</th>
                <th className="px-3 py-2.5">Contract Term</th>
                <th className="px-3 py-2.5">Tenure</th>
                <th className="px-3 py-2.5">Monthly Charge</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Churn Probability</th>
                <th className="px-3 py-2.5">Risk Tier</th>
                <th className="px-3 py-2.5">Monthly Risk (£)</th>
                <th className="px-3 py-2.5 text-center">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {pagedCustomers.map((cust) => {
                const s = scoresMap.get(cust.customerId);
                const prob = s?.churnProbability || (cust.churnStatus === 'Churned' ? 1.0 : 0.15);
                const tier = s?.riskTier || (prob >= 0.75 ? 'Critical' : prob >= 0.5 ? 'High' : prob >= 0.25 ? 'Medium' : 'Low');
                const revAtRisk = cust.monthlyChargeGbp * prob;

                return (
                  <tr
                    key={cust.customerId}
                    onClick={() => setSelectedCustomerId(cust.customerId)}
                    className="hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2.5 font-code font-bold text-[#0B1F3A]">
                      {cust.customerId}
                    </td>
                    <td className="px-3 py-2.5 text-[#5B6678]">{cust.customerSegment}</td>
                    <td className="px-3 py-2.5 text-[#1B2433]">{cust.ukNation} ({cust.city})</td>
                    <td className="px-3 py-2.5 text-[#5B6678]">{cust.contractType}</td>
                    <td className="px-3 py-2.5 text-[#5B6678]">{cust.tenureMonths} mos</td>
                    <td className="px-3 py-2.5 font-semibold text-[#0B1F3A]">
                      £{cust.monthlyChargeGbp.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          cust.churnStatus === 'Churned'
                            ? 'bg-[#F3DCDC] text-[#8B1A1A]'
                            : 'bg-[#E8EDF5] text-[#0B1F3A]'
                        }`}
                      >
                        {cust.churnStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              prob >= 0.75
                                ? 'bg-[#8B1A1A]'
                                : prob >= 0.5
                                ? 'bg-[#B23A3A]'
                                : prob >= 0.25
                                ? 'bg-[#C9A227]'
                                : 'bg-[#14305C]'
                            }`}
                            style={{ width: `${Math.round(prob * 100)}%` }}
                          />
                        </div>
                        <span className="font-bold text-[#0B1F3A]">{(prob * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          tier === 'Critical'
                            ? 'bg-[#8B1A1A] text-white'
                            : tier === 'High'
                            ? 'bg-[#F3DCDC] text-[#8B1A1A]'
                            : tier === 'Medium'
                            ? 'bg-[#C9A227]/20 text-[#8A6E12]'
                            : 'bg-[#E8EDF5] text-[#0B1F3A]'
                        }`}
                      >
                        {tier}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-bold text-[#8B1A1A]">
                      £{revAtRisk.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCustomerId(cust.customerId);
                        }}
                        className="px-2.5 py-1 rounded bg-[#0B1F3A] hover:bg-[#14305C] text-white text-[10px] font-semibold transition-colors"
                      >
                        Drill Down
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 bg-white border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#5B6678]">
          <span>
            Showing {(currentPageNum - 1) * pageSize + 1}–{Math.min(currentPageNum * pageSize, sortedCustomers.length)} of {sortedCustomers.length} accounts
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPageNum(Math.max(1, currentPageNum - 1))}
              disabled={currentPageNum === 1}
              className="px-2.5 py-1 rounded border border-[#CBD5E1] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-2 font-semibold text-[#0B1F3A]">
              Page {currentPageNum} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPageNum(Math.min(totalPages, currentPageNum + 1))}
              disabled={currentPageNum === totalPages}
              className="px-2.5 py-1 rounded border border-[#CBD5E1] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* CUSTOMER PROFILE DRAWER (Section 7.3 & 7.4) */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto border-l border-[#E2E8F0] animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 bg-[#0B1F3A] text-white border-b border-[#14305C] sticky top-0 z-10">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-code tracking-tight">
                      {selectedCustomer.customerId}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C9A227] text-[#0B1F3A]">
                      {selectedCustomer.customerSegment}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#14305C] text-white">
                      {selectedCustomer.churnStatus}
                    </span>
                  </div>
                  <p className="text-xs text-[#E8EDF5]/80 mt-1">
                    {selectedCustomer.planName} · {selectedCustomer.ukNation} ({selectedCustomer.city}) · Joined {selectedCustomer.joinDate} ({selectedCustomer.tenureMonths} mos tenure)
                  </p>
                </div>

                <button
                  onClick={() => setSelectedCustomerId(null)}
                  className="p-1.5 rounded-md hover:bg-[#14305C] text-[#E8EDF5]/80 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Gauge and Financial Exposure Banner */}
              <div className="mt-4 pt-3 border-t border-[#14305C] grid grid-cols-3 gap-3 text-center">
                <div className="bg-[#14305C]/70 p-2.5 rounded-lg">
                  <span className="text-[10px] uppercase text-[#E8EDF5]/70 block font-semibold">
                    Current Churn Risk
                  </span>
                  <span className="text-xl font-bold text-[#E3C766]">
                    {((selectedScore?.churnProbability || 0.15) * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-[#E8EDF5]/80 block font-medium">
                    {selectedScore?.riskTier || 'Medium'} Tier
                  </span>
                </div>

                <div className="bg-[#14305C]/70 p-2.5 rounded-lg">
                  <span className="text-[10px] uppercase text-[#E8EDF5]/70 block font-semibold">
                    Monthly Revenue at Risk
                  </span>
                  <span className="text-xl font-bold text-white">
                    £{((selectedCustomer.monthlyChargeGbp * (selectedScore?.churnProbability || 0.15))).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-[#E8EDF5]/80 block">
                    £{selectedCustomer.monthlyChargeGbp.toFixed(2)} Subscription
                  </span>
                </div>

                <div className="bg-[#14305C]/70 p-2.5 rounded-lg">
                  <span className="text-[10px] uppercase text-[#E8EDF5]/70 block font-semibold">
                    Annual Exposure (£)
                  </span>
                  <span className="text-xl font-bold text-white">
                    £{((selectedCustomer.monthlyChargeGbp * (selectedScore?.churnProbability || 0.15) * 12)).toFixed(0)}
                  </span>
                  <span className="text-[10px] text-[#E8EDF5]/80 block">
                    12-Month Pro-rata
                  </span>
                </div>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1 bg-[#F8FAFC]">
              {/* Local Waterfall Drivers (Section 7.4) */}
              <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs">
                <h3 className="text-sm font-bold text-[#0B1F3A] mb-1">
                  Local Waterfall Churn Drivers (Risk Attribution)
                </h3>
                <p className="text-xs text-[#5B6678] mb-3">
                  Factors pushing risk UP (<span className="text-[#8B1A1A] font-semibold">dark red</span>) vs protective factors (<span className="text-[#0B1F3A] font-semibold">navy</span>). Sum of contributions verifies additivity.
                </p>

                <div className="space-y-2.5">
                  {selectedScore?.topDrivers?.map((driver, idx) => {
                    const isRiskUp = driver.contribution > 0;
                    const pp = driver.percentagePointsDelta ?? Math.round(Math.abs(driver.contribution) * 10);
                    return (
                      <div key={idx} className="p-2.5 rounded-lg border border-[#F1F5F9] bg-[#F8FAFC]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#0B1F3A]">{driver.label}</span>
                          <span
                            className={`font-bold flex items-center gap-1 ${
                              isRiskUp ? 'text-[#8B1A1A]' : 'text-[#0B1F3A]'
                            }`}
                          >
                            {isRiskUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {isRiskUp ? `+${pp} pp` : `-${pp} pp`}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#5B6678] mt-1">{driver.explanation}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* What-If / Counterfactual Simulator (Section 7.4) */}
              <div className="bg-white p-5 rounded-xl border border-[#C9A227]/40 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-[#C9A227]" />
                      Live What-If Retention Simulator
                    </h3>
                    <p className="text-xs text-[#5B6678] mt-0.5">
                      Adjust commercial levers to forecast immediate churn probability reduction.
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[#5B6678] uppercase block font-semibold">Simulated Risk</span>
                    <span className="text-lg font-bold text-[#8A6E12]">
                      {(simulatedProb * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="space-y-4 text-xs">
                  {/* Lever 1: Contract Type */}
                  <div>
                    <label className="text-[#5B6678] block font-medium mb-1">Contract Type Offer:</label>
                    <select
                      value={simContract}
                      onChange={(e) => setSimContract(e.target.value)}
                      className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg p-2 text-xs font-semibold text-[#0B1F3A] outline-none"
                    >
                      <option value="Month-to-Month">Month-to-Month (Standard Rolling)</option>
                      <option value="12 Months">12 Months Fixed (15% Loyalty Discount)</option>
                      <option value="24 Months">24 Months Fixed (VIP Long-term Lock)</option>
                    </select>
                  </div>

                  {/* Lever 2: Support Tickets Resolution */}
                  <div>
                    <div className="flex justify-between font-medium text-[#5B6678] mb-1">
                      <span>Simulate Resolving Open Tickets:</span>
                      <span className="font-bold text-[#0B1F3A]">{simTickets} tickets</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      value={simTickets}
                      onChange={(e) => setSimTickets(parseInt(e.target.value))}
                      className="w-full accent-[#0B1F3A] cursor-pointer"
                    />
                  </div>

                  {/* Lever 3: Retention Discount */}
                  <div>
                    <div className="flex justify-between font-medium text-[#5B6678] mb-1">
                      <span>Retention Discount (%):</span>
                      <span className="font-bold text-[#0B1F3A]">{simDiscount}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="40"
                      step="5"
                      value={simDiscount}
                      onChange={(e) => setSimDiscount(parseInt(e.target.value))}
                      className="w-full accent-[#0B1F3A] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Next Best Action Card (Section 10) */}
              <div className="bg-[#0B1F3A] text-white p-5 rounded-xl shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-[#C9A227] uppercase tracking-wider">
                    Recommended Next Best Action ({selectedScore?.priority || 'P1'})
                  </span>
                  <span className="text-[11px] text-[#E8EDF5]/70">Act within 7 days</span>
                </div>
                <h4 className="text-sm font-bold text-white mb-1.5">
                  {selectedScore?.recommendedAction || 'Execute 12M renewal offer with tariff credit'}
                </h4>
                <p className="text-xs text-[#E8EDF5]/80 leading-relaxed">
                  Dedicated Senior Care agent phone consultation to address network outage concerns and propose a 12-month re-signing contract with 15% discount protection.
                </p>
                <div className="mt-4 pt-3 border-t border-[#14305C] flex items-center justify-between">
                  <span className="text-[11px] text-[#C9A227] font-semibold">
                    Expected Save: ~£{Math.round(selectedCustomer.monthlyChargeGbp * 12 * 0.85)} Annual Value
                  </span>
                  <button
                    onClick={() => alert(`Campaign action dispatched for Customer ${selectedCustomer.customerId}`)}
                    className="px-3 py-1.5 rounded-lg bg-[#C9A227] hover:bg-[#E3C766] text-[#0B1F3A] text-xs font-bold transition-colors cursor-pointer"
                  >
                    Execute Campaign Offer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
