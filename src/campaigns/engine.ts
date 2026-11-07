/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Retention Campaign Engine with Uplift & Statistical Significance
 */

export type CampaignChannel = 'Email' | 'SMS' | 'Outbound Call' | 'In-App Message' | 'Direct Mail Letter';
export type CampaignOfferType = 'Discount' | 'Plan Upgrade' | 'Contract Extension' | 'Loyalty Credit' | 'Proactive Service Fix' | 'Data Boost';

export interface CampaignAudienceMember {
  customerId: string;
  group: 'Treated' | 'Control';
  contacted: boolean;
  responded: boolean;
  accepted: boolean;
  retained: boolean;
  monthlyChargeGbp: number;
}

export interface CampaignRecord {
  id: string;
  name: string;
  objective: string;
  targetSegment: string;
  channel: CampaignChannel;
  offerType: CampaignOfferType;
  startDate: string;
  endDate: string;
  owner: string;
  budgetGbp: number;
  costPerContactGbp: number;
  offerCostPerAcceptedGbp: number;
  controlGroupRatio: number; // e.g. 0.15 (15%)
  audience: CampaignAudienceMember[];
  status: 'Draft' | 'Active' | 'Completed';
  createdAt: string;
}

export interface CampaignKpis {
  targetedCount: number;
  treatedCount: number;
  controlCount: number;
  contactedCount: number;
  reachRate: number; // contacted / treated
  acceptedCount: number;
  acceptanceRate: number; // accepted / contacted
  treatedRetentionRate: number;
  controlRetentionRate: number;
  incrementalUplift: number; // treatedRetention - controlRetention
  zScore: number;
  pValue: number;
  isSignificant: boolean; // p < 0.05
  isInconclusive: boolean;
  significanceSummary: string;
  customersSaved: number;
  revenueSavedGbp: number;
  totalCostGbp: number;
  netBenefitGbp: number;
  roiPercent: number;
  costPerSavedCustomerGbp: number;
  paybackPeriodMonths: number;
}

/**
 * Compute rigorous campaign KPIs and two-proportion Z-test
 */
export function computeCampaignKpis(campaign: CampaignRecord): CampaignKpis {
  const treated = campaign.audience.filter(a => a.group === 'Treated');
  const control = campaign.audience.filter(a => a.group === 'Control');

  const targetedCount = campaign.audience.length;
  const treatedCount = treated.length;
  const controlCount = control.length;

  const contacted = treated.filter(a => a.contacted);
  const contactedCount = contacted.length;
  const reachRate = treatedCount > 0 ? contactedCount / treatedCount : 0;

  const accepted = treated.filter(a => a.accepted);
  const acceptedCount = accepted.length;
  const acceptanceRate = contactedCount > 0 ? acceptedCount / contactedCount : 0;

  const treatedRetained = treated.filter(a => a.retained).length;
  const controlRetained = control.filter(a => a.retained).length;

  const treatedRetentionRate = treatedCount > 0 ? treatedRetained / treatedCount : 0;
  const controlRetentionRate = controlCount > 0 ? controlRetained / controlCount : 0;

  const incrementalUplift = treatedRetentionRate - controlRetentionRate;

  // Two-proportion Z-test:
  // p_pool = (x1 + x2) / (n1 + n2)
  // SE = sqrt( p_pool * (1 - p_pool) * (1/n1 + 1/n2) )
  // z = (p1 - p2) / SE
  let zScore = 0;
  let pValue = 1.0;
  let isSignificant = false;
  let isInconclusive = false;
  let significanceSummary = '';

  if (treatedCount < 25 || controlCount < 15) {
    isInconclusive = true;
    significanceSummary = 'Inconclusive: Sample size too small for statistical significance testing.';
  } else {
    const pooledP = (treatedRetained + controlRetained) / (treatedCount + controlCount);
    const se = Math.sqrt(pooledP * (1 - pooledP) * ((1 / treatedCount) + (1 / controlCount)));
    if (se > 0) {
      zScore = incrementalUplift / se;
      // Normal CDF approximation for 2-tailed p-value
      pValue = 2 * (1 - normalCdf(Math.abs(zScore)));
      isSignificant = pValue < 0.05 && incrementalUplift > 0;
      significanceSummary = isSignificant
        ? `Statistically Significant (p = ${pValue.toFixed(3)}, 95% Confidence): Real causal retention uplift of +${(incrementalUplift * 100).toFixed(1)} percentage points.`
        : `Statistically Inconclusive (p = ${pValue.toFixed(3)}): Observed difference could be due to random variation.`;
    }
  }

  // Business Impact
  const customersSaved = Math.max(0, Math.round(incrementalUplift * treatedCount));
  const avgMonthlyCharge = treated.length > 0
    ? treated.reduce((a, b) => a + b.monthlyChargeGbp, 0) / treated.length
    : 42.0;

  // Revenue saved assumes 12-month preserved customer tenure
  const revenueSavedGbp = Math.round(customersSaved * avgMonthlyCharge * 12);
  const totalCostGbp = Math.round(
    (contactedCount * campaign.costPerContactGbp) +
    (acceptedCount * campaign.offerCostPerAcceptedGbp)
  );

  const netBenefitGbp = revenueSavedGbp - totalCostGbp;
  const roiPercent = totalCostGbp > 0 ? Math.round((netBenefitGbp / totalCostGbp) * 100) : 0;
  const costPerSavedCustomerGbp = customersSaved > 0 ? Math.round(totalCostGbp / customersSaved) : totalCostGbp;
  const paybackPeriodMonths = avgMonthlyCharge > 0 && customersSaved > 0
    ? Math.round((totalCostGbp / (customersSaved * avgMonthlyCharge)) * 10) / 10
    : 0;

  return {
    targetedCount,
    treatedCount,
    controlCount,
    contactedCount,
    reachRate: Math.round(reachRate * 1000) / 1000,
    acceptedCount,
    acceptanceRate: Math.round(acceptanceRate * 1000) / 1000,
    treatedRetentionRate: Math.round(treatedRetentionRate * 1000) / 1000,
    controlRetentionRate: Math.round(controlRetentionRate * 1000) / 1000,
    incrementalUplift: Math.round(incrementalUplift * 1000) / 1000,
    zScore: Math.round(zScore * 100) / 100,
    pValue: Math.round(pValue * 1000) / 1000,
    isSignificant,
    isInconclusive,
    significanceSummary,
    customersSaved,
    revenueSavedGbp,
    totalCostGbp,
    netBenefitGbp,
    roiPercent,
    costPerSavedCustomerGbp,
    paybackPeriodMonths
  };
}

