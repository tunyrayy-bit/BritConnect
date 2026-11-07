/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Sticky Global Filter Bar
 */

import React from 'react';
import { Filter, RotateCcw, X } from 'lucide-react';
import { useAppStore, INITIAL_FILTERS } from '../../store/useAppStore';

export const GlobalFilterBar: React.FC = () => {
  const { filters, setFilters, resetFilters, filteredCustomers, customers } = useAppStore();

  const isFiltered = Object.keys(filters).some(
    k => k !== 'searchQuery' && (filters as any)[k] !== (INITIAL_FILTERS as any)[k]
  );

  return (
    <div className="bg-white border-b border-[#E2E8F0] px-5 py-2.5 sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[#0B1F3A] font-semibold mr-1">
          <Filter className="w-3.5 h-3.5 text-[#C9A227]" />
          <span>Filters:</span>
        </div>

        {/* Customer Segment */}
        <select
          value={filters.customerSegment}
          onChange={(e) => setFilters({ customerSegment: e.target.value })}
          className="bg-[#F6F8FB] border border-[#CBD5E1] rounded-md px-2.5 py-1 text-xs text-[#1B2433] focus:border-[#0B1F3A] outline-none"
        >
          <option value="All">All Segments</option>
          <option value="Consumer">Consumer</option>
          <option value="Small Business">Small Business</option>
        </select>

        {/* UK Nation */}
        <select
          value={filters.ukNation}
          onChange={(e) => setFilters({ ukNation: e.target.value })}
          className="bg-[#F6F8FB] border border-[#CBD5E1] rounded-md px-2.5 py-1 text-xs text-[#1B2433] focus:border-[#0B1F3A] outline-none"
        >
          <option value="All">All UK Nations</option>
          <option value="England">England</option>
          <option value="Scotland">Scotland</option>
          <option value="Wales">Wales</option>
          <option value="Northern Ireland">Northern Ireland</option>
        </select>

        {/* Contract Type */}
        <select
          value={filters.contractType}
          onChange={(e) => setFilters({ contractType: e.target.value })}
          className="bg-[#F6F8FB] border border-[#CBD5E1] rounded-md px-2.5 py-1 text-xs text-[#1B2433] focus:border-[#0B1F3A] outline-none"
        >
          <option value="All">All Contracts</option>
          <option value="Month-to-Month">Month-to-Month</option>
          <option value="12 Months">12 Months</option>
          <option value="24 Months">24 Months</option>
        </select>

        {/* Service Type */}
        <select
          value={filters.serviceType}
          onChange={(e) => setFilters({ serviceType: e.target.value })}
          className="bg-[#F6F8FB] border border-[#CBD5E1] rounded-md px-2.5 py-1 text-xs text-[#1B2433] focus:border-[#0B1F3A] outline-none"
        >
          <option value="All">All Services</option>
          <option value="Fibre Broadband">Fibre Broadband</option>
          <option value="Standard Broadband">Standard Broadband</option>
          <option value="5G Mobile & Broadband">5G Mobile & Broadband</option>
          <option value="SIM Only Mobile">SIM Only Mobile</option>
          <option value="Business Unified Comms">Business Unified Comms</option>
        </select>

        {/* Risk Tier */}
        <select
          value={filters.riskTier}
          onChange={(e) => setFilters({ riskTier: e.target.value })}
          className="bg-[#F6F8FB] border border-[#CBD5E1] rounded-md px-2.5 py-1 text-xs text-[#1B2433] focus:border-[#0B1F3A] outline-none"
        >
          <option value="All">All Risk Tiers</option>
          <option value="Critical">Critical Risk (&gt;= 75%)</option>
          <option value="High">High Risk (50–75%)</option>
          <option value="Medium">Medium Risk (25–50%)</option>
          <option value="Low">Low Risk (&lt; 25%)</option>
        </select>

        {/* Active Filter Chips & Reset */}
        {isFiltered && (
          <div className="flex items-center gap-1.5 ml-2">
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#5B6678] hover:text-[#0B1F3A] text-[11px] font-medium transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Cohort Count Indicator */}
      <div className="text-[11px] text-[#5B6678] flex items-center gap-2">
        <span>Displaying:</span>
        <span className="font-semibold text-[#0B1F3A]">
          {filteredCustomers.length.toLocaleString()}
        </span>
        <span>of {customers.length.toLocaleString()} accounts</span>
      </div>
    </div>
  );
};
