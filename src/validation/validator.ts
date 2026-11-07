/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Data Quality Validation Engine
 */

import { DATA_DICTIONARY } from '../data/dictionary';

export type IssueSeverity = 'Error' | 'Warning' | 'Info';

export interface DataQualityIssue {
  id: string;
  rowNumber: number;
  customerId: string;
  column: string;
  value: any;
  issue: string;
  severity: IssueSeverity;
  suggestedFix: string;
}

export interface CategoricalSummary {
  column: string;
  uniqueCount: number;
  frequencies: Record<string, number>;
  nearDuplicates: Array<{ original: string; similarTo: string }>;
}

export interface ValidationReport {
  overallQualityScore: number; // 0 to 100
  totalRows: number;
  validRows: number;
  duplicateIdCount: number;
  totalIssuesCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: DataQualityIssue[];
  churnRate: number; // 0 to 1
  churnCount: number;
  activeCount: number;
  conflictingChurnTargetCount: number;
  isViableForTraining: boolean;
  viabilityReason?: string;
  categoricalSummaries: CategoricalSummary[];
  timestamp: string;
}

/**
 * Validate customer records according to canonical rules and produce comprehensive report
 */
export function validateDataset(
  rows: Record<string, any>[],
  today: Date = new Date(2026, 10, 1) // default snapshot
): ValidationReport {
  const issues: DataQualityIssue[] = [];
  const seenIds = new Map<string, number>();
  let duplicateIdCount = 0;
  let conflictingChurnTargetCount = 0;
  let churnCount = 0;
  let activeCount = 0;

  const categoricalValues: Record<string, Record<string, number>> = {
    customerSegment: {},
    gender: {},
    ukNation: {},
    serviceType: {},
    contractType: {},
    paymentMethod: {},
    directDebit: {},
    autoRenew: {},
    competitorOfferReceived: {},
    churnStatus: {},
    churnReason: {}
  };

  rows.forEach((row, index) => {
    const rowNum = index + 1;
    const cid = String(row.customerId || row['Customer ID'] || '').trim();

    // 1. Structural ID checks
    if (!cid) {
      issues.push({
        id: `empty-id-${rowNum}`,
        rowNumber: rowNum,
        customerId: '(Empty)',
        column: 'Customer ID',
        value: '',
        issue: 'Blank Customer ID',
        severity: 'Error',
        suggestedFix: 'Assign unique identifier or remove row'
      });
    } else {
      if (seenIds.has(cid)) {
        duplicateIdCount++;
        issues.push({
          id: `dup-id-${rowNum}`,
          rowNumber: rowNum,
          customerId: cid,
          column: 'Customer ID',
          value: cid,
          issue: `Duplicate Customer ID (first seen at row ${seenIds.get(cid)})`,
          severity: 'Warning',
          suggestedFix: 'Deduplicate; latest record will be kept during cleaning'
        });
      } else {
        seenIds.set(cid, rowNum);
      }
    }

    // 2. Churn target consistency
    const rawChurnFlag = row.churnFlag ?? row['Churn Flag'];
    const rawChurnStatus = row.churnStatus ?? row['Churn Status'];

    let isChurned = false;
    if (rawChurnFlag !== undefined && rawChurnFlag !== null && rawChurnFlag !== '') {
      const numFlag = Number(rawChurnFlag);
      if (numFlag === 1) isChurned = true;
      if (numFlag !== 0 && numFlag !== 1) {
        issues.push({
          id: `target-invalid-${rowNum}`,
          rowNumber: rowNum,
          customerId: cid,
          column: 'Churn Flag',
          value: rawChurnFlag,
          issue: 'Churn Flag must be binary 0 or 1',
          severity: 'Error',
          suggestedFix: 'Coerce to 1 if churned, 0 if active'
        });
      }
    } else if (rawChurnStatus) {
      const statusStr = String(rawChurnStatus).trim().toLowerCase();
      if (statusStr === 'churned') isChurned = true;
    }

    // Conflicting target check
    if (rawChurnFlag !== undefined && rawChurnStatus) {
      const flagNum = Number(rawChurnFlag);
      const statusIsChurned = String(rawChurnStatus).trim().toLowerCase() === 'churned';
      if ((flagNum === 1 && !statusIsChurned) || (flagNum === 0 && statusIsChurned)) {
        conflictingChurnTargetCount++;
        issues.push({
          id: `target-conflict-${rowNum}`,
          rowNumber: rowNum,
          customerId: cid,
          column: 'Churn Status / Churn Flag',
          value: `Status=${rawChurnStatus}, Flag=${rawChurnFlag}`,
          issue: 'Churn Status and Churn Flag conflict',
          severity: 'Warning',
          suggestedFix: 'Defaulting to Churn Status recorded state'
        });
      }
    }

    if (isChurned) churnCount++;
    else activeCount++;

    // 3. Numeric ranges
    const age = Number(row.age ?? row['Age']);
    if (!isNaN(age)) {
      if (age < 16 || age > 110) {
        issues.push({
          id: `age-range-${rowNum}`,
          rowNumber: rowNum,
          customerId: cid,
          column: 'Age',
          value: age,
          issue: `Age out of standard range 16–110 (${age})`,
          severity: 'Warning',
          suggestedFix: 'Cap or verify demographic record'
        });
      }
    }

    const sat = Number(row.satisfactionScore110 ?? row['Satisfaction Score 1 10']);
    if (!isNaN(sat) && (sat < 1 || sat > 10)) {
      issues.push({
        id: `sat-range-${rowNum}`,
        rowNumber: rowNum,
        customerId: cid,
        column: 'Satisfaction Score 1 10',
        value: sat,
        issue: `Satisfaction score must be between 1 and 10 (${sat})`,
        severity: 'Error',
        suggestedFix: 'Clamp to 1–10 scale'
      });
    }

    const discount = Number(row.discountPercent ?? row['Discount Percent']);
    if (!isNaN(discount) && (discount < 0 || discount > 100)) {
      issues.push({
        id: `discount-range-${rowNum}`,
        rowNumber: rowNum,
        customerId: cid,
        column: 'Discount Percent',
        value: discount,
        issue: `Discount percent out of range 0–100% (${discount}%)`,
        severity: 'Error',
        suggestedFix: 'Clamp to 0–100'
      });
    }

    const monthlyCharge = Number(row.monthlyChargeGbp ?? row['Monthly Charge GBP']);
    if (!isNaN(monthlyCharge) && monthlyCharge < 0) {
      issues.push({
        id: `charge-negative-${rowNum}`,
        rowNumber: rowNum,
        customerId: cid,
        column: 'Monthly Charge GBP',
        value: monthlyCharge,
        issue: 'Monthly Charge cannot be negative',
        severity: 'Error',
        suggestedFix: 'Take absolute value or verify billing ledger'
      });
    }

    // 4. Logical consistency rules
    const joinDateStr = row.joinDate ?? row['Join Date'];
    const contractStartStr = row.contractStartDate ?? row['Contract Start Date'];
    const contractEndStr = row.contractEndDate ?? row['Contract End Date'];
    const churnDateStr = row.churnDate ?? row['Churn Date'];

    const joinDate = parseDateString(joinDateStr);
    const contractStartDate = parseDateString(contractStartStr);
    const contractEndDate = parseDateString(contractEndStr);
    const churnDate = parseDateString(churnDateStr);

    if (joinDate && joinDate.getTime() > today.getTime()) {
      issues.push({
        id: `join-future-${rowNum}`,
        rowNumber: rowNum,
        customerId: cid,
        column: 'Join Date',
        value: joinDateStr,
        issue: 'Join Date is in the future',
        severity: 'Error',
        suggestedFix: 'Correct customer start date'
      });
    }

    if (contractStartDate && contractEndDate && contractEndDate.getTime() < contractStartDate.getTime()) {
      issues.push({
        id: `contract-order-${rowNum}`,
        rowNumber: rowNum,
        customerId: cid,
        column: 'Contract End Date',
        value: `${contractStartStr} -> ${contractEndStr}`,
        issue: 'Contract End Date occurs before Contract Start Date',
        severity: 'Error',
        suggestedFix: 'Check contract schedule'
      });
    }

    if (joinDate && contractStartDate && joinDate.getTime() > contractStartDate.getTime() + 86400000) {
      issues.push({
        id: `contract-before-join-${rowNum}`,
        rowNumber: rowNum,
        customerId: cid,
        column: 'Contract Start Date',
        value: `${joinDateStr} vs ${contractStartStr}`,
        issue: 'Contract Start Date precedes customer Join Date',
        severity: 'Warning',
        suggestedFix: 'Join date should reflect original relationship inception'
      });
    }

    if (!isChurned && churnDateStr) {
      issues.push({
        id: `churn-date-active-${rowNum}`,
        rowNumber: rowNum,
        customerId: cid,
        column: 'Churn Date',
        value: churnDateStr,
        issue: 'Active customer has a Churn Date recorded',
        severity: 'Warning',
        suggestedFix: 'Clear churn date or reclassify customer status'
      });
    }

    const churnReason = row.churnReason ?? row['Churn Reason'];
    if (!isChurned && churnReason && String(churnReason).trim().length > 0) {
      issues.push({
        id: `churn-reason-active-${rowNum}`,
        rowNumber: rowNum,
        customerId: cid,
        column: 'Churn Reason',
        value: churnReason,
        issue: 'Active customer has a Churn Reason recorded',
        severity: 'Warning',
        suggestedFix: 'Clear reason or verify if customer has cancelled'
      });
    }

    // Direct Debit vs Payment Method consistency
    const directDebit = String((row.directDebit ?? row['Direct Debit']) || '').trim().toLowerCase();
    const paymentMethod = String((row.paymentMethod ?? row['Payment Method']) || '').trim().toLowerCase();
    if ((directDebit === 'yes' && paymentMethod.includes('card')) || (directDebit === 'no' && paymentMethod.includes('direct debit'))) {
      issues.push({
        id: `dd-method-mismatch-${rowNum}`,
        rowNumber: rowNum,
        customerId: cid,
        column: 'Direct Debit',
        value: `DD=${row.directDebit}, Method=${row.paymentMethod}`,
        issue: 'Direct Debit indicator conflicts with Payment Method description',
        severity: 'Warning',
        suggestedFix: 'Align Direct Debit flag with Payment Method'
      });
    }

    // Accumulate categoricals for distribution and near-duplicate analysis
    for (const key of Object.keys(categoricalValues)) {
      const val = row[key] ?? row[DATA_DICTIONARY.find(d => d.normalizedKey === key)?.name || ''];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const strVal = String(val).trim();
        categoricalValues[key][strVal] = (categoricalValues[key][strVal] || 0) + 1;
      }
    }
  });

  // Categorical summary and near-duplicate detection
  const categoricalSummaries: CategoricalSummary[] = [];
  for (const [colKey, freqs] of Object.entries(categoricalValues)) {
    const fieldDef = DATA_DICTIONARY.find(d => d.normalizedKey === colKey);
    const colName = fieldDef ? fieldDef.name : colKey;
    const values = Object.keys(freqs);
    const nearDuplicates: Array<{ original: string; similarTo: string }> = [];

    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const v1 = values[i].toLowerCase().replace(/[^a-z0-9]/g, '');
        const v2 = values[j].toLowerCase().replace(/[^a-z0-9]/g, '');
        if (v1 === v2 || (v1.length > 3 && (v1.startsWith(v2) || v2.startsWith(v1)))) {
          nearDuplicates.push({ original: values[i], similarTo: values[j] });
        }
      }
    }

    categoricalSummaries.push({
      column: colName,
      uniqueCount: values.length,
      frequencies: freqs,
      nearDuplicates
    });
  }

  // Viability Assessment
  const totalRows = rows.length;
  const churnRate = totalRows > 0 ? churnCount / totalRows : 0;
  let isViableForTraining = true;
  let viabilityReason = '';

  if (totalRows < 100) {
    isViableForTraining = false;
    viabilityReason = `Dataset has only ${totalRows} rows (minimum 100 required for statistical learning).`;
  } else if (churnCount < 10 || activeCount < 10) {
    isViableForTraining = false;
    viabilityReason = `Insufficient class balance: ${churnCount} churned, ${activeCount} active (minimum 10 of each class required).`;
  } else if (totalRows < 500 || churnCount < 50) {
    viabilityReason = `Warning: ${totalRows} rows and ${churnCount} churned customers. Results may have higher variance.`;
  }

  const errorCount = issues.filter(i => i.severity === 'Error').length;
  const warningCount = issues.filter(i => i.severity === 'Warning').length;
  const infoCount = issues.filter(i => i.severity === 'Info').length;

  // Compute 0-100 Quality Score
  // Base 100 - (errors * 3 + warnings * 0.5 + duplicateIdCount * 2) capped at 0
  const penalty = Math.min(100, (errorCount * 2.5) + (warningCount * 0.4) + (duplicateIdCount * 1.5));
  const overallQualityScore = Math.max(0, Math.round(100 - penalty));

  return {
    overallQualityScore,
    totalRows,
    validRows: totalRows - errorCount,
    duplicateIdCount,
    totalIssuesCount: issues.length,
    errorCount,
    warningCount,
    infoCount,
    issues,
    churnRate,
    churnCount,
    activeCount,
    conflictingChurnTargetCount,
    isViableForTraining,
    viabilityReason,
    categoricalSummaries,
    timestamp: new Date().toISOString()
  };
}

/**
 * Robust date parser supporting UK dd/mm/yyyy, ISO yyyy-mm-dd, and Excel serial numbers
 */
export function parseDateString(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;

  // Excel serial number
  if (typeof dateVal === 'number' || (!isNaN(Number(dateVal)) && !String(dateVal).includes('/') && !String(dateVal).includes('-'))) {
    const num = Number(dateVal);
    if (num > 25000 && num < 65000) {
      // Excel epoch starts ~1900
      const utcDays = num - 25569;
      return new Date(utcDays * 86400 * 1000);
    }
  }

  const str = String(dateVal).trim();
  if (!str) return null;

  // UK dd/mm/yyyy format
  const ukMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (ukMatch) {
    const day = parseInt(ukMatch[1], 10);
    const month = parseInt(ukMatch[2], 10) - 1;
    const year = parseInt(ukMatch[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO yyyy-mm-dd
  const isoMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}
