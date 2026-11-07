/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Zustand Global Application State Store
 */

import { create } from 'zustand';
import { BritConnectCustomer, CustomerScore } from '../data/dictionary';
import { DatasetVersionRecord, AppSettings, DEFAULT_SETTINGS, getActiveDataset, saveDatasetVersion, getAllDatasetVersions, getChampionModel, saveChampionModel, getScores, saveScores, getAllCampaigns, saveCampaign, getSettings, saveSettings } from '../storage/db';
import { ChampionModelRecord, TrainingProgressUpdate } from '../ml/types';
import { CampaignRecord, generateDefaultCampaigns } from '../campaigns/engine';
import { SegmentSummary, buildRiskValueMatrix, generateRuleBasedSegments, computeKMeansClusters } from '../segmentation/engine';
import { RecommendationCardData, generateRecommendation } from '../recommendations/engine';
import { ChatMessage } from '../chat/engine';
import { generateSampleDataset } from '../ingestion/parser';
import { cleanCustomerData } from '../cleaning/cleaner';
import { validateDataset, ValidationReport } from '../validation/validator';
import { engineerFeatures } from '../features/engineer';
import { runTrainingPipeline, scoreCustomers } from '../ml/service';

export interface GlobalFilters {
  customerSegment: string;
  ukNation: string;
  serviceType: string;
  contractType: string;
  acquisitionChannel: string;
  riskTier: string;
  searchQuery: string;
}

export const INITIAL_FILTERS: GlobalFilters = {
  customerSegment: 'All',
  ukNation: 'All',
  serviceType: 'All',
  contractType: 'All',
  acquisitionChannel: 'All',
  riskTier: 'All',
  searchQuery: ''
};

export interface AppState {
  // Navigation & Layout
  currentPage: string;
  isChatDrawerOpen: boolean;
  selectedCustomerId: string | null;
  activeDatasetId: string | null;
  activeDatasetName: string;
  activeDatasetRowCount: number;
  lastUpdatedTimestamp: string;
  isStaleModel: boolean;
  
  // Data
  customers: BritConnectCustomer[];
  filteredCustomers: BritConnectCustomer[];
  scores: CustomerScore[];
  scoresMap: Map<string, CustomerScore>;
  validationReport: ValidationReport | null;
  cleaningLog: any[];
  datasetVersions: DatasetVersionRecord[];

  // Models & ML
  championModel: ChampionModelRecord | null;
  isTraining: boolean;
  trainingProgress: TrainingProgressUpdate | null;

  // Segments & Campaigns
  ruleBasedSegments: SegmentSummary[];
  riskValueMatrix: any;
  kMeansResult: any;
  campaigns: CampaignRecord[];

  // Recommendations
  companyRecommendation: RecommendationCardData | null;
  recommendationsCache: Map<string, RecommendationCardData>;

  // Chat
  chatMessages: ChatMessage[];

  // Settings & Filters
  settings: AppSettings;
  filters: GlobalFilters;
  isLoadingInitialData: boolean;

  // Actions
  setCurrentPage: (page: string) => void;
  setChatDrawerOpen: (open: boolean) => void;
  setSelectedCustomerId: (id: string | null) => void;
  setFilters: (filters: Partial<GlobalFilters>) => void;
  resetFilters: () => void;
  loadInitialData: () => Promise<void>;
  loadSampleData: () => Promise<void>;
  handleDatasetUpload: (
    rawRows: Record<string, any>[],
    filename: string,
    mode: 'replace' | 'append'
  ) => Promise<{ added: number; updated: number; total: number }>;
  trainModel: () => Promise<void>;
  addCampaign: (campaign: CampaignRecord) => Promise<void>;
  addChatMessage: (msg: ChatMessage) => void;
  clearChat: () => void;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  restoreDatasetVersion: (versionId: string) => Promise<void>;
  deleteDatasetVersionRecord: (versionId: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'dashboard',
  isChatDrawerOpen: false,
  selectedCustomerId: null,
  activeDatasetId: null,
  activeDatasetName: 'No active dataset',
  activeDatasetRowCount: 0,
  lastUpdatedTimestamp: '',
  isStaleModel: false,

  customers: [],
  filteredCustomers: [],
  scores: [],
  scoresMap: new Map(),
  validationReport: null,
  cleaningLog: [],
  datasetVersions: [],

  championModel: null,
  isTraining: false,
  trainingProgress: null,

  ruleBasedSegments: [],
  riskValueMatrix: null,
  kMeansResult: null,
  campaigns: [],

  companyRecommendation: null,
  recommendationsCache: new Map(),
  chatMessages: [],

  settings: DEFAULT_SETTINGS,
  filters: INITIAL_FILTERS,
  isLoadingInitialData: true,

  setCurrentPage: (page) => set({ currentPage: page }),
  setChatDrawerOpen: (open) => set({ isChatDrawerOpen: open }),
  setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),

