/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * IndexedDB Persistence Layer using `idb`
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { BritConnectCustomer, CustomerScore } from '../data/dictionary';
import { ValidationReport } from '../validation/validator';
import { CleaningLogEntry } from '../cleaning/cleaner';
import { ChampionModelRecord } from '../ml/types';
import { CampaignRecord } from '../campaigns/engine';
import { RecommendationCardData } from '../recommendations/engine';
import { ChatMessage } from '../chat/engine';

export interface DatasetVersionRecord {
  id: string;
  versionNumber: number;
  filename: string;
  uploadedAt: string;
  rowCount: number;
  isActive: boolean;
  rawMetadata: {
    filename: string;
    fileSize: number;
    rawHeaders: string[];
    totalRows: number;
  };
  cleanedRows: BritConnectCustomer[];
  validationReport: ValidationReport;
  cleaningLog: CleaningLogEntry[];
}

export interface AppSettings {
  snapshotDate: string;
  costModelParams: {
    contactCostGbp: number;
    offerCostGbp: number;
    acceptanceRate: number;
    avgRevenueSavedGbp: number;
    costOfMissedChurnerGbp: number;
  };
  riskThresholds: {
    critical: number; // e.g. 0.75
    high: number;     // e.g. 0.50
    medium: number;   // e.g. 0.25
  };
  isAiEnabled: boolean;
  privacyNoticeAcknowledged: boolean;
  theme: 'light' | 'dark';
}

interface BritConnectDBSchema extends DBSchema {
  datasets: {
    key: string;
    value: DatasetVersionRecord;
    indexes: { 'by-date': string; 'by-active': number };
  };
  models: {
    key: string;
    value: ChampionModelRecord;
    indexes: { 'by-dataset': string };
  };
  scores: {
    key: string;
    value: {
      datasetId: string;
      modelId: string;
      scoredAt: string;
      scores: CustomerScore[];
    };
  };
  campaigns: {
    key: string;
    value: CampaignRecord;
  };
  recommendations: {
    key: string;
    value: RecommendationCardData;
  };
  chat_history: {
    key: string;
    value: { id: string; messages: ChatMessage[]; updatedAt: string };
  };
  settings: {
    key: string;
    value: AppSettings;
  };
}

const DB_NAME = 'britconnect-churn-platform';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BritConnectDBSchema>> | null = null;

export function getDatabase(): Promise<IDBPDatabase<BritConnectDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<BritConnectDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('datasets')) {
          const dsStore = db.createObjectStore('datasets', { keyPath: 'id' });
          dsStore.createIndex('by-date', 'uploadedAt');
        }
        if (!db.objectStoreNames.contains('models')) {
          const modelStore = db.createObjectStore('models', { keyPath: 'id' });
          modelStore.createIndex('by-dataset', 'datasetId');
        }
        if (!db.objectStoreNames.contains('scores')) {
          db.createObjectStore('scores', { keyPath: 'datasetId' });
        }
        if (!db.objectStoreNames.contains('campaigns')) {
          db.createObjectStore('campaigns', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('recommendations')) {
          db.createObjectStore('recommendations', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chat_history')) {
          db.createObjectStore('chat_history', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

// ----------------- DATASET PERSISTENCE -----------------

export async function saveDatasetVersion(dataset: DatasetVersionRecord): Promise<void> {
  const db = await getDatabase();
  const tx = db.transaction('datasets', 'readwrite');
  
  // If this version is marked active, deactivate others
  if (dataset.isActive) {
    const all = await tx.store.getAll();
    for (const d of all) {
      if (d.id !== dataset.id && d.isActive) {
        d.isActive = false;
        await tx.store.put(d);
      }
    }
  }

  await tx.store.put(dataset);
  await tx.done;
}

export async function getActiveDataset(): Promise<DatasetVersionRecord | null> {
  const db = await getDatabase();
  const all = await db.getAll('datasets');
  const active = all.find(d => d.isActive);
  if (active) return active;
  if (all.length > 0) {
    all.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    return all[0];
  }
  return null;
}

export async function getAllDatasetVersions(): Promise<DatasetVersionRecord[]> {
  const db = await getDatabase();
  const all = await db.getAll('datasets');
  return all.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

export async function deleteDatasetVersion(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete('datasets', id);
}

export async function setActiveDatasetVersion(id: string): Promise<DatasetVersionRecord | null> {
  const db = await getDatabase();
  const tx = db.transaction('datasets', 'readwrite');
  const all = await tx.store.getAll();
  let activated: DatasetVersionRecord | null = null;

  for (const d of all) {
    if (d.id === id) {
      d.isActive = true;
      activated = d;
    } else {
      d.isActive = false;
    }
    await tx.store.put(d);
  }

  await tx.done;
  return activated;
}

// ----------------- MODEL PERSISTENCE -----------------

export async function saveChampionModel(model: ChampionModelRecord): Promise<void> {
  const db = await getDatabase();
  await db.put('models', model);
}

export async function getChampionModel(datasetId?: string): Promise<ChampionModelRecord | null> {
  const db = await getDatabase();
  const all = await db.getAll('models');
  if (!all.length) return null;
  if (datasetId) {
    const matching = all.filter(m => m.datasetId === datasetId);
    if (matching.length) {
      matching.sort((a, b) => new Date(b.trainedAt).getTime() - new Date(a.trainedAt).getTime());
      return matching[0];
    }
  }
  all.sort((a, b) => new Date(b.trainedAt).getTime() - new Date(a.trainedAt).getTime());
  return all[0];
}

// ----------------- SCORES PERSISTENCE -----------------

export async function saveScores(datasetId: string, modelId: string, scores: CustomerScore[]): Promise<void> {
  const db = await getDatabase();
  await db.put('scores', {
    datasetId,
    modelId,
    scoredAt: new Date().toISOString(),
    scores
  });
}

export async function getScores(datasetId: string): Promise<CustomerScore[] | null> {
  const db = await getDatabase();
  const record = await db.get('scores', datasetId);
  return record ? record.scores : null;
}

// ----------------- CAMPAIGNS PERSISTENCE -----------------

export async function saveCampaign(campaign: CampaignRecord): Promise<void> {
  const db = await getDatabase();
  await db.put('campaigns', campaign);
}

export async function getAllCampaigns(): Promise<CampaignRecord[]> {
  const db = await getDatabase();
  return db.getAll('campaigns');
}

// ----------------- SETTINGS & CLEANUP -----------------

export const DEFAULT_SETTINGS: AppSettings = {
  snapshotDate: '2026-11-01',
  costModelParams: {
    contactCostGbp: 5.0,
    offerCostGbp: 30.0,
    acceptanceRate: 0.25,
    avgRevenueSavedGbp: 350.0,
    costOfMissedChurnerGbp: 500.0
  },
  riskThresholds: {
    critical: 0.75,
    high: 0.50,
    medium: 0.25
  },
  isAiEnabled: true,
  privacyNoticeAcknowledged: true,
  theme: 'light'
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const db = await getDatabase();
    const stored = await db.get('settings', 'app_config' as any);
    return stored ? (stored as any) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDatabase();
  await db.put('settings', { ...(settings as any), id: 'app_config' });
}

export async function clearAllStoredData(): Promise<void> {
  const db = await getDatabase();
  await db.clear('datasets');
  await db.clear('models');
  await db.clear('scores');
  await db.clear('campaigns');
  await db.clear('recommendations');
  await db.clear('chat_history');
}
