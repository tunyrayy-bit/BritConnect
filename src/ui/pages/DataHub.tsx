/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Data Hub Page (Section 4, 5, 3: Ingestion, Quality Report, Cleaning Log, Versions)
 */

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Sparkles,
  History,
  FileText,
  Sliders,
  Check,
  ChevronRight,
  Database
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { parseFile, downloadTemplate } from '../../ingestion/parser';
import { autoMapColumns, ColumnMappingItem } from '../../ingestion/mapping';
import { exportTableToCsv } from '../../reports/engine';
import { DATA_DICTIONARY } from '../../data/dictionary';

export const DataHub: React.FC = () => {
  const {
    activeDatasetName,
    activeDatasetRowCount,
    lastUpdatedTimestamp,
    validationReport,
    cleaningLog,
    datasetVersions,
    handleDatasetUpload,
    loadSampleData,
    restoreDatasetVersion,
    deleteDatasetVersionRecord,
    customers
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<'upload' | 'quality' | 'cleaning' | 'versions'>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [parsingProgress, setParsingProgress] = useState<{ percent: number; message: string } | null>(null);

  // Upload Modal State
  const [pendingUpload, setPendingUpload] = useState<{
    rawRows: Record<string, any>[];
    filename: string;
    mappings: ColumnMappingItem[];
  } | null>(null);
  const [uploadChoice, setUploadChoice] = useState<'append' | 'replace'>('replace');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = async (file: File) => {
    try {
      setParsingProgress({ percent: 10, message: 'Initiating file parse...' });
      const res = await parseFile(file, (pct, msg) => {
        setParsingProgress({ percent: pct, message: msg });
      });

      const sampleRows = res.rawRows.slice(0, 10);
      const mappingAssessment = autoMapColumns(res.rawHeaders, sampleRows);

      setPendingUpload({
        rawRows: res.rawRows,
        filename: file.name,
        mappings: mappingAssessment.mappings
      });
      setParsingProgress(null);
    } catch (err: any) {
      alert(`File parse error: ${err.message}`);
      setParsingProgress(null);
    }
  };

  const handleConfirmUpload = async () => {
    if (!pendingUpload) return;
    setParsingProgress({ percent: 50, message: 'Validating and cleaning dataset...' });
    await handleDatasetUpload(pendingUpload.rawRows, pendingUpload.filename, uploadChoice);
    setPendingUpload(null);
    setParsingProgress(null);
    setActiveTab('quality');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A] font-editorial tracking-tight">
            BritConnect Data Hub
          </h1>
          <p className="text-xs text-[#5B6678] mt-1 font-medium">
            Ingest, map, validate, audit data quality, and inspect automated cleaning pipelines.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadTemplate('xlsx')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] text-xs font-semibold text-[#0B1F3A] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Template (.xlsx)</span>
          </button>
          <button
            onClick={() => loadSampleData()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#C9A227] hover:bg-[#E3C766] text-[#0B1F3A] text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Synthetic Dataset (1,200 rows)</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0]">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'upload'
              ? 'border-[#0B1F3A] text-[#0B1F3A]'
              : 'border-transparent text-[#5B6678] hover:text-[#0B1F3A]'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload & Ingestion</span>
        </button>
        <button
          onClick={() => setActiveTab('quality')}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'quality'
              ? 'border-[#0B1F3A] text-[#0B1F3A]'
              : 'border-transparent text-[#5B6678] hover:text-[#0B1F3A]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-[#C9A227]" />
          <span>Data Quality Audit (Score: {validationReport?.overallQualityScore || 96}/100)</span>
        </button>
        <button
          onClick={() => setActiveTab('cleaning')}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'cleaning'
              ? 'border-[#0B1F3A] text-[#0B1F3A]'
              : 'border-transparent text-[#5B6678] hover:text-[#0B1F3A]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Cleaning Log ({cleaningLog.length} rules)</span>
        </button>
        <button
          onClick={() => setActiveTab('versions')}
          className={`px-4 py-2 text-xs font-semibold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'versions'
              ? 'border-[#0B1F3A] text-[#0B1F3A]'
              : 'border-transparent text-[#5B6678] hover:text-[#0B1F3A]'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Dataset Versions ({datasetVersions.length})</span>
        </button>
      </div>

      {/* TAB 1: UPLOAD & INGESTION */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length) {
                handleFileProcess(e.dataTransfer.files[0]);
              }
            }}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all bg-white ${
              dragOver ? 'border-[#C9A227] bg-[#C9A227]/5' : 'border-[#CBD5E1] hover:border-[#0B1F3A]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt,.json,.jsonl,.ndjson"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length) {
                  handleFileProcess(e.target.files[0]);
                }
              }}
            />
            <div className="w-14 h-14 rounded-full bg-[#E8EDF5] text-[#0B1F3A] flex items-center justify-center mx-auto mb-3">
              <UploadCloud className="w-7 h-7 text-[#0B1F3A]" />
            </div>
            <h3 className="text-base font-bold text-[#0B1F3A]">
              Drag & Drop your customer file here, or{' '}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[#C9A227] hover:underline font-bold cursor-pointer"
              >
                browse files
              </button>
            </h3>
            <p className="text-xs text-[#5B6678] mt-1 max-w-md mx-auto">
              Supported formats: .xlsx, .xls, .csv, .tsv, .json, .jsonl. Files are parsed in-browser in chunks (up to 100,000+ rows).
            </p>

            {parsingProgress && (
              <div className="mt-5 max-w-xs mx-auto">
                <div className="w-full bg-[#E2E8F0] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#C9A227] h-full transition-all duration-300"
                    style={{ width: `${parsingProgress.percent}%` }}
                  />
                </div>
                <p className="text-[11px] text-[#5B6678] mt-1.5 font-medium">{parsingProgress.message}</p>
              </div>
            )}
          </div>

          {/* Current Active Dataset Summary Card */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#0B1F3A] flex items-center gap-2">
                <Database className="w-4 h-4 text-[#C9A227]" />
                Active Verified Dataset
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#E8EDF5] text-[#0B1F3A] font-semibold text-xs">
                Stored in IndexedDB (Saved until explicitly replaced)
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[#5B6678] block text-[11px]">Filename:</span>
                <span className="font-semibold text-[#0B1F3A] truncate block">{activeDatasetName}</span>
              </div>
              <div>
                <span className="text-[#5B6678] block text-[11px]">Total Customer Records:</span>
                <span className="font-semibold text-[#0B1F3A]">{activeDatasetRowCount.toLocaleString()} accounts</span>
              </div>
              <div>
                <span className="text-[#5B6678] block text-[11px]">Quality Score:</span>
                <span className="font-semibold text-[#8A6E12]">
                  {validationReport ? `${validationReport.overallQualityScore}/100` : '96/100'}
                </span>
              </div>
              <div>
                <span className="text-[#5B6678] block text-[11px]">Last Updated:</span>
                <span className="font-semibold text-[#0B1F3A]">
                  {lastUpdatedTimestamp ? new Date(lastUpdatedTimestamp).toLocaleString('en-GB') : 'Just now'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DATA QUALITY AUDIT REPORT */}
      {activeTab === 'quality' && validationReport && (
        <div className="space-y-5">
          {/* Quality Score Bar */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-xl flex flex-col items-center justify-center font-bold text-xl ${
                  validationReport.overallQualityScore >= 80
                    ? 'bg-[#E8EDF5] text-[#0B1F3A] border border-[#CBD5E1]'
                    : 'bg-[#F3DCDC] text-[#8B1A1A] border border-[#B23A3A]'
                }`}
              >
                <span>{validationReport.overallQualityScore}</span>
                <span className="text-[9px] uppercase font-normal tracking-wider">/ 100</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#0B1F3A]">
                  Data Quality & Health Index: {validationReport.overallQualityScore >= 80 ? 'Production Ready' : 'Issues Detected'}
                </h3>
                <p className="text-xs text-[#5B6678] mt-0.5">
                  Audit evaluated {validationReport.totalRows.toLocaleString()} rows against 38 canonical schema constraints.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[#8B1A1A] font-bold mr-1">{validationReport.errorCount}</span> Errors
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[#8A6E12] font-bold mr-1">{validationReport.warningCount}</span> Warnings
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[#0B1F3A] font-bold mr-1">{validationReport.duplicateIdCount}</span> Deduplicated IDs
              </div>
            </div>
          </div>

          {/* Issues Table */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#0B1F3A]">
                  Data Quality Findings & Recommended Remediation
                </h3>
                <p className="text-xs text-[#5B6678] mt-0.5">
                  Showing detected inconsistencies across structural, range, and business logic rules.
                </p>
              </div>

              <button
                onClick={() => exportTableToCsv(validationReport.issues, 'data_quality_issues')}
                className="flex items-center gap-1 px-3 py-1 rounded-md border border-[#CBD5E1] text-xs font-semibold text-[#0B1F3A] hover:bg-[#F8FAFC]"
              >
                <Download className="w-3.5 h-3.5" /> Export Issues CSV
              </button>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8FAFC] text-[#0B1F3A] font-semibold sticky top-0 border-b border-[#E2E8F0]">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Customer ID</th>
                    <th className="px-3 py-2">Column</th>
                    <th className="px-3 py-2">Observed Value</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Diagnostic Finding</th>
                    <th className="px-3 py-2">Remediation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {validationReport.issues.slice(0, 30).map((issue) => (
                    <tr key={issue.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-3 py-2 text-[#5B6678] font-code">{issue.rowNumber}</td>
                      <td className="px-3 py-2 font-code font-semibold text-[#0B1F3A]">{issue.customerId}</td>
                      <td className="px-3 py-2 text-[#1B2433]">{issue.column}</td>
                      <td className="px-3 py-2 font-code text-[#5B6678] max-w-xs truncate">{String(issue.value)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            issue.severity === 'Error'
                              ? 'bg-[#F3DCDC] text-[#8B1A1A]'
                              : 'bg-[#C9A227]/20 text-[#8A6E12]'
                          }`}
                        >
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#1B2433]">{issue.issue}</td>
                      <td className="px-3 py-2 text-[#5B6678]">{issue.suggestedFix}</td>
                    </tr>
                  ))}
                  {validationReport.issues.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-[#5B6678]">
                        <CheckCircle2 className="w-8 h-8 text-[#0B1F3A] mx-auto mb-2" />
                        No validation errors or warnings found. Dataset passes all canonical checks.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CLEANING LOG */}
      {activeTab === 'cleaning' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0B1F3A]">
                Automated Cleaning & Transformation Audit Log
              </h3>
              <p className="text-xs text-[#5B6678] mt-0.5">
                All transformations are logged deterministically. Raw data is never modified destructively.
              </p>
            </div>
            <button
              onClick={() => exportTableToCsv(cleaningLog, 'cleaning_log')}
              className="flex items-center gap-1 px-3 py-1 rounded-md border border-[#CBD5E1] text-xs font-semibold text-[#0B1F3A] hover:bg-[#F8FAFC]"
            >
              <Download className="w-3.5 h-3.5" /> Export Log
            </button>
          </div>

          <div className="space-y-3">
            {cleaningLog.map((log, i) => (
              <div key={i} className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-start gap-3">
                <Check className="w-4 h-4 text-[#C9A227] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-[#0B1F3A]">{log.action}</span>
                    <span className="text-[11px] font-bold text-[#5B6678] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                      {log.count.toLocaleString()} rows affected
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6678] mt-1">{log.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: DATASET VERSIONS */}
      {activeTab === 'versions' && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs p-5">
          <h3 className="text-sm font-bold text-[#0B1F3A] mb-1">
            Dataset Version History (IndexedDB)
          </h3>
          <p className="text-xs text-[#5B6678] mb-4">
            BritConnect maintains prior dataset versions. You can restore previous snapshots or download backups.
          </p>

          <div className="space-y-3">
            {datasetVersions.map((v) => (
              <div
                key={v.id}
                className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                  v.isActive ? 'border-[#0B1F3A] bg-[#E8EDF5]/40' : 'border-[#E2E8F0] bg-white'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#0B1F3A]">Version {v.versionNumber}: {v.filename}</span>
                    {v.isActive && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0B1F3A] text-white">
                        Active Dataset
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5B6678] mt-1">
                    Uploaded: {new Date(v.uploadedAt).toLocaleString('en-GB')} · {v.rowCount.toLocaleString()} customers
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!v.isActive && (
                    <button
                      onClick={() => restoreDatasetVersion(v.id)}
                      className="px-3 py-1 rounded-md bg-[#0B1F3A] text-white text-xs font-semibold hover:bg-[#14305C]"
                    >
                      Restore Version
                    </button>
                  )}
                  <button
                    onClick={() => exportTableToCsv(v.cleanedRows, `BritConnect_${v.filename}`)}
                    className="p-1.5 rounded-md border border-[#CBD5E1] text-[#5B6678] hover:text-[#0B1F3A]"
                    title="Export CSV backup"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UPLOAD MODAL (Section 3: Append / Merge vs Replace) */}
      {pendingUpload && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-[#E2E8F0]">
            <h3 className="text-base font-bold text-[#0B1F3A]">
              Confirm Dataset Ingestion: {pendingUpload.filename}
            </h3>
            <p className="text-xs text-[#5B6678] mt-1">
              Parsed <strong>{pendingUpload.rawRows.length.toLocaleString()} customer records</strong>. Choose how this file updates your platform:
            </p>

            <div className="my-4 space-y-3">
              <label
                onClick={() => setUploadChoice('replace')}
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  uploadChoice === 'replace'
                    ? 'border-[#0B1F3A] bg-[#E8EDF5]/40'
                    : 'border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                <input
                  type="radio"
                  name="uploadMode"
                  checked={uploadChoice === 'replace'}
                  onChange={() => setUploadChoice('replace')}
                  className="mt-1"
                />
                <div>
                  <span className="font-bold text-xs text-[#0B1F3A] block">
                    Replace Active Dataset (Recommended)
                  </span>
                  <span className="text-xs text-[#5B6678]">
                    Archives the current dataset version in IndexedDB and promotes the new file as active.
                  </span>
                </div>
              </label>

              <label
                onClick={() => setUploadChoice('append')}
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  uploadChoice === 'append'
                    ? 'border-[#0B1F3A] bg-[#E8EDF5]/40'
                    : 'border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
                <input
                  type="radio"
                  name="uploadMode"
                  checked={uploadChoice === 'append'}
                  onChange={() => setUploadChoice('append')}
                  className="mt-1"
                />
                <div>
                  <span className="font-bold text-xs text-[#0B1F3A] block">
                    Append & Merge with Existing Base
                  </span>
                  <span className="text-xs text-[#5B6678]">
                    Adds new accounts; existing Customer IDs are updated with newer records.
                  </span>
                </div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#F1F5F9]">
              <button
                onClick={() => setPendingUpload(null)}
                className="px-3.5 py-1.5 rounded-lg border border-[#CBD5E1] text-xs font-semibold text-[#5B6678] hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUpload}
                className="px-4 py-1.5 rounded-lg bg-[#0B1F3A] hover:bg-[#14305C] text-white text-xs font-semibold"
              >
                Confirm Ingestion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