  setFilters: (partial) => {
    const newFilters = { ...get().filters, ...partial };
    const filtered = applyFilters(get().customers, get().scoresMap, newFilters);
    set({ filters: newFilters, filteredCustomers: filtered });
  },

  resetFilters: () => {
    const filtered = applyFilters(get().customers, get().scoresMap, INITIAL_FILTERS);
    set({ filters: INITIAL_FILTERS, filteredCustomers: filtered });
  },

  loadInitialData: async () => {
    set({ isLoadingInitialData: true });
    try {
      const settings = await getSettings();
      const versions = await getAllDatasetVersions();
      const activeDs = await getActiveDataset();

      let campaigns = await getAllCampaigns();

      if (activeDs) {
        const scores = await getScores(activeDs.id) || [];
        const scoresMap = new Map(scores.map(s => [s.customerId, s]));
        const model = await getChampionModel(activeDs.id);

        if (!campaigns.length) {
          campaigns = generateDefaultCampaigns(activeDs.cleanedRows.map(c => ({ customerId: c.customerId, monthlyChargeGbp: c.monthlyChargeGbp })));
          for (const c of campaigns) await saveCampaign(c);
        }

        const segments = generateRuleBasedSegments(activeDs.cleanedRows, scoresMap, settings.snapshotDate);
        const matrix = buildRiskValueMatrix(activeDs.cleanedRows, scoresMap);
        const kMeans = computeKMeansClusters(activeDs.cleanedRows, scoresMap, 4);
        const companyRec = await generateRecommendation(activeDs.cleanedRows, scores, model, 'company');

        const filtered = applyFilters(activeDs.cleanedRows, scoresMap, get().filters);

        set({
          settings,
          datasetVersions: versions,
          activeDatasetId: activeDs.id,
          activeDatasetName: activeDs.filename,
          activeDatasetRowCount: activeDs.rowCount,
          lastUpdatedTimestamp: activeDs.uploadedAt,
          customers: activeDs.cleanedRows,
          filteredCustomers: filtered,
          validationReport: activeDs.validationReport,
          cleaningLog: activeDs.cleaningLog,
          scores,
          scoresMap,
          championModel: model,
          campaigns,
          ruleBasedSegments: segments,
          riskValueMatrix: matrix,
          kMeansResult: kMeans,
          companyRecommendation: companyRec,
          isLoadingInitialData: false
        });
      } else {
        // No saved dataset: automatically bootstrap with the high-fidelity sample data!
        await get().loadSampleData();
      }
    } catch (e) {
      console.error('Failed to load initial data:', e);
      set({ isLoadingInitialData: false });
    }
  },

