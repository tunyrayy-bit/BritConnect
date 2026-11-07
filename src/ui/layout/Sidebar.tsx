/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Main Application Sidebar
 */

import React from 'react';
import {
  LayoutDashboard,
  Database,
  Cpu,
  Users,
  PieChart,
  Megaphone,
  BookOpenCheck,
  MessageSquareCode,
  FileText,
  Settings,
  HelpCircle,
  Wifi,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const Sidebar: React.FC<{ isCollapsed: boolean; onToggleCollapse: () => void }> = ({
  isCollapsed,
  onToggleCollapse
}) => {
  const { currentPage, setCurrentPage } = useAppStore();

  const navItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
    { id: 'data-hub', label: 'Data Hub', icon: Database },
    { id: 'model-lab', label: 'Model Lab', icon: Cpu },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'segments', label: 'Segments', icon: PieChart },
    { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
    { id: 'playbook', label: 'Retention Playbook', icon: BookOpenCheck },
    { id: 'chat', label: 'Analyst Chat', icon: MessageSquareCode },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings & Self-Check', icon: Settings },
    { id: 'help', label: 'Help & Methodology', icon: HelpCircle }
  ];

  return (
    <aside
      className={`bg-[#0B1F3A] text-white flex flex-col justify-between transition-all duration-300 border-r border-[#14305C] z-30 ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      <div>
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-[#14305C]">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#C9A227] flex items-center justify-center text-[#0B1F3A] shadow-xs">
                <Wifi className="w-5 h-5 font-bold" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white block leading-none">
                  BritConnect
                </span>
                <span className="text-[10px] text-[#C9A227] font-semibold tracking-wider uppercase block mt-1">
                  Churn Intelligence
                </span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="w-8 h-8 mx-auto rounded-lg bg-[#C9A227] flex items-center justify-center text-[#0B1F3A] shadow-xs">
              <Wifi className="w-5 h-5 font-bold" />
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className={`p-1.5 rounded-md hover:bg-[#14305C] text-[#E8EDF5] transition-colors ${
              isCollapsed ? 'hidden' : 'block'
            }`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label="Toggle sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all relative ${
                  isActive
                    ? 'bg-[#14305C] text-white shadow-xs font-semibold'
                    : 'text-[#E8EDF5]/80 hover:bg-[#14305C]/50 hover:text-white'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                {/* Gold active indicator */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#C9A227] rounded-r-md" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#C9A227]' : 'text-[#E8EDF5]/70'
                  }`}
                />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Toggle & Privacy Badge */}
      <div className="p-3 border-t border-[#14305C]">
        {isCollapsed ? (
          <button
            onClick={onToggleCollapse}
            className="w-full py-2 flex items-center justify-center text-[#E8EDF5]/70 hover:text-white hover:bg-[#14305C] rounded-lg"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="bg-[#14305C]/60 rounded-lg p-2.5 text-[11px] text-[#E8EDF5]/80">
            <div className="flex items-center justify-between text-[#C9A227] font-semibold text-[10px] uppercase tracking-wider mb-1">
              <span>Client-Side Security</span>
              <span>100% In-Browser</span>
            </div>
            <p className="text-[10px] leading-tight text-[#E8EDF5]/70">
              Zero raw data transmission. UK GDPR privacy protected.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
