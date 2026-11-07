/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BritConnect AI Customer Churn Intelligence Platform
 * Main Application Shell & Navigation
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { Sidebar } from './ui/layout/Sidebar';
import { TopBar } from './ui/layout/TopBar';
import { GlobalFilterBar } from './ui/layout/GlobalFilterBar';
import { ChatSlideover } from './ui/layout/ChatSlideover';

// Pages
import { ExecutiveDashboard } from './ui/pages/ExecutiveDashboard';
import { DataHub } from './ui/pages/DataHub';
import { ModelLab } from './ui/pages/ModelLab';
import { Customers } from './ui/pages/Customers';
import { Segments } from './ui/pages/Segments';
import { Campaigns } from './ui/pages/Campaigns';
import { RetentionPlaybook } from './ui/pages/RetentionPlaybook';
import { AnalystChatPage } from './ui/pages/AnalystChatPage';
import { ReportsPage } from './ui/pages/ReportsPage';
import { SettingsPage } from './ui/pages/SettingsPage';
import { HelpPage } from './ui/pages/HelpPage';

import { AlertTriangle, RefreshCw, Sparkles, Wifi } from 'lucide-react';

export default function App() {
  const {
    currentPage,
    loadInitialData,
    isLoadingInitialData,
    isStaleModel,
    isTraining,
    trainModel,
    customers
  } = useAppStore();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  if (isLoadingInitialData) {
    return (
      <div className="h-screen w-screen bg-[#F6F8FB] flex flex-col items-center justify-center text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-[#0B1F3A] flex items-center justify-center text-[#C9A227] shadow-xl mb-4 animate-bounce">
          <Wifi className="w-9 h-9" />
        </div>
        <h2 className="text-xl font-bold text-[#0B1F3A] font-editorial tracking-tight">
          BritConnect Churn Intelligence Platform
        </h2>
        <p className="text-xs text-[#5B6678] mt-1 max-w-sm">
          Initializing in-browser IndexedDB storage, candidate models, and canonical data dictionaries...
        </p>
        <div className="mt-5 w-48 bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
          <div className="bg-[#C9A227] h-full animate-pulse w-3/4" />
        </div>
      </div>
    );
  }

  const renderActivePage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <ExecutiveDashboard />;
      case 'data-hub':
        return <DataHub />;
      case 'model-lab':
        return <ModelLab />;
      case 'customers':
        return <Customers />;
      case 'segments':
        return <Segments />;
      case 'campaigns':
        return <Campaigns />;
      case 'playbook':
        return <RetentionPlaybook />;
      case 'chat':
        return <AnalystChatPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'help':
        return <HelpPage />;
      default:
        return <ExecutiveDashboard />;
    }
  };

  const showFilterBar = ['dashboard', 'customers', 'segments'].includes(currentPage);

  return (
    <div className="flex h-screen bg-[#F6F8FB] overflow-hidden text-[#1B2433]">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <TopBar />

        {/* Stale Model Prompt Banner (Section 3) */}
        {isStaleModel && (
          <div className="bg-[#8B1A1A] text-white px-5 py-2 text-xs flex items-center justify-between gap-4 z-20 shadow-xs animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#E3C766]" />
              <span>
                <strong>Data changed or updated:</strong> Existing machine learning scores and candidate champion are now marked as stale.
              </span>
            </div>

            <button
              onClick={() => trainModel()}
              disabled={isTraining}
              className="px-3 py-1 rounded bg-[#C9A227] hover:bg-[#E3C766] text-[#0B1F3A] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTraining ? 'animate-spin' : ''}`} />
              <span>{isTraining ? 'Retraining...' : 'Retrain & Re-Score Now'}</span>
            </button>
          </div>
        )}

        {/* Sticky Filter Bar (for analytical views) */}
        {showFilterBar && <GlobalFilterBar />}

        {/* Page Content Container */}
        <main className="flex-1 overflow-y-auto p-5 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderActivePage()}
          </div>
        </main>
      </div>

      {/* Slideover Analyst Chat Drawer */}
      <ChatSlideover />
    </div>
  );
}