  loadSampleData: async () => {
    set({ isLoadingInitialData: true });
    try {
      const rawSample = generateSampleDataset(1200);
      const validationReport = validateDataset(rawSample);
      const { cleanedRows, cleaningLog } = cleanCustomerData(rawSample);

      const datasetId = `sample-dataset-${Date.now()}`;
      const versionRecord: DatasetVersionRecord = {
        id: datasetId,
        versionNumber: 1,
        filename: 'BritConnect_Synthetic_Customer_Base_Nov2026.xlsx',
        uploadedAt: new Date().toISOString(),
        rowCount: cleanedRows.length,
        isActive: true,
        rawMetadata: {
          filename: 'BritConnect_Synthetic_Customer_Base_Nov2026.xlsx',
          fileSize: 420000,
          rawHeaders: Object.keys(rawSample[0]),
          totalRows: rawSample.length
        },
        cleanedRows,
        validationReport,
        cleaningLog
      };

      await saveDatasetVersion(versionRecord);

      // Train initial model on sample
      const featureMatrix = engineerFeatures(cleanedRows);
      const champion = await runTrainingPipeline({
        featureMatrix,
        datasetId,
        datasetName: versionRecord.filename
      });

      await saveChampionModel(champion);

      const scores = scoreCustomers(cleanedRows, champion, featureMatrix);
      await saveScores(datasetId, champion.id, scores);
      const scoresMap = new Map(scores.map(s => [s.customerId, s]));

      const campaigns = generateDefaultCampaigns(cleanedRows.map(c => ({ customerId: c.customerId, monthlyChargeGbp: c.monthlyChargeGbp })));
      for (const camp of campaigns) await saveCampaign(camp);

      const segments = generateRuleBasedSegments(cleanedRows, scoresMap);
      const matrix = buildRiskValueMatrix(cleanedRows, scoresMap);
      const kMeans = computeKMeansClusters(cleanedRows, scoresMap, 4);
      const companyRec = await generateRecommendation(cleanedRows, scores, champion, 'company');

      const versions = await getAllDatasetVersions();
      const filtered = applyFilters(cleanedRows, scoresMap, get().filters);

      set({
        activeDatasetId: datasetId,
        activeDatasetName: versionRecord.filename,
        activeDatasetRowCount: cleanedRows.length,
        lastUpdatedTimestamp: versionRecord.uploadedAt,
        customers: cleanedRows,
        filteredCustomers: filtered,
        validationReport,
        cleaningLog,
        championModel: champion,
        scores,
        scoresMap,
        campaigns,
        ruleBasedSegments: segments,
        riskValueMatrix: matrix,
        kMeansResult: kMeans,
        companyRecommendation: companyRec,
        datasetVersions: versions,
        isStaleModel: false,
        isLoadingInitialData: false
      });
    } catch (e) {
      console.error('Error loading sample data:', e);
      set({ isLoadingInitialData: false });
    }
  },

  handleDatasetUpload: async (rawRows, filename, mode) => {
    let combinedRows = rawRows;
    let addedCount = rawRows.length;
    let updatedCount = 0;

    if (mode === 'append' && get().customers.length > 0) {
      const existingMap = new Map<string, Record<string, any>>(get().customers.map(c => [c.customerId, c]));
      addedCount = 0;
      updatedCount = 0;

      for (const row of rawRows) {
        const id = String(row.customerId || row['Customer ID'] || '');
        if (existingMap.has(id)) {
          updatedCount++;
        } else {
          addedCount++;
        }
        existingMap.set(id, row);
      }
      combinedRows = Array.from(existingMap.values());
    }

    const validationReport = validateDataset(combinedRows);
    const { cleanedRows, cleaningLog } = cleanCustomerData(combinedRows);

    const versions = await getAllDatasetVersions();
    const nextVersionNum = versions.length + 1;
    const datasetId = `ds-v${nextVersionNum}-${Date.now()}`;

    const versionRecord: DatasetVersionRecord = {
      id: datasetId,
      versionNumber: nextVersionNum,
      filename,
      uploadedAt: new Date().toISOString(),
      rowCount: cleanedRows.length,
      isActive: true,
      rawMetadata: {
        filename,
        fileSize: rawRows.length * 280,
        rawHeaders: Object.keys(rawRows[0] || {}),
        totalRows: rawRows.length
      },
      cleanedRows,
      validationReport,
      cleaningLog
    };

    await saveDatasetVersion(versionRecord);
    const allVersions = await getAllDatasetVersions();

    const filtered = applyFilters(cleanedRows, get().scoresMap, get().filters);

    set({
      activeDatasetId: datasetId,
      activeDatasetName: filename,
      activeDatasetRowCount: cleanedRows.length,
      lastUpdatedTimestamp: versionRecord.uploadedAt,
      customers: cleanedRows,
      filteredCustomers: filtered,
      validationReport,
      cleaningLog,
      datasetVersions: allVersions,
      isStaleModel: true // Flag model as stale until user triggers retrain!
    });

    return { added: addedCount, updated: updatedCount, total: cleanedRows.length };
  },

