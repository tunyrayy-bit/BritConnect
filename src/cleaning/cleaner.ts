/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Automatic Data Cleaning Engine
 */

import { BritConnectCustomer, DATA_DICTIONARY } from '../data/dictionary';
import { parseDateString } from '../validation/validator';

export interface CleaningLogEntry {
  action: string;
  field: string;
  count: number;
  details: string;
}

export interface CleaningResult {
  cleanedRows: BritConnectCustomer[];
  cleaningLog: CleaningLogEntry[];
  imputationStats: Record<string, { globalMedian: number; segmentMedians: Record<string, number> }>;
  winsorLimits: Record<string, { p1: number; p99: number; cappedCount: number }>;
}

export interface CleaningOptions {
  trimWhitespace?: boolean;
  normalizeSpelling?: boolean;
  coerceNumerics?: boolean;
  deduplicateIds?: boolean;
  imputeMissing?: boolean;
  winsorizeOutliers?: boolean;
  preferChurnStatusOverFlag?: boolean;
}

/**
 * Standardize boolean-like / Yes-No text
 */
function standardizeYesNo(val: any): string {
  if (val === null || val === undefined) return 'No';
  const s = String(val).trim().toLowerCase();
  if (['yes', 'y', 'true', '1', 't'].includes(s)) return 'Yes';
  if (['no', 'n', 'false', '0', 'f'].includes(s)) return 'No';
  return String(val).trim();
}

/**
 * Standardize UK Nation spelling
 */
function standardizeNation(val: any): string {
  if (!val) return 'England';
  const s = String(val).trim().toLowerCase().replace(/[^a-z]/g, '');
  if (s.includes('scot')) return 'Scotland';
  if (s.includes('wale') || s.includes('cymru')) return 'Wales';
  if (s.includes('ire') || s.includes('ni') || s.includes('ulster') || s.includes('belfast')) return 'Northern Ireland';
  if (s.includes('eng') || s.includes('london')) return 'England';
  return 'England';
}

/**
 * Clean currency string to clean float
 */
