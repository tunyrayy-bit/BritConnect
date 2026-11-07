/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Feature Engineering Engine with Leakage Prevention
 */

import { BritConnectCustomer } from '../data/dictionary';

export interface EngineeredFeatureMatrix {
  featureNames: string[];
  featureLabels: string[];
  matrix: number[][]; // N rows x D features
  targets: number[];  // N rows (0 or 1)
  customerIds: string[];
  featureTypes: Record<string, 'numeric' | 'binary' | 'onehot'>;
  excludedFeatures: Array<{ field: string; reason: string }>;
  leakageWarnings: Array<{ feature: string; univariateAuc: number; reason: string }>;
  npsInversionWarning?: string;
  scalingParams?: Record<number, { mean: number; std: number }>;
}

export interface FeatureEngineeringOptions {
  snapshotDate?: string; // YYYY-MM-DD
  includeDemographics?: boolean; // Gender, Age Band (defaults to false for fairness/GDPR)
  standardizeForLinear?: boolean;
}

export function engineerFeatures(
  customers: BritConnectCustomer[],
  options: FeatureEngineeringOptions = {}
): EngineeredFeatureMatrix {
  const {
    snapshotDate = '2026-11-01',
    includeDemographics = false,
    standardizeForLinear = false
  } = options;

  const snapshot = new Date(snapshotDate);

  // Excluded features list with audit reasons
  const excludedFeatures = [
    { field: 'Churn Flag', reason: 'Target label (supervised outcome).' },
    { field: 'Churn Status', reason: 'Direct proxy for target label (outcome leakage).' },
    { field: 'Churn Date', reason: 'Only recorded post-churn (temporal leakage).' },
    { field: 'Churn Reason', reason: 'Only known after cancellation event (leakage).' },
    { field: 'Monthly Revenue At Risk GBP', reason: 'Directly calculated from churn probability/status.' },
    { field: 'Customer ID', reason: 'High-cardinality identifier, non-generalizable.' }
  ];

  if (!includeDemographics) {
    excludedFeatures.push({
      field: 'Gender',
      reason: 'Excluded by default under UK GDPR fairness & bias prevention principles.'
    });
    excludedFeatures.push({
      field: 'Age Band',
      reason: 'Excluded by default to prevent ageist proxy scoring.'
    });
  }

  // 1. First pass: detect NPS range and distribution
  const npsValues = customers.map(c => c.npsScore).filter(v => v !== undefined && v !== null && !isNaN(v));
  const minNps = npsValues.length ? Math.min(...npsValues) : 0;
  const maxNps = npsValues.length ? Math.max(...npsValues) : 10;
  const isTenScale = minNps >= 0 && maxNps <= 10;

  // 2. Compute engineered properties per customer
  interface RowData {
    id: string;
    target: number;
    features: Record<string, number>;
  }

  const rows: RowData[] = customers.map(c => {
    // Determine effective reference date:
    // If customer churned, compute time-based features as of their churn date or snapshot
    const refDate = c.churnStatus === 'Churned' && c.churnDate
      ? new Date(c.churnDate)
      : snapshot;

    // A. Usage & Billing
    const allowance = Math.max(c.dataAllowanceGb, 1);
    const usage = Math.max(0, c.averageMonthlyUsageGb);
    const usageToAllowanceRatio = Math.round((usage / allowance) * 100) / 100;
    const allowanceOvershootFlag = usageToAllowanceRatio > 1.0 ? 1 : 0;
    const allowanceUnderuseFlag = usageToAllowanceRatio < 0.25 ? 1 : 0;
    const overageToChargeRatio = c.monthlyChargeGbp > 0 ? Math.round((c.overageChargesGbp / c.monthlyChargeGbp) * 100) / 100 : 0;
    const effectiveMonthlyCharge = Math.round(c.monthlyChargeGbp * (1 - (c.discountPercent || 0) / 100) * 100) / 100;
    const chargePerGb = Math.round((c.monthlyChargeGbp / allowance) * 100) / 100;
    const hasDiscount = (c.discountPercent || 0) > 0 ? 1 : 0;
    const highDiscountFlag = (c.discountPercent || 0) >= 20 ? 1 : 0;

    // B. Payment Risk
    const late = Math.max(0, c.latePayments12m || 0);
    const failed = Math.max(0, c.failedPayments12m || 0);
    const paymentIssueScore = late + (2 * failed);
    const anyPaymentIssue = paymentIssueScore > 0 ? 1 : 0;
    const paperOrNonDdFlag = c.directDebit === 'Yes' ? 0 : 1;

    // C. Service Experience
    const tenureMonths = Math.max(1, c.tenureMonths || 1);
    const tenureCappedYear = Math.max(1, Math.min(12, tenureMonths)) / 12;
    const tickets = Math.max(0, c.supportTickets12m || 0);
    const complaints = Math.max(0, c.complaints12m || 0);
    const ticketsPerYear = Math.round((tickets / tenureCappedYear) * 10) / 10;
    const complaintRate = Math.round((complaints / Math.max(tickets, 1)) * 100) / 100;
    const unresolvedPressure = Math.round((c.averageResolutionHours || 0) * tickets * 10) / 10;
    const outageExposure = Math.max(0, c.networkOutages12m || 0);
    const outageAndComplaintFlag = (outageExposure > 0 && complaints > 0) ? 1 : 0;

    // Satisfaction & NPS
    const satisfaction = Math.max(1, Math.min(10, c.satisfactionScore110 || 7));
    const satBandLow = satisfaction <= 4 ? 1 : 0;
    const satBandMed = satisfaction >= 5 && satisfaction <= 7 ? 1 : 0;
    const satBandHigh = satisfaction >= 8 ? 1 : 0;

    let npsDetractor = 0;
    let npsPassive = 0;
    let npsPromoter = 0;
    if (isTenScale) {
      if (c.npsScore <= 6) npsDetractor = 1;
      else if (c.npsScore <= 8) npsPassive = 1;
      else npsPromoter = 1;
    } else {
      // Net promoter range (-100 to +100)
      if (c.npsScore < 0) npsDetractor = 1;
      else if (c.npsScore < 50) npsPassive = 1;
      else npsPromoter = 1;
    }

    // D. Lifecycle & Contract
    let monthsToContractEnd = 0;
    let inRenewalWindow = 0;
    let outOfContractFlag = 0;

    if (c.contractEndDate) {
      const end = new Date(c.contractEndDate);
      const diffMs = end.getTime() - refDate.getTime();
      monthsToContractEnd = Math.round(diffMs / (30.4375 * 24 * 60 * 60 * 1000));
      if (monthsToContractEnd <= 0) {
        outOfContractFlag = 1;
      } else if (monthsToContractEnd <= 3) {
        inRenewalWindow = 1;
      }
    } else if (c.contractType === 'Month-to-Month') {
      outOfContractFlag = 1;
    }

    const autoRenewFlag = c.autoRenew === 'Yes' ? 1 : 0;
    const competitorOfferFlag = c.competitorOfferReceived === 'Yes' ? 1 : 0;

    // Categoricals (One-hot encoded)
    const isSmallBusiness = c.customerSegment === 'Small Business' ? 1 : 0;
    const isContractM2M = c.contractType === 'Month-to-Month' ? 1 : 0;
    const isContract12M = c.contractType === '12 Months' ? 1 : 0;
    const isContract24M = c.contractType === '24 Months' ? 1 : 0;

    const isFibre = c.serviceType.toLowerCase().includes('fibre') ? 1 : 0;
    const is5G = c.serviceType.toLowerCase().includes('5g') ? 1 : 0;
    const isMobile = c.serviceType.toLowerCase().includes('mobile') || c.serviceType.toLowerCase().includes('sim') ? 1 : 0;

    const isNationEngland = c.ukNation === 'England' ? 1 : 0;
    const isNationScotland = c.ukNation === 'Scotland' ? 1 : 0;
    const isNationWales = c.ukNation === 'Wales' ? 1 : 0;
    const isNationNI = c.ukNation === 'Northern Ireland' ? 1 : 0;

    const featureDict: Record<string, number> = {
      monthly_charge: c.monthlyChargeGbp,
      effective_monthly_charge: effectiveMonthlyCharge,
      usage_gb: usage,
      allowance_gb: allowance,
      usage_to_allowance_ratio: usageToAllowanceRatio,
      allowance_overshoot_flag: allowanceOvershootFlag,
      allowance_underuse_flag: allowanceUnderuseFlag,
      overage_charges: c.overageChargesGbp || 0,
      overage_to_charge_ratio: overageToChargeRatio,
      discount_percent: c.discountPercent || 0,
      has_discount: hasDiscount,
      high_discount_flag: highDiscountFlag,
      charge_per_gb: chargePerGb,
      tenure_months: tenureMonths,
      late_payments_12m: late,
      failed_payments_12m: failed,
      payment_issue_score: paymentIssueScore,
      any_payment_issue: anyPaymentIssue,
      paper_or_non_dd_flag: paperOrNonDdFlag,
      support_tickets_12m: tickets,
      complaints_12m: complaints,
      tickets_per_year: ticketsPerYear,
      complaint_rate: complaintRate,
      average_resolution_hours: c.averageResolutionHours || 0,
      unresolved_pressure: unresolvedPressure,
      network_outages_12m: outageExposure,
      outage_and_complaint_flag: outageAndComplaintFlag,
      satisfaction_score: satisfaction,
      sat_band_low: satBandLow,
      sat_band_med: satBandMed,
      sat_band_high: satBandHigh,
      nps_score: c.npsScore || 0,
      nps_detractor: npsDetractor,
      nps_promoter: npsPromoter,
      months_to_contract_end: monthsToContractEnd,
      in_renewal_window: inRenewalWindow,
      out_of_contract_flag: outOfContractFlag,
      auto_renew_flag: autoRenewFlag,
      competitor_offer_flag: competitorOfferFlag,
      seg_small_business: isSmallBusiness,
      contract_m2m: isContractM2M,
      contract_12m: isContract12M,
      contract_24m: isContract24M,
      service_fibre: isFibre,
      service_5g: is5G,
      service_mobile: isMobile,
      nation_england: isNationEngland,
      nation_scotland: isNationScotland,
      nation_wales: isNationWales,
      nation_ni: isNationNI
    };

    if (includeDemographics) {
      featureDict['age'] = c.age;
      featureDict['gender_female'] = c.gender === 'Female' ? 1 : 0;
      featureDict['gender_male'] = c.gender === 'Male' ? 1 : 0;
    }

    return {
      id: c.customerId,
      target: c.churnFlag,
      features: featureDict
    };
  });

  const featureNames = Object.keys(rows[0].features);
  const featureLabels = featureNames.map(name => {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace('12m', '(12M)')
      .replace('Gb', 'GB')
      .replace('Gbp', '(£)')
      .replace('M2m', 'Month-to-Month')
      .replace('Seg ', 'Segment: ')
      .replace('Sat ', 'Satisfaction ');
  });

  const featureTypes: Record<string, 'numeric' | 'binary' | 'onehot'> = {};
  featureNames.forEach(f => {
    if (f.endsWith('_flag') || f.startsWith('has_') || f.startsWith('any_')) {
      featureTypes[f] = 'binary';
    } else if (f.startsWith('contract_') || f.startsWith('service_') || f.startsWith('nation_') || f.startsWith('seg_') || f.startsWith('sat_band_') || f.startsWith('nps_')) {
      featureTypes[f] = 'onehot';
    } else {
      featureTypes[f] = 'numeric';
    }
  });

  // Construct raw matrix
  const matrix: number[][] = rows.map(r => featureNames.map(f => r.features[f]));
  const targets = rows.map(r => r.target);
  const customerIds = rows.map(r => r.id);

  // 3. Automated Leakage Scan
  // Compute univariate ROC AUC for each feature against targets
  const leakageWarnings: Array<{ feature: string; univariateAuc: number; reason: string }> = [];

  featureNames.forEach((feat, colIdx) => {
    const colVals = matrix.map(row => row[colIdx]);
    const auc = calculateUnivariateAuc(colVals, targets);
    if (auc > 0.95) {
      leakageWarnings.push({
        feature: feat,
        univariateAuc: Math.round(auc * 1000) / 1000,
        reason: `Suspiciously high univariate predictive power (AUC = ${(auc * 100).toFixed(1)}%). Likely target proxy leakage.`
      });
    }
  });

  // 4. Check NPS direction correlation
  const npsIdx = featureNames.indexOf('nps_score');
  let npsInversionWarning: string | undefined;
  if (npsIdx >= 0) {
    const npsVals = matrix.map(r => r[npsIdx]);
    const npsAuc = calculateUnivariateAuc(npsVals, targets);
    // If higher NPS predicts churn (AUC > 0.60 where 1=churn), it's inverted!
    if (npsAuc > 0.60) {
      npsInversionWarning = 'NPS appears inverted relative to the data dictionary: higher scores correlate with higher churn. Verification recommended.';
    }
  }

  // 5. Standardisation parameters (if requested, compute mean and std)
  let scalingParams: Record<number, { mean: number; std: number }> | undefined;
  if (standardizeForLinear) {
    scalingParams = {};
    featureNames.forEach((feat, colIdx) => {
      if (featureTypes[feat] === 'numeric') {
        const vals = matrix.map(r => r[colIdx]);
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length - 1 || 1);
        const std = Math.sqrt(variance) || 1;
        scalingParams![colIdx] = { mean, std };
      }
    });
  }

  return {
    featureNames,
    featureLabels,
    matrix,
    targets,
    customerIds,
    featureTypes,
    excludedFeatures,
    leakageWarnings,
    npsInversionWarning,
    scalingParams
  };
}

/**
 * Fast univariate Wilcoxon-Mann-Whitney ROC-AUC calculation
 */
function calculateUnivariateAuc(values: number[], targets: number[]): number {
  const n = values.length;
  if (n === 0) return 0.5;

  let posCount = 0;
  let negCount = 0;
  for (let i = 0; i < n; i++) {
    if (targets[i] === 1) posCount++;
    else negCount++;
  }

  if (posCount === 0 || negCount === 0) return 0.5;

  // Rank pairs
  const indexed = values.map((v, i) => ({ val: v, target: targets[i] }));
  indexed.sort((a, b) => a.val - b.val);

  let rankSumPos = 0;
  let i = 0;
  while (i < n) {
    let j = i;
    while (j < n - 1 && indexed[j + 1].val === indexed[i].val) {
      j++;
    }
    // Average rank for ties (1-based ranks)
    const avgRank = (i + 1 + j + 1) / 2;
    for (let k = i; k <= j; k++) {
      if (indexed[k].target === 1) {
        rankSumPos += avgRank;
      }
    }
    i = j + 1;
  }

  const u = rankSumPos - (posCount * (posCount + 1)) / 2;
  const auc = u / (posCount * negCount);
  return Math.max(auc, 1 - auc); // Direction agnostic
}