  trainModel: async () => {
    const { customers, activeDatasetId, activeDatasetName, settings } = get();
    if (!customers.length || !activeDatasetId) return;

    set({ isTraining: true });
    try {
      const featureMatrix = engineerFeatures(customers, {
        snapshotDate: settings.snapshotDate,
        includeDemographics: false
      });

      const champion = await runTrainingPipeline({
        featureMatrix,
        costParams: settings.costModelParams,
        datasetId: activeDatasetId,
        datasetName: activeDatasetName,
        onProgress: (p) => set({ trainingProgress: p })
      });

      await saveChampionModel(champion);

      const scores = scoreCustomers(customers, champion, featureMatrix);
      await saveScores(activeDatasetId, champion.id, scores);
      const scoresMap = new Map(scores.map(s => [s.customerId, s]));

      const segments = generateRuleBasedSegments(customers, scoresMap, settings.snapshotDate);
      const matrix = buildRiskValueMatrix(customers, scoresMap);
      const kMeans = computeKMeansClusters(customers, scoresMap, 4);
      const companyRec = await generateRecommendation(customers, scores, champion, 'company');

      const filtered = applyFilters(customers, scoresMap, get().filters);

      set({
        championModel: champion,
        scores,
        scoresMap,
        ruleBasedSegments: segments,
        riskValueMatrix: matrix,
        kMeansResult: kMeans,
        companyRecommendation: companyRec,
        filteredCustomers: filtered,
        isStaleModel: false,
        isTraining: false,
        trainingProgress: null
      });
    } catch (e) {
      console.error('Model training failed:', e);
      set({ isTraining: false, trainingProgress: null });
    }
  },

  addCampaign: async (campaign) => {
    await saveCampaign(campaign);
    set({ campaigns: [campaign, ...get().campaigns] });
  },

  addChatMessage: (msg) => {
    set({ chatMessages: [...get().chatMessages, msg] });
  },

  clearChat: () => {
    set({ chatMessages: [] });
  },

  updateSettings: async (newSettings) => {
    const updated = { ...get().settings, ...newSettings };
    await saveSettings(updated);
    set({ settings: updated });
  },

  restoreDatasetVersion: async (versionId) => {
    const versions = await getAllDatasetVersions();
    const target = versions.find(v => v.id === versionId);
    if (!target) return;

    target.isActive = true;
    await saveDatasetVersion(target);

    const scores = await getScores(target.id) || [];
    const scoresMap = new Map(scores.map(s => [s.customerId, s]));
    const model = await getChampionModel(target.id);

    const segments = generateRuleBasedSegments(target.cleanedRows, scoresMap);
    const matrix = buildRiskValueMatrix(target.cleanedRows, scoresMap);
    const kMeans = computeKMeansClusters(target.cleanedRows, scoresMap, 4);

    const allVersions = await getAllDatasetVersions();
    const filtered = applyFilters(target.cleanedRows, scoresMap, get().filters);

    set({
      activeDatasetId: target.id,
      activeDatasetName: target.filename,
      activeDatasetRowCount: target.rowCount,
      lastUpdatedTimestamp: target.uploadedAt,
      customers: target.cleanedRows,
      filteredCustomers: filtered,
      validationReport: target.validationReport,
      cleaningLog: target.cleaningLog,
      datasetVersions: allVersions,
      scores,
      scoresMap,
      championModel: model,
      ruleBasedSegments: segments,
      riskValueMatrix: matrix,
      kMeansResult: kMeans,
      isStaleModel: !model
    });
  },

  deleteDatasetVersionRecord: async (versionId) => {
    const versions = get().datasetVersions.filter(v => v.id !== versionId);
    set({ datasetVersions: versions });
  }
}));

function applyFilters(
  customers: BritConnectCustomer[],
  scoresMap: Map<string, CustomerScore>,
  filters: GlobalFilters
): BritConnectCustomer[] {
  return customers.filter(c => {
    if (filters.customerSegment !== 'All' && c.customerSegment !== filters.customerSegment) return false;
    if (filters.ukNation !== 'All' && c.ukNation !== filters.ukNation) return false;
    if (filters.serviceType !== 'All' && c.serviceType !== filters.serviceType) return false;
    if (filters.contractType !== 'All' && c.contractType !== filters.contractType) return false;
    if (filters.acquisitionChannel !== 'All' && c.acquisitionChannel !== filters.acquisitionChannel) return false;

    if (filters.riskTier !== 'All') {
      const s = scoresMap.get(c.customerId);
      const tier = s?.riskTier || 'Low';
      if (tier !== filters.riskTier) return false;
    }

    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchId = c.customerId.toLowerCase().includes(q);
      const matchCity = c.city.toLowerCase().includes(q);
      const matchPlan = c.planName.toLowerCase().includes(q);
      if (!matchId && !matchCity && !matchPlan) return false;
    }

    return true;
  });
}