function normalCdf(x: number): number {
  // Approximation of standard normal CDF
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

/**
 * Generate synthetic seed campaigns so user sees historical performance immediately
 */
export function generateDefaultCampaigns(customerSample: Array<{ customerId: string; monthlyChargeGbp: number }>): CampaignRecord[] {
  const campaigns: CampaignRecord[] = [
    {
      id: 'camp-q3-m2m-save',
      name: 'Q3 Month-to-Month 12M Re-Contracting Blitz',
      objective: 'Convert vulnerable out-of-contract users to 12-month fixed contracts with 15% tariff discount.',
      targetSegment: 'Out of Contract & Unhappy',
      channel: 'Outbound Call',
      offerType: 'Contract Extension',
      startDate: '2026-07-01',
      endDate: '2026-08-15',
      owner: 'Sarah Jenkins (Direct Retention)',
      budgetGbp: 15000,
      costPerContactGbp: 6.5,
      offerCostPerAcceptedGbp: 25.0,
      controlGroupRatio: 0.15,
      status: 'Completed',
      createdAt: '2026-06-25T10:00:00Z',
      audience: []
    },
    {
      id: 'camp-q3-fibre-boost',
      name: 'Data Allowance Upgrade & Overage Relief',
      objective: 'Eliminate bill shock by moving heavy users from 250GB to 500GB cap with first 3 months free upgrade.',
      targetSegment: 'Allowance Overshoot & Overage Charges',
      channel: 'Email',
      offerType: 'Data Boost',
      startDate: '2026-08-10',
      endDate: '2026-09-30',
      owner: 'Liam Hughes (Commercial CVM)',
      budgetGbp: 8000,
      costPerContactGbp: 0.5,
      offerCostPerAcceptedGbp: 18.0,
      controlGroupRatio: 0.20,
      status: 'Completed',
      createdAt: '2026-08-01T09:00:00Z',
      audience: []
    },
    {
      id: 'camp-q4-vip-care',
      name: 'Executive Care Proactive Resolution',
      objective: 'Proactive VIP senior specialist callbacks for customers with 2+ tickets and slow resolution times.',
      targetSegment: 'High Complaints & Slow Resolution',
      channel: 'Outbound Call',
      offerType: 'Proactive Service Fix',
      startDate: '2026-10-01',
      endDate: '2026-11-15',
      owner: 'Gemma Patel (Customer Experience)',
      budgetGbp: 12000,
      costPerContactGbp: 9.0,
      offerCostPerAcceptedGbp: 30.0,
      controlGroupRatio: 0.15,
      status: 'Active',
      createdAt: '2026-09-20T11:00:00Z',
      audience: []
    }
  ];

  // Populate audience with realistic outcomes
  campaigns.forEach((camp, cIdx) => {
    const audienceSize = cIdx === 0 ? 320 : cIdx === 1 ? 480 : 250;
    const slice = customerSample.slice(0, audienceSize);

    camp.audience = slice.map((cust, i) => {
      const isControl = (i % 6 === 0); // ~16% control
      const contacted = isControl ? false : Math.random() < 0.88;
      const accepted = contacted && Math.random() < (cIdx === 0 ? 0.38 : cIdx === 1 ? 0.44 : 0.62);
      
      // Treated retention higher than control
      const baseRetention = cIdx === 0 ? 0.58 : cIdx === 1 ? 0.65 : 0.52;
      const upliftBoost = accepted ? (cIdx === 0 ? 0.24 : cIdx === 1 ? 0.18 : 0.28) : 0;
      const retentionProb = isControl ? baseRetention : (baseRetention + upliftBoost);
      const retained = Math.random() < retentionProb;

      return {
        customerId: cust.customerId || `BC-CUST-${i}`,
        group: isControl ? 'Control' : 'Treated',
        contacted,
        responded: contacted,
        accepted,
        retained,
        monthlyChargeGbp: cust.monthlyChargeGbp || 42
      };
    });
  });

  return campaigns;
}
