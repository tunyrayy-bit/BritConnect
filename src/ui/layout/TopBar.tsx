/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Top Bar with Global Search, Dataset Badge & Model Status
 */

import React, { useState } from 'react';
import {
  Search,
  Database,
  Cpu,
  RefreshCw,
  MessageSquareCode,
  Sparkles,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const TopBar: React.FC = () => {
  const {
    activeDatasetName,
    activeDatasetRowCount,
    lastUpdatedTimestamp,
    championModel,
    isStaleModel,
    isTraining,
    trainModel,
    setChatDrawerOpen,
    setSelectedCustomerId,
    setCurrentPage,
    customers
  } = useAppStore();

  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const formattedDate = lastUpdatedTimestamp
    ? new Date(lastUpdatedTimestamp).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    : '';

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    if (val.trim().length >= 2) {
      const q = val.toLowerCase().trim();
      const matches = customers
        .filter(c => c.customerId.toLowerCase().includes(q))
        .slice(0, 8)
        .map(c => c.customerId);
      setSearchResults(matches);
      setShowSearchResults(true);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    setCurrentPage('customers');
    setShowSearchResults(false);
    setSearchInput('');
  };

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] px-5 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-2xs">
      {/* Left: Global Search for Customer ID */}
      <div className="relative w-72">
        <div className="relative">
          <Search className="w-4 h-4 text-[#5B6678] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={handleSearchChange}
            onFocus={() => searchInput.length >= 2 && setShowSearchResults(true)}
            placeholder="Search Customer ID (e.g. BC-10042)..."
            className="w-full bg-[#F6F8FB] border border-[#E2E8F0] focus:border-[#0B1F3A] focus:bg-white text-xs text-[#1B2433] rounded-lg pl-9 pr-3 py-2 outline-none transition-all placeholder:text-[#94A3B8]"
          />
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#E2E8F0] rounded-lg shadow-lg py-1 z-50">
            <div className="px-3 py-1 text-[10px] uppercase font-bold text-[#5B6678] border-b border-[#F1F5F9]">
              Matching Accounts ({searchResults.length})
            </div>
            {searchResults.map(id => (
              <button
                key={id}
                onClick={() => handleSelectCustomer(id)}
                className="w-full text-left px-3 py-2 text-xs text-[#0B1F3A] hover:bg-[#F6F8FB] flex items-center justify-between"
              >
                <span className="font-medium font-code">{id}</span>
                <span className="text-[11px] text-[#C9A227]">View Profile →</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Center: Badges for Active Dataset & Champion Model Status */}
      <div className="hidden lg:flex items-center gap-3">
        {/* Dataset Badge */}
        <div
          onClick={() => setCurrentPage('data-hub')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#E8EDF5] border border-[#CBD5E1] text-[#0B1F3A] text-xs cursor-pointer hover:bg-[#D9E2EC] transition-colors"
          title="Click to manage datasets in Data Hub"
        >
          <Database className="w-3.5 h-3.5 text-[#14305C]" />
          <span className="font-medium truncate max-w-[200px]">{activeDatasetName}</span>
          <span className="text-[#5B6678]">·</span>
          <span className="font-semibold">{activeDatasetRowCount.toLocaleString()} accounts</span>
          {formattedDate && (
            <>
              <span className="text-[#5B6678]">·</span>
              <span className="text-[#5B6678] text-[11px]">{formattedDate}</span>
            </>
          )}
        </div>

        {/* Model Status Badge */}
        {championModel ? (
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
              isStaleModel
                ? 'bg-[#F3DCDC] border-[#B23A3A] text-[#8B1A1A]'
                : 'bg-[#C9A227]/10 border-[#C9A227]/40 text-[#8A6E12]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            {isStaleModel ? (
              <div className="flex items-center gap-2">
                <span className="font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-[#8B1A1A]" /> Stale Model
                </span>
                <button
                  onClick={() => trainModel()}
                  disabled={isTraining}
                  className="px-2 py-0.5 rounded-md bg-[#8B1A1A] text-white text-[11px] font-semibold hover:bg-[#6D1414] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isTraining ? 'animate-spin' : ''}`} />
                  {isTraining ? 'Retraining...' : 'Retrain Now'}
                </button>
              </div>
            ) : (
              <span
                onClick={() => setCurrentPage('model-lab')}
                className="cursor-pointer hover:underline"
              >
                <strong>Champion:</strong> {championModel.algorithmName} (AUC {championModel.metrics.rocAuc})
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={() => trainModel()}
            disabled={isTraining}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A227] text-[#0B1F3A] font-semibold text-xs hover:bg-[#E3C766] transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isTraining ? 'Training Models...' : 'Train Models'}
          </button>
        )}
      </div>

      {/* Right: Analyst Chat Drawer Trigger */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setChatDrawerOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <MessageSquareCode className="w-4 h-4 text-[#C9A227]" />
          <span>BritConnect Analyst</span>
          <span className="px-1.5 py-0.2 bg-[#C9A227] text-[#0B1F3A] text-[10px] rounded font-bold uppercase tracking-wider">
            AI
          </span>
        </button>
      </div>
    </header>
  );
};
