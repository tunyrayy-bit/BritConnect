/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Column Mapping Engine
 */

import { DATA_DICTIONARY, DictionaryField } from '../data/dictionary';

export interface ColumnMappingItem {
  rawHeader: string;
  mappedFieldKey: string | null; // canonical normalizedKey or null if unmapped
  mappedFieldName: string | null;
  confidence: number; // 0 to 1
  isManualOverride: boolean;
  sampleValues: any[];
}

export interface MappingAssessment {
  mappings: ColumnMappingItem[];
  missingKeyColumns: string[];
  isViableForTraining: boolean;
  isViableForScoringOnly: boolean;
  unmappedColumns: string[];
}

/**
 * Clean string for comparison by removing non-alphanumeric chars and lowercasing
 */
function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Compute simple Levenshtein-based similarity between two strings (0 to 1)
 */
function calculateSimilarity(a: string, b: string): number {
  const s1 = normalizeString(a);
  const s2 = normalizeString(b);
  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.88;

  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  const distance = track[s2.length][s1.length];
  const maxLen = Math.max(s1.length, s2.length);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Automatically match raw table headers to the authoritative Data Dictionary
 */
export function autoMapColumns(
  rawHeaders: string[],
  sampleRows: Record<string, any>[]
): MappingAssessment {
  const mappings: ColumnMappingItem[] = [];
  const assignedKeys = new Set<string>();

  for (const rawHeader of rawHeaders) {
    let bestMatch: DictionaryField | null = null;
    let highestSim = 0;

    for (const dictField of DATA_DICTIONARY) {
      // Direct exact equality of normalized string
      if (normalizeString(rawHeader) === normalizeString(dictField.name)) {
        bestMatch = dictField;
        highestSim = 1.0;
        break;
      }
      if (normalizeString(rawHeader) === normalizeString(dictField.normalizedKey)) {
        bestMatch = dictField;
        highestSim = 1.0;
        break;
      }

      // Check common aliases
      const aliases: Record<string, string[]> = {
        'Customer ID': ['cust_id', 'customer_id', 'client_id', 'account_number', 'account_id', 'cid', 'id'],
        'Customer Segment': ['segment', 'customer_type', 'segmentation', 'account_type'],
        'Satisfaction Score 1 10': ['satisfaction', 'csat', 'satisfaction_score', 'sat_score'],
        'NPS Score': ['nps', 'net_promoter_score', 'advocacy'],
        'Monthly Charge GBP': ['monthly_charge', 'charge', 'mrr', 'monthly_fee', 'arpu', 'monthly_bill'],
        'Tenure Months': ['tenure', 'months_active', 'tenure_m'],
        'Churn Flag': ['churn', 'is_churn', 'churn_label', 'target', 'churned'],
        'Churn Status': ['status', 'account_status', 'customer_status'],
        'Average Monthly Usage GB': ['data_usage', 'usage_gb', 'avg_usage', 'data_used'],
        'Data Allowance GB': ['allowance', 'data_cap', 'quota_gb'],
        'Overage Charges GBP': ['overage', 'extra_charges', 'overage_fee'],
        'Network Outages 12M': ['outages', 'outage_count', 'network_faults'],
        'Support Tickets 12M': ['tickets', 'ticket_count', 'cases', 'support_calls'],
        'Complaints 12M': ['complaints', 'escalations']
      };

      if (aliases[dictField.name]) {
        if (aliases[dictField.name].some(alias => normalizeString(alias) === normalizeString(rawHeader))) {
          if (0.95 > highestSim) {
            highestSim = 0.95;
            bestMatch = dictField;
          }
        }
      }

      // Similarity score
      const sim = calculateSimilarity(rawHeader, dictField.name);
      if (sim > highestSim && sim >= 0.55) {
        highestSim = sim;
        bestMatch = dictField;
      }
    }

    const sampleVals = sampleRows.slice(0, 5).map(r => r[rawHeader]).filter(v => v !== undefined && v !== '');

    if (bestMatch && highestSim >= 0.6 && !assignedKeys.has(bestMatch.normalizedKey)) {
      assignedKeys.add(bestMatch.normalizedKey);
      mappings.push({
        rawHeader,
        mappedFieldKey: bestMatch.normalizedKey,
        mappedFieldName: bestMatch.name,
        confidence: Math.round(highestSim * 100) / 100,
        isManualOverride: false,
        sampleValues: sampleVals
      });
    } else {
      mappings.push({
        rawHeader,
        mappedFieldKey: null,
        mappedFieldName: null,
        confidence: 0,
        isManualOverride: false,
        sampleValues: sampleVals
      });
    }
  }

  // Check key columns
  const mappedKeys = new Set(mappings.map(m => m.mappedFieldKey).filter(Boolean));
  const hasCustomerId = mappedKeys.has('customerId');
  const hasChurnFlag = mappedKeys.has('churnFlag');
  const hasChurnStatus = mappedKeys.has('churnStatus');

  const missingKeyColumns: string[] = [];
  if (!hasCustomerId) missingKeyColumns.push('Customer ID');
  if (!hasChurnFlag && !hasChurnStatus) missingKeyColumns.push('Churn Flag or Churn Status');

  const unmappedColumns = mappings.filter(m => !m.mappedFieldKey).map(m => m.rawHeader);

  return {
    mappings,
    missingKeyColumns,
    isViableForTraining: hasCustomerId && (hasChurnFlag || hasChurnStatus),
    isViableForScoringOnly: hasCustomerId,
    unmappedColumns
  };
}
