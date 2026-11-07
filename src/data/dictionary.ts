/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BritConnect Authoritative Data Dictionary (38 Columns)
 */

export type DataType = 'Text' | 'Whole Number' | 'Decimal Number' | 'Date';

export interface DictionaryField {
  number: number;
  name: string;
  normalizedKey: string;
  type: DataType;
  description: string;
  isTarget?: boolean;
  isLeakage?: boolean;
  requiredForScoring?: boolean;
  allowedValues?: string[];
  min?: number;
  max?: number;
}

export const DATA_DICTIONARY: DictionaryField[] = [
  { number: 1, name: 'Customer ID', normalizedKey: 'customerId', type: 'Text', description: 'Unique identifier assigned to each customer', requiredForScoring: true },
  { number: 2, name: 'Customer Segment', normalizedKey: 'customerSegment', type: 'Text', description: 'Customer classification (e.g. Consumer, Small Business)', allowedValues: ['Consumer', 'Small Business'] },
  { number: 3, name: 'Age', normalizedKey: 'age', type: 'Whole Number', description: 'Customer age in years', min: 16, max: 110 },
  { number: 4, name: 'Age Band', normalizedKey: 'ageBand', type: 'Text', description: 'Age grouping used for demographic analysis' },
  { number: 5, name: 'Gender', normalizedKey: 'gender', type: 'Text', description: 'Recorded customer gender' },
  { number: 6, name: 'UK Nation', normalizedKey: 'ukNation', type: 'Text', description: 'UK constituent nation (England, Scotland, Wales, Northern Ireland)', allowedValues: ['England', 'Scotland', 'Wales', 'Northern Ireland'] },
  { number: 7, name: 'City', normalizedKey: 'city', type: 'Text', description: 'Customer city' },
  { number: 8, name: 'Acquisition Channel', normalizedKey: 'acquisitionChannel', type: 'Text', description: 'Channel through which the customer was acquired' },
  { number: 9, name: 'Join Date', normalizedKey: 'joinDate', type: 'Date', description: 'Date the customer first joined BritConnect' },
  { number: 10, name: 'Tenure Months', normalizedKey: 'tenureMonths', type: 'Whole Number', description: 'Length of customer relationship, in months', min: 0 },
  { number: 11, name: 'Service Type', normalizedKey: 'serviceType', type: 'Text', description: 'Telecommunications service subscribed to' },
  { number: 12, name: 'Plan Name', normalizedKey: 'planName', type: 'Text', description: 'Name of the subscription package' },
  { number: 13, name: 'Contract Type', normalizedKey: 'contractType', type: 'Text', description: 'Contract arrangement or term (e.g. Month-to-Month, 12 Months, 24 Months)' },
  { number: 14, name: 'Contract Start Date', normalizedKey: 'contractStartDate', type: 'Date', description: 'Date the current contract began' },
  { number: 15, name: 'Contract End Date', normalizedKey: 'contractEndDate', type: 'Date', description: 'Scheduled contract expiry date, where applicable' },
  { number: 16, name: 'Auto Renew', normalizedKey: 'autoRenew', type: 'Text', description: 'Whether the contract renews automatically (Yes/No)' },
  { number: 17, name: 'Monthly Charge GBP', normalizedKey: 'monthlyChargeGbp', type: 'Decimal Number', description: 'Monthly subscription charge in GBP (£)', min: 0 },
  { number: 18, name: 'Average Monthly Usage GB', normalizedKey: 'averageMonthlyUsageGb', type: 'Decimal Number', description: 'Average monthly data usage in gigabytes', min: 0 },
  { number: 19, name: 'Data Allowance GB', normalizedKey: 'dataAllowanceGb', type: 'Whole Number', description: 'Included monthly data allowance in gigabytes', min: 0 },
  { number: 20, name: 'Overage Charges GBP', normalizedKey: 'overageChargesGbp', type: 'Decimal Number', description: 'Additional usage charges in GBP (£)', min: 0 },
  { number: 21, name: 'Discount Percent', normalizedKey: 'discountPercent', type: 'Decimal Number', description: 'Discount percentage applied to the subscription', min: 0, max: 100 },
  { number: 22, name: 'Payment Method', normalizedKey: 'paymentMethod', type: 'Text', description: 'Customer payment method (e.g. Direct Debit, Credit Card, Bank Transfer)' },
  { number: 23, name: 'Direct Debit', normalizedKey: 'directDebit', type: 'Text', description: 'Whether the customer pays by direct debit (Yes/No)' },
  { number: 24, name: 'Late Payments 12M', normalizedKey: 'latePayments12m', type: 'Whole Number', description: 'Number of late payments in preceding 12 months', min: 0 },
  { number: 25, name: 'Failed Payments 12M', normalizedKey: 'failedPayments12m', type: 'Whole Number', description: 'Number of failed payments in preceding 12 months', min: 0 },
  { number: 26, name: 'Support Tickets 12M', normalizedKey: 'supportTickets12m', type: 'Whole Number', description: 'Number of support tickets in preceding 12 months', min: 0 },
  { number: 27, name: 'Complaints 12M', normalizedKey: 'complaints12m', type: 'Whole Number', description: 'Number of complaints in preceding 12 months', min: 0 },
  { number: 28, name: 'Average Resolution Hours', normalizedKey: 'averageResolutionHours', type: 'Decimal Number', description: 'Average support issue resolution time in hours', min: 0 },
  { number: 29, name: 'Network Outages 12M', normalizedKey: 'networkOutages12m', type: 'Whole Number', description: 'Number of network outages in preceding 12 months', min: 0 },
  { number: 30, name: 'Satisfaction Score 1 10', normalizedKey: 'satisfactionScore110', type: 'Whole Number', description: 'Customer satisfaction score (1 to 10)', min: 1, max: 10 },
  { number: 31, name: 'NPS Score', normalizedKey: 'npsScore', type: 'Whole Number', description: 'Customer advocacy score; higher values indicate stronger advocacy' },
  { number: 32, name: 'Competitor Offer Received', normalizedKey: 'competitorOfferReceived', type: 'Text', description: 'Whether customer received an offer from a competitor (Yes/No)' },
  { number: 33, name: 'Churn Status', normalizedKey: 'churnStatus', type: 'Text', description: 'Recorded customer state: Active or Churned', isLeakage: true },
  { number: 34, name: 'Churn Date', normalizedKey: 'churnDate', type: 'Date', description: 'Cancellation/churn date; typically blank for active customers', isLeakage: true },
  { number: 35, name: 'Churn Reason', normalizedKey: 'churnReason', type: 'Text', description: 'Reason for cancellation; typically blank for active customers', isLeakage: true },
  { number: 36, name: 'Lifetime Revenue GBP', normalizedKey: 'lifetimeRevenueGbp', type: 'Decimal Number', description: 'Cumulative recorded revenue from the customer in GBP (£)', min: 0, isLeakage: true },
  { number: 37, name: 'Monthly Revenue At Risk GBP', normalizedKey: 'monthlyRevenueAtRiskGbp', type: 'Decimal Number', description: 'Estimated monthly revenue exposed to churn in GBP (£)', min: 0, isLeakage: true },
  { number: 38, name: 'Churn Flag', normalizedKey: 'churnFlag', type: 'Whole Number', description: 'Binary churn outcome: 1 = Churned, 0 = Active', isTarget: true, min: 0, max: 1 }
];

