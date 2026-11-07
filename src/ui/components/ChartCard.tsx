/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ChartCard wrapper strictly adhering to Section 14.1 Design & Chart Standards
 */

import React, { useState, useRef } from 'react';
import { Download, Maximize2, Minimize2, FileSpreadsheet, Eye, Info } from 'lucide-react';
import Papa from 'papaparse';

export interface ChartCardProps {
  title: string;
  subtitle: string;
  caption: string;
  data: any[];
  children: React.ReactNode;
  height?: number;
  className?: string;
  onDrillDown?: (item: any) => void;
  benchmarkValue?: number;
  benchmarkLabel?: string;
}

export const BRAND_COLORS = {
  navyDeep: '#0B1F3A',
  navyMid: '#14305C',
  navyTint: '#E8EDF5',
  goldPrimary: '#C9A227',
  goldLight: '#E3C766',
  goldDark: '#8A6E12',
  riskPrimary: '#8B1A1A',
  riskLight: '#B23A3A',
  riskTint: '#F3DCDC',
  neutralBg: '#F6F8FB',
  neutralCard: '#FFFFFF',
  textMain: '#1B2433',
  textMuted: '#5B6678',
  borderSubtle: '#E2E8F0'
};

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  caption,
  data,
  children,
  height = 280,
  className = '',
  benchmarkValue,
  benchmarkLabel
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDataTable, setShowDataTable] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleDownloadCsv = () => {
    if (!data || !data.length) return;
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPng = async () => {
    // Quick SVG/Canvas rasterizer or simple snapshot trigger
    const svgEl = cardRef.current?.querySelector('svg');
    if (!svgEl) return;
    try {
      const svgString = new XMLSerializer().serializeToString(svgEl);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URLObj = window.URL || window.webkitURL || window;
      const blobURL = URLObj.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = svgEl.clientWidth * 2 || 800;
        canvas.height = svgEl.clientHeight * 2 || 600;
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
      };
      img.src = blobURL;
    } catch (e) {
      console.warn('PNG direct capture note:', e);
    }
  };

  const isEmpty = !data || data.length === 0;

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5 transition-all flex flex-col justify-between ${
        isExpanded ? 'fixed inset-4 z-50 overflow-auto shadow-2xl' : ''
      } ${className}`}
    >
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="text-base font-semibold text-[#0B1F3A] tracking-tight">{title}</h3>
            <p className="text-xs text-[#5B6678] mt-0.5 font-medium">{subtitle}</p>
          </div>
          
          <div className="flex items-center gap-1.5 opacity-80 hover:opacity-100 transition-opacity">
            <button
              onClick={() => setShowDataTable(!showDataTable)}
              title="Toggle accessible table view"
              className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#5B6678] hover:text-[#0B1F3A]"
              aria-label="View data table"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDownloadCsv}
              title="Download data as CSV"
              className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#5B6678] hover:text-[#0B1F3A]"
              aria-label="Download CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDownloadPng}
              title="Download chart image as PNG"
              className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#5B6678] hover:text-[#0B1F3A]"
              aria-label="Download PNG"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Collapse' : 'Expand full screen'}
              className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#5B6678] hover:text-[#0B1F3A]"
              aria-label="Expand"
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Benchmark / Reference callout if present */}
        {benchmarkValue !== undefined && (
          <div className="flex items-center gap-2 text-xs text-[#8A6E12] bg-[#C9A227]/10 px-2.5 py-1 rounded-md mb-2 w-fit">
            <span className="w-2.5 h-0.5 bg-[#C9A227] inline-block border-b border-dashed border-[#8A6E12]" />
            <span>{benchmarkLabel || 'Company Average'}: <strong>{benchmarkValue}%</strong></span>
          </div>
        )}
      </div>

      {/* Chart Canvas or Data Table */}
      <div className="my-2 flex-1 flex items-center justify-center">
        {isEmpty ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-6 text-[#5B6678]">
            <Info className="w-8 h-8 text-[#CBD5E1] mb-2" />
            <p className="text-sm font-medium text-[#1B2433]">No data available for current filter selection</p>
            <p className="text-xs text-[#5B6678] mt-1">Adjust global filters or upload records to view metrics.</p>
          </div>
        ) : showDataTable ? (
          <div className="w-full max-h-[300px] overflow-auto border border-[#E2E8F0] rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8FAFC] text-[#0B1F3A] font-semibold sticky top-0 border-b border-[#E2E8F0]">
                <tr>
                  {Object.keys(data[0] || {}).map(k => (
                    <th key={k} className="px-3 py-2">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F5F9]">
                {data.slice(0, 15).map((row, i) => (
                  <tr key={i} className="hover:bg-[#F8FAFC]">
                    {Object.values(row).map((v: any, j) => (
                      <td key={j} className="px-3 py-1.5 text-[#1B2433]">{String(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full" style={{ height: isExpanded ? 500 : height }}>
            {children}
          </div>
        )}
      </div>

      {/* Source Caption */}
      <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between text-[11px] text-[#5B6678]">
        <span>{caption}</span>
        <span className="text-[10px] text-[#94A3B8]">BritConnect Analytics</span>
      </div>
    </div>
  );
};

/**
 * Custom Rich Tooltip for Recharts meeting Section 14.1
 */
export const CustomChartTooltip = ({ active, payload, label, unit = '', baseline }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    const name = payload[0].name || label;
    return (
      <div className="bg-[#0B1F3A] text-white px-3 py-2 rounded-lg shadow-lg text-xs border border-[#14305C]">
        <p className="font-semibold text-[#E3C766]">{label || name}</p>
        <div className="mt-1 flex items-center justify-between gap-4">
          <span className="text-[#E8EDF5]">Recorded Value:</span>
          <span className="font-bold text-white">
            {typeof val === 'number' ? (unit === '£' ? `£${val.toLocaleString()}` : `${val}${unit}`) : val}
          </span>
        </div>
        {baseline !== undefined && (
          <div className="mt-0.5 flex items-center justify-between gap-4 text-[11px] text-[#CBD5E1]">
            <span>vs Avg ({baseline}{unit}):</span>
            <span className={val > baseline ? 'text-[#E3C766]' : 'text-[#A7F3D0]'}>
              {val > baseline ? `+${(val - baseline).toFixed(1)}` : `${(val - baseline).toFixed(1)}`}{unit}
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};