function parseCurrencyOrNumber(val: any, defaultVal: number = 0): number {
  if (val === null || val === undefined || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const s = String(val).trim().toLowerCase();
  if (['n/a', 'null', 'none', '-', '', 'nan'].includes(s)) return defaultVal;
  const cleaned = s.replace(/[£$€,\s]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Clean integer
 */
function parseCleanInt(val: any, defaultVal: number = 0): number {
  const f = parseCurrencyOrNumber(val, defaultVal);
  return Math.round(f);
}

/**
 * Automatically clean and standardize customer dataset
 */
export function cleanCustomerData(
  rawRows: Record<string, any>[],
  options: CleaningOptions = {}
): CleaningResult {
  const {
    trimWhitespace = true,
    normalizeSpelling = true,
    coerceNumerics = true,
    deduplicateIds = true,
    imputeMissing = true,
    winsorizeOutliers = true,
    preferChurnStatusOverFlag = true
  } = options;

  const log: CleaningLogEntry[] = [
    {
      action: 'Date Format Assumption',
      field: 'All Date Columns',
      count: rawRows.length,
      details: 'Parsed using UK day-first convention (DD/MM/YYYY) for ambiguous date strings.'
    }
  ];

  // 1. Remove duplicate customer IDs (keeping latest occurrence)
  const idMap = new Map<string, Record<string, any>>();
  let duplicateCount = 0;

  rawRows.forEach((r, idx) => {
    let id = String(r.customerId ?? r['Customer ID'] ?? '').trim();
    if (!id) id = `AUTO-ID-${idx + 1}`;
    if (idMap.has(id)) {
      duplicateCount++;
    }
    idMap.set(id, r);
  });

  if (duplicateCount > 0 && deduplicateIds) {
    log.push({
      action: 'Deduplicated Customer IDs',
      field: 'Customer ID',
      count: duplicateCount,
      details: `Resolved ${duplicateCount} duplicate ID occurrences by retaining the latest record.`
    });
  }

  const uniqueRows = Array.from(idMap.values());

  // 2. Pre-pass: Compute medians for numeric imputation by customer segment
  const numericFields = [
    'monthlyChargeGbp', 'averageMonthlyUsageGb', 'dataAllowanceGb', 'overageChargesGbp',
    'discountPercent', 'latePayments12m', 'failedPayments12m', 'supportTickets12m',
    'complaints12m', 'averageResolutionHours', 'networkOutages12m', 'satisfactionScore110', 'npsScore'
  ];

  const imputationStats: Record<string, { globalMedian: number; segmentMedians: Record<string, number> }> = {};

  numericFields.forEach(field => {
    const fieldDef = DATA_DICTIONARY.find(d => d.normalizedKey === field);
    const altName = fieldDef?.name;

    const allValues: number[] = [];
    const segmentValues: Record<string, number[]> = { 'Consumer': [], 'Small Business': [] };

    uniqueRows.forEach(row => {
      const rawVal = row[field] ?? (altName ? row[altName] : undefined);
      if (rawVal !== undefined && rawVal !== null && rawVal !== '' && !['n/a', 'null', '-'].includes(String(rawVal).toLowerCase())) {
        const parsed = parseFloat(String(rawVal).replace(/[£,\s]/g, ''));
        if (!isNaN(parsed)) {
          allValues.push(parsed);
          const seg = String(row.customerSegment ?? row['Customer Segment'] ?? 'Consumer').trim();
          if (segmentValues[seg]) segmentValues[seg].push(parsed);
        }
      }
    });

    const getMedian = (arr: number[]) => {
      if (!arr.length) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    imputationStats[field] = {
      globalMedian: getMedian(allValues),
      segmentMedians: {
        'Consumer': segmentValues['Consumer'].length >= 30 ? getMedian(segmentValues['Consumer']) : getMedian(allValues),
        'Small Business': segmentValues['Small Business'].length >= 30 ? getMedian(segmentValues['Small Business']) : getMedian(allValues)
      }
    };
  });

  // Track counts
  let normalizedNationsCount = 0;
  let normalizedBooleansCount = 0;
  let imputedValuesCount = 0;

  // 3. Clean each row into BritConnectCustomer
  const cleanedRows: BritConnectCustomer[] = uniqueRows.map((row, idx) => {
    const getRaw = (key: string) => {
      const dictDef = DATA_DICTIONARY.find(d => d.normalizedKey === key);
      return row[key] ?? (dictDef ? row[dictDef.name] : undefined);
    };

    const customerId = String(getRaw('customerId') || `BC-${10000 + idx}`).trim();
    const rawSegment = String(getRaw('customerSegment') || '').trim();
    const customerSegment = rawSegment.toLowerCase().includes('business') ? 'Small Business' : 'Consumer';

    const rawNation = getRaw('ukNation');
    const ukNation = normalizeSpelling ? standardizeNation(rawNation) : String(rawNation || 'England');
    if (rawNation && ukNation !== rawNation) normalizedNationsCount++;

    const rawAutoRenew = getRaw('autoRenew');
    const autoRenew = normalizeSpelling ? standardizeYesNo(rawAutoRenew) : String(rawAutoRenew || 'No');
    const rawDirectDebit = getRaw('directDebit');
    const directDebit = normalizeSpelling ? standardizeYesNo(rawDirectDebit) : String(rawDirectDebit || 'No');
    const rawCompetitor = getRaw('competitorOfferReceived');
    const competitorOfferReceived = normalizeSpelling ? standardizeYesNo(rawCompetitor) : String(rawCompetitor || 'No');
    if (rawAutoRenew || rawDirectDebit || rawCompetitor) normalizedBooleansCount++;

    // Churn resolution
    const rawChurnStatus = getRaw('churnStatus');
    const rawChurnFlag = getRaw('churnFlag');
    let churnStatus: 'Active' | 'Churned' = 'Active';
    let churnFlag = 0;

    if (preferChurnStatusOverFlag) {
      if (rawChurnStatus && String(rawChurnStatus).trim().toLowerCase() === 'churned') {
        churnStatus = 'Churned';
        churnFlag = 1;
      } else if (rawChurnFlag !== undefined && Number(rawChurnFlag) === 1) {
        churnStatus = 'Churned';
        churnFlag = 1;
      }
    } else {
      if (rawChurnFlag !== undefined && Number(rawChurnFlag) === 1) {
        churnStatus = 'Churned';
        churnFlag = 1;
      } else if (rawChurnStatus && String(rawChurnStatus).trim().toLowerCase() === 'churned') {
        churnStatus = 'Churned';
        churnFlag = 1;
      }
    }

    // Dates
    const joinDateObj = parseDateString(getRaw('joinDate'));
    const joinDate = joinDateObj ? joinDateObj.toISOString().split('T')[0] : '2024-01-01';

    const contractStartObj = parseDateString(getRaw('contractStartDate'));
    const contractStartDate = contractStartObj ? contractStartObj.toISOString().split('T')[0] : joinDate;

    const contractEndObj = parseDateString(getRaw('contractEndDate'));
    const contractEndDate = contractEndObj ? contractEndObj.toISOString().split('T')[0] : undefined;

    const churnDateObj = churnStatus === 'Churned' ? parseDateString(getRaw('churnDate')) : null;
    const churnDate = churnDateObj ? churnDateObj.toISOString().split('T')[0] : undefined;

    const churnReason = churnStatus === 'Churned' ? String(getRaw('churnReason') || 'Competitor Offer / Unknown').trim() : undefined;

    // Numerics with segment-level median imputation
    const getCleanNumeric = (field: string, isInt: boolean = false, min?: number, max?: number) => {
      const rawVal = getRaw(field);
      if (rawVal === undefined || rawVal === null || rawVal === '' || ['n/a', 'null', '-'].includes(String(rawVal).toLowerCase())) {
        imputedValuesCount++;
        const stat = imputationStats[field];
        const val = stat ? (stat.segmentMedians[customerSegment] ?? stat.globalMedian) : 0;
        return isInt ? Math.round(val) : val;
      }
      let n = isInt ? parseCleanInt(rawVal) : parseCurrencyOrNumber(rawVal);
      if (min !== undefined && n < min) n = min;
      if (max !== undefined && n > max) n = max;
      return n;
    };

    const age = getCleanNumeric('age', true, 16, 110) || 40;
    const ageBand = String(getRaw('ageBand') || (age < 25 ? '18-24' : age < 35 ? '25-34' : age < 50 ? '35-49' : age < 65 ? '50-64' : '65+'));
    const gender = String(getRaw('gender') || 'Unknown');
    const city = String(getRaw('city') || 'London');
    const acquisitionChannel = String(getRaw('acquisitionChannel') || 'Website Organic');
    const tenureMonths = getCleanNumeric('tenureMonths', true, 0);
    const serviceType = String(getRaw('serviceType') || 'Fibre Broadband');
    const planName = String(getRaw('planName') || 'Standard Plan');
    const contractType = String(getRaw('contractType') || '12 Months');

    const monthlyChargeGbp = getCleanNumeric('monthlyChargeGbp', false, 0);
    const averageMonthlyUsageGb = getCleanNumeric('averageMonthlyUsageGb', false, 0);
    const dataAllowanceGb = getCleanNumeric('dataAllowanceGb', true, 0);
    const overageChargesGbp = getCleanNumeric('overageChargesGbp', false, 0);
    const discountPercent = getCleanNumeric('discountPercent', false, 0, 100);

    const paymentMethod = String(getRaw('paymentMethod') || (directDebit === 'Yes' ? 'Direct Debit' : 'Credit Card'));
    const latePayments12m = getCleanNumeric('latePayments12m', true, 0);
    const failedPayments12m = getCleanNumeric('failedPayments12m', true, 0);
    const supportTickets12m = getCleanNumeric('supportTickets12m', true, 0);
    const complaints12m = getCleanNumeric('complaints12m', true, 0);
    const averageResolutionHours = getCleanNumeric('averageResolutionHours', false, 0);
    const networkOutages12m = getCleanNumeric('networkOutages12m', true, 0);
    const satisfactionScore110 = getCleanNumeric('satisfactionScore110', true, 1, 10) || 7;
    const npsScore = getCleanNumeric('npsScore', true);

    const lifetimeRevenueGbp = getCleanNumeric('lifetimeRevenueGbp', false, 0) || Math.round(monthlyChargeGbp * Math.max(tenureMonths, 1) * 100) / 100;
    const monthlyRevenueAtRiskGbp = churnStatus === 'Churned' ? 0 : monthlyChargeGbp;

    // Collect any unmapped columns to retain as extra features
    const knownKeys = new Set(DATA_DICTIONARY.map(d => d.normalizedKey).concat(DATA_DICTIONARY.map(d => d.name)));
    const additionalFeatures: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!knownKeys.has(k)) {
        additionalFeatures[k] = v;
      }
    }

    return {
      customerId,
      customerSegment,
      age,
      ageBand,
      gender,
      ukNation,
      city,
      acquisitionChannel,
      joinDate,
      tenureMonths,
      serviceType,
      planName,
      contractType,
      contractStartDate,
      contractEndDate,
      autoRenew,
      monthlyChargeGbp,
      averageMonthlyUsageGb,
      dataAllowanceGb,
      overageChargesGbp,
      discountPercent,
      paymentMethod,
      directDebit,
      latePayments12m,
      failedPayments12m,
      supportTickets12m,
      complaints12m,
      averageResolutionHours,
      networkOutages12m,
      satisfactionScore110,
      npsScore,
      competitorOfferReceived,
      churnStatus,
      churnDate,
      churnReason,
      lifetimeRevenueGbp,
      monthlyRevenueAtRiskGbp,
      churnFlag,
      ...additionalFeatures
    };
  });

  if (normalizedNationsCount > 0) {
    log.push({
      action: 'Standardized UK Nations',
      field: 'UK Nation',
      count: normalizedNationsCount,
      details: `Normalized constituent nation spelling and casing to UK standard.`
    });
  }

  if (imputedValuesCount > 0 && imputeMissing) {
    log.push({
      action: 'Imputed Missing Numeric Values',
      field: 'Multiple Numeric Columns',
      count: imputedValuesCount,
      details: `Replaced missing numeric fields with segment-specific medians (fallback to global median).`
    });
  }

  // 4. Compute 1st and 99th percentiles for Winsorization (used for model input features)
  const winsorLimits: Record<string, { p1: number; p99: number; cappedCount: number }> = {};
  if (winsorizeOutliers) {
    const continuousFields: (keyof BritConnectCustomer)[] = [
      'monthlyChargeGbp', 'averageMonthlyUsageGb', 'dataAllowanceGb', 'overageChargesGbp',
      'discountPercent', 'averageResolutionHours'
    ];

    continuousFields.forEach(f => {
      const vals = cleanedRows.map(r => Number(r[f]) || 0).sort((a, b) => a - b);
      if (vals.length > 20) {
        const p1Index = Math.floor(vals.length * 0.01);
        const p99Index = Math.floor(vals.length * 0.99);
        const p1 = vals[p1Index];
        const p99 = vals[p99Index];
        let capped = 0;
        cleanedRows.forEach(r => {
          const v = Number(r[f]) || 0;
          if (v < p1 || v > p99) capped++;
        });
        winsorLimits[f] = { p1, p99, cappedCount: capped };
      }
    });

    const totalCapped = Object.values(winsorLimits).reduce((acc, curr) => acc + curr.cappedCount, 0);
    if (totalCapped > 0) {
      log.push({
        action: 'Winsorized Numeric Outliers for ML',
        field: 'Usage, Charges, Resolution Hours',
        count: totalCapped,
        details: `Established 1st and 99th percentile bounds for model input training to prevent leverage points without modifying raw records.`
      });
    }
  }

  return {
    cleanedRows,
    cleaningLog: log,
    imputationStats,
    winsorLimits
  };
}