export interface BritConnectCustomer {
  customerId: string;
  customerSegment: string;
  age: number;
  ageBand: string;
  gender: string;
  ukNation: string;
  city: string;
  acquisitionChannel: string;
  joinDate: string; // ISO date YYYY-MM-DD
  tenureMonths: number;
  serviceType: string;
  planName: string;
  contractType: string;
  contractStartDate: string;
  contractEndDate?: string;
  autoRenew: string;
  monthlyChargeGbp: number;
  averageMonthlyUsageGb: number;
  dataAllowanceGb: number;
  overageChargesGbp: number;
  discountPercent: number;
  paymentMethod: string;
  directDebit: string;
  latePayments12m: number;
  failedPayments12m: number;
  supportTickets12m: number;
  complaints12m: number;
  averageResolutionHours: number;
  networkOutages12m: number;
  satisfactionScore110: number;
  npsScore: number;
  competitorOfferReceived: string;
  churnStatus: 'Active' | 'Churned';
  churnDate?: string;
  churnReason?: string;
  lifetimeRevenueGbp: number;
  monthlyRevenueAtRiskGbp: number;
  churnFlag: number; // 0 or 1
  [key: string]: any; // Allow unmapped additional features
}

export interface CustomerScore {
  customerId: string;
  churnProbability: number; // 0 to 1
  riskTier: 'Low' | 'Medium' | 'High' | 'Critical';
  riskRank: number;
  monthlyRevenueAtRisk: number;
  annualRevenueAtRisk: number;
  topDrivers: Array<{
    feature: string;
    label: string;
    contribution: number; // positive = pushes risk up, negative = down
    value: string | number;
    explanation: string;
    percentagePointsDelta?: number;
  }>;
  recommendedAction: string;
  priority: 'P1' | 'P2' | 'P3';
}
