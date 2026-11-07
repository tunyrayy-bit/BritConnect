/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * File Ingestion and Parsing Engine
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DATA_DICTIONARY, BritConnectCustomer } from '../data/dictionary';

export interface ParseResult {
  filename: string;
  fileSize: number;
  sheets?: string[];
  selectedSheet?: string;
  rawHeaders: string[];
  rawRows: Record<string, any>[];
  totalRows: number;
  errors: string[];
}

/**
 * Parse any supported file format into raw rows and headers.
 */
export async function parseFile(
  file: File,
  onProgress?: (percent: number, message: string) => void,
  targetSheetName?: string
): Promise<ParseResult> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  onProgress?.(10, 'Reading file content...');

  if (extension === 'csv' || extension === 'tsv' || extension === 'txt') {
    return parseDelimitedText(file, onProgress);
  } else if (['xlsx', 'xls', 'xlsm', 'ods'].includes(extension)) {
    return parseSpreadsheet(file, onProgress, targetSheetName);
  } else if (extension === 'json') {
    return parseJsonFile(file, onProgress);
  } else if (extension === 'jsonl' || extension === 'ndjson') {
    return parseJsonlFile(file, onProgress);
  } else {
    throw new Error(`Unsupported file type: .${extension}. Supported: .xlsx, .xls, .xlsm, .ods, .csv, .tsv, .txt, .json, .jsonl.`);
  }
}

async function parseDelimitedText(
  file: File,
  onProgress?: (percent: number, message: string) => void
): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const rows: Record<string, any>[] = [];
    let headers: string[] = [];

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: false, // Keep raw strings to allow UK date parsing and currency stripping in cleaning step
      chunk: (results, parser) => {
        if (!headers.length && results.meta.fields) {
          headers = results.meta.fields;
        }
        for (const row of results.data as Record<string, any>[]) {
          rows.push(row);
        }
        const pct = Math.min(90, Math.round((rows.length / 50000) * 100));
        onProgress?.(pct, `Parsed ${rows.length.toLocaleString()} rows...`);
      },
      complete: () => {
        onProgress?.(100, `Completed parsing ${rows.length.toLocaleString()} rows.`);
        resolve({
          filename: file.name,
          fileSize: file.size,
          rawHeaders: headers,
          rawRows: rows,
          totalRows: rows.length,
          errors: []
        });
      },
      error: (error) => {
        reject(new Error(`CSV parsing error: ${error.message}`));
      }
    });
  });
}

async function parseSpreadsheet(
  file: File,
  onProgress?: (percent: number, message: string) => void,
  targetSheetName?: string
): Promise<ParseResult> {
  onProgress?.(25, 'Loading Excel workbook...');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('Excel workbook has no sheets.');
  }

  // Pick target sheet or find the one that best matches dictionary headers
  let selectedSheet = targetSheetName;
  if (!selectedSheet || !sheetNames.includes(selectedSheet)) {
    // Score each sheet by dictionary column overlap
    let bestScore = -1;
    let bestSheet = sheetNames[0];
    for (const name of sheetNames) {
      const sheet = workbook.Sheets[name];
      const jsonHeader = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 })[0] as string[];
      if (Array.isArray(jsonHeader)) {
        const matches = jsonHeader.filter(h => 
          DATA_DICTIONARY.some(d => d.name.toLowerCase().replace(/[^a-z0-9]/g, '') === String(h).toLowerCase().replace(/[^a-z0-9]/g, ''))
        ).length;
        if (matches > bestScore) {
          bestScore = matches;
          bestSheet = name;
        }
      }
    }
    selectedSheet = bestSheet;
  }

  onProgress?.(60, `Reading sheet "${selectedSheet}"...`);
  const sheet = workbook.Sheets[selectedSheet];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    raw: false, // Convert cells to formatted text so Excel dates and numbers can be cleaned standardly
    defval: ''
  });

  const rawHeaders = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

  onProgress?.(100, `Successfully parsed ${rawRows.length.toLocaleString()} rows from Excel.`);
  return {
    filename: file.name,
    fileSize: file.size,
    sheets: sheetNames,
    selectedSheet,
    rawHeaders,
    rawRows,
    totalRows: rawRows.length,
    errors: []
  };
}

async function parseJsonFile(
  file: File,
  onProgress?: (percent: number, message: string) => void
): Promise<ParseResult> {
  onProgress?.(30, 'Reading JSON file...');
  const text = await file.text();
  const parsed = JSON.parse(text);

  let rows: Record<string, any>[] = [];
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    // Look for first array property (e.g. { customers: [...] } or { data: [...] })
    const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
    if (arrayKey) {
      rows = parsed[arrayKey];
    } else {
      rows = [parsed];
    }
  }

  const rawHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
  onProgress?.(100, `Parsed ${rows.length.toLocaleString()} JSON objects.`);

  return {
    filename: file.name,
    fileSize: file.size,
    rawHeaders,
    rawRows: rows,
    totalRows: rows.length,
    errors: []
  };
}

async function parseJsonlFile(
  file: File,
  onProgress?: (percent: number, message: string) => void
): Promise<ParseResult> {
  onProgress?.(30, 'Reading JSONL lines...');
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  const rows: Record<string, any>[] = [];

  for (let i = 0; i < lines.length; i++) {
    try {
      rows.push(JSON.parse(lines[i]));
    } catch {
      // Skip invalid JSON lines
    }
  }

  const rawHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
  onProgress?.(100, `Parsed ${rows.length.toLocaleString()} JSONL rows.`);

  return {
    filename: file.name,
    fileSize: file.size,
    rawHeaders,
    rawRows: rows,
    totalRows: rows.length,
    errors: []
  };
}

/**
 * Download canonical blank template as .csv or .xlsx
 */
export function downloadTemplate(format: 'csv' | 'xlsx' = 'xlsx') {
  const headers = DATA_DICTIONARY.map(d => d.name);
  const sampleRow: Record<string, any> = {
    'Customer ID': 'BC-10001',
    'Customer Segment': 'Consumer',
    'Age': 42,
    'Age Band': '35-44',
    'Gender': 'Female',
    'UK Nation': 'England',
    'City': 'Manchester',
    'Acquisition Channel': 'Website Organic',
    'Join Date': '15/01/2022',
    'Tenure Months': 34,
    'Service Type': 'Fibre Broadband',
    'Plan Name': 'Full Fibre 500',
    'Contract Type': '24 Months',
    'Contract Start Date': '15/01/2024',
    'Contract End Date': '14/01/2026',
    'Auto Renew': 'Yes',
    'Monthly Charge GBP': 39.99,
    'Average Monthly Usage GB': 420.5,
    'Data Allowance GB': 500,
    'Overage Charges GBP': 0.0,
    'Discount Percent': 10.0,
    'Payment Method': 'Direct Debit',
    'Direct Debit': 'Yes',
    'Late Payments 12M': 0,
    'Failed Payments 12M': 0,
    'Support Tickets 12M': 1,
    'Complaints 12M': 0,
    'Average Resolution Hours': 12.5,
    'Network Outages 12M': 0,
    'Satisfaction Score 1 10': 9,
    'NPS Score': 9,
    'Competitor Offer Received': 'No',
    'Churn Status': 'Active',
    'Churn Date': '',
    'Churn Reason': '',
    'Lifetime Revenue GBP': 1359.66,
    'Monthly Revenue At Risk GBP': 0.0,
    'Churn Flag': 0
  };

  if (format === 'csv') {
    const csv = Papa.unparse({
      fields: headers,
      data: [sampleRow]
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'BritConnect_Customer_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } else {
    const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, 'BritConnect_Customer_Template.xlsx');
  }
}

/**
 * Generate a realistic, rich synthetic UK telecom customer dataset
 * adhering strictly to the BritConnect 38-column schema and realistic
 * statistical correlations for churn modelling and demonstration.
 */
export function generateSampleDataset(count: number = 1200): Record<string, any>[] {
  const rows: Record<string, any>[] = [];

  const segments = ['Consumer', 'Consumer', 'Consumer', 'Small Business'];
  const genders = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
  const nationsWithCities = [
    { nation: 'England', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Newcastle', 'Sheffield', 'Liverpool'] },
    { nation: 'Scotland', cities: ['Edinburgh', 'Glasgow', 'Aberdeen', 'Dundee', 'Inverness'] },
    { nation: 'Wales', cities: ['Cardiff', 'Swansea', 'Newport', 'Wrexham'] },
    { nation: 'Northern Ireland', cities: ['Belfast', 'Derry', 'Lisburn', 'Newry'] }
  ];
  const channels = ['Website Organic', 'Price Comparison Site', 'In-Store Retail', 'Telesales', 'Referral / Word of Mouth', 'Social Media Campaign'];
  const plans = [
    { name: 'Essential Broadband 100', service: 'Standard Broadband', baseCharge: 27.99, allowance: 250 },
    { name: 'Superfast Fibre 300', service: 'Fibre Broadband', baseCharge: 34.99, allowance: 400 },
    { name: 'Full Fibre Ultrafast 900', service: 'Fibre Broadband', baseCharge: 48.99, allowance: 1000 },
    { name: '5G Complete Home & SIM', service: '5G Mobile & Broadband', baseCharge: 55.00, allowance: 800 },
    { name: 'Business Pro Connect', service: 'Business Unified Comms', baseCharge: 79.99, allowance: 1500 },
    { name: 'SIM Only Flex 30GB', service: 'SIM Only Mobile', baseCharge: 16.00, allowance: 30 }
  ];
  const contractTypes = ['Month-to-Month', '12 Months', '24 Months'];
  const churnReasons = [
    'Competitor Price Match / Cheaper Deal',
    'Repeated Network Outages',
    'Poor Customer Support Resolution',
    'Contract Expired / End of Promotional Price',
    'Relocating Outside Service Area',
    'Bill Shock from Overage Charges',
    'Downgraded to Basic Alternative'
  ];

  // Snapshot date for reference: 2026-11-01
  const snapshot = new Date(2026, 10, 1);

  for (let i = 1; i <= count; i++) {
    const id = `BC-${10000 + i}`;
    const segment = segments[Math.floor(Math.random() * segments.length)];
    const age = Math.floor(Math.random() * (78 - 18 + 1)) + 18;
    const ageBand = age < 25 ? '18-24' : age < 35 ? '25-34' : age < 50 ? '35-49' : age < 65 ? '50-64' : '65+';
    const gender = genders[Math.floor(Math.random() * genders.length)];
    
    // Weighted nation pick (England 70%, Scotland 14%, Wales 10%, NI 6%)
    const nationRoll = Math.random();
    const nationObj = nationRoll < 0.70 ? nationsWithCities[0] :
                     nationRoll < 0.84 ? nationsWithCities[1] :
                     nationRoll < 0.94 ? nationsWithCities[2] : nationsWithCities[3];
    const nation = nationObj.nation;
    const city = nationObj.cities[Math.floor(Math.random() * nationObj.cities.length)];
    const channel = channels[Math.floor(Math.random() * channels.length)];
    
    // Tenure
    const tenureMonths = Math.floor(Math.random() * 60) + 1;
    const joinDateObj = new Date(snapshot.getTime() - tenureMonths * 30.4375 * 24 * 60 * 60 * 1000);
    const joinDate = formatDateUK(joinDateObj);

    // Plan & Contract
    const plan = segment === 'Small Business' && Math.random() > 0.4 ? plans[4] : plans[Math.floor(Math.random() * plans.length)];
    const contractType = contractTypes[Math.floor(Math.random() * contractTypes.length)];
    
    // Contract Start & End
    const contractStartMonthsAgo = contractType === 'Month-to-Month' ? Math.min(1, tenureMonths) :
                                  contractType === '12 Months' ? Math.min(tenureMonths % 12 || 12, tenureMonths) :
                                  Math.min(tenureMonths % 24 || 24, tenureMonths);
    const contractStartDateObj = new Date(snapshot.getTime() - contractStartMonthsAgo * 30.4375 * 24 * 60 * 60 * 1000);
    const contractStartDate = formatDateUK(contractStartDateObj);
    
    const termMonths = contractType === 'Month-to-Month' ? 1 : contractType === '12 Months' ? 12 : 24;
    const contractEndDateObj = new Date(contractStartDateObj.getTime() + termMonths * 30.4375 * 24 * 60 * 60 * 1000);
    const contractEndDate = contractType === 'Month-to-Month' ? '' : formatDateUK(contractEndDateObj);
    const autoRenew = Math.random() > 0.3 ? 'Yes' : 'No';

    // Financials
    const discountPercent = Math.random() < 0.35 ? Math.round((Math.random() * 30 + 5) * 10) / 10 : 0;
    const monthlyChargeGbp = Math.round(plan.baseCharge * (segment === 'Small Business' ? 1.2 : 1.0) * 100) / 100;
    const allowanceGb = plan.allowance;
    
    // Usage with occasional overshoot
    const usageRatio = Math.random() < 0.15 ? (Math.random() * 0.7 + 1.05) : (Math.random() * 0.85 + 0.1);
    const averageMonthlyUsageGb = Math.round(allowanceGb * usageRatio * 10) / 10;
    const overageChargesGbp = averageMonthlyUsageGb > allowanceGb 
      ? Math.round((averageMonthlyUsageGb - allowanceGb) * 0.25 * 100) / 100 
      : 0;

    // Payment
    const directDebit = Math.random() > 0.18 ? 'Yes' : 'No';
    const paymentMethod = directDebit === 'Yes' ? 'Direct Debit' : (Math.random() > 0.5 ? 'Credit Card' : 'Bank Transfer');
    const latePayments12m = Math.random() < 0.8 ? 0 : Math.floor(Math.random() * 4) + 1;
    const failedPayments12m = latePayments12m > 0 && Math.random() < 0.4 ? Math.floor(Math.random() * 2) + 1 : 0;

    // Service experience
    const networkOutages12m = Math.random() < 0.65 ? 0 : Math.floor(Math.random() * 5) + 1;
    const supportTickets12m = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 7) + 1;
    const complaints12m = supportTickets12m > 2 && Math.random() < 0.45 ? Math.floor(Math.random() * 3) + 1 : 0;
    const averageResolutionHours = supportTickets12m > 0 
      ? Math.round((Math.random() * 36 + 4) * 10) / 10 
      : 0;

    // Satisfaction & NPS
    let satScore = 8;
    if (networkOutages12m > 2 || complaints12m > 1 || overageChargesGbp > 15) {
      satScore = Math.floor(Math.random() * 4) + 2; // 2 to 5
    } else if (networkOutages12m === 0 && complaints12m === 0 && supportTickets12m <= 1) {
      satScore = Math.floor(Math.random() * 3) + 8; // 8 to 10
    } else {
      satScore = Math.floor(Math.random() * 4) + 5; // 5 to 8
    }
    const npsScore = Math.max(0, Math.min(10, satScore + (Math.random() > 0.5 ? 0 : (Math.random() > 0.5 ? 1 : -1))));
    const competitorOffer = (satScore <= 5 || contractType === 'Month-to-Month') && Math.random() < 0.5 ? 'Yes' : (Math.random() < 0.15 ? 'Yes' : 'No');

    // Churn probability formulation (realistic synthetic mechanics)
    let churnProbability = 0.08;
    if (contractType === 'Month-to-Month') churnProbability += 0.22;
    if (satScore <= 4) churnProbability += 0.32;
    if (complaints12m >= 2) churnProbability += 0.25;
    if (networkOutages12m >= 3) churnProbability += 0.18;
    if (overageChargesGbp > 12) churnProbability += 0.15;
    if (competitorOffer === 'Yes') churnProbability += 0.18;
    if (failedPayments12m > 0) churnProbability += 0.14;
    if (tenureMonths <= 6) churnProbability += 0.10;
    if (discountPercent > 20 && tenureMonths > 10) churnProbability += 0.12; // promo ending soon
    if (satScore >= 9) churnProbability -= 0.15;
    if (contractType === '24 Months' && tenureMonths < 18) churnProbability -= 0.15;

    churnProbability = Math.max(0.02, Math.min(0.92, churnProbability));
    const isChurned = Math.random() < churnProbability;

    const churnFlag = isChurned ? 1 : 0;
    const churnStatus = isChurned ? 'Churned' : 'Active';
    
    let churnDate = '';
    let churnReason = '';
    if (isChurned) {
      const churnDaysAgo = Math.floor(Math.random() * 180) + 5;
      const churnDateObj = new Date(snapshot.getTime() - churnDaysAgo * 24 * 60 * 60 * 1000);
      churnDate = formatDateUK(churnDateObj);
      
      if (overageChargesGbp > 15) {
        churnReason = 'Bill Shock from Overage Charges';
      } else if (complaints12m > 0 || averageResolutionHours > 28) {
        churnReason = 'Poor Customer Support Resolution';
      } else if (networkOutages12m >= 2) {
        churnReason = 'Repeated Network Outages';
      } else if (competitorOffer === 'Yes') {
        churnReason = 'Competitor Price Match / Cheaper Deal';
      } else {
        churnReason = churnReasons[Math.floor(Math.random() * churnReasons.length)];
      }
    }

    const lifetimeRevenueGbp = Math.round(monthlyChargeGbp * tenureMonths * (1 - discountPercent / 200) * 100) / 100;
    const monthlyRevenueAtRiskGbp = isChurned ? 0 : Math.round(monthlyChargeGbp * churnProbability * 100) / 100;

    rows.push({
      'Customer ID': id,
      'Customer Segment': segment,
      'Age': age,
      'Age Band': ageBand,
      'Gender': gender,
      'UK Nation': nation,
      'City': city,
      'Acquisition Channel': channel,
      'Join Date': joinDate,
      'Tenure Months': tenureMonths,
      'Service Type': plan.service,
      'Plan Name': plan.name,
      'Contract Type': contractType,
      'Contract Start Date': contractStartDate,
      'Contract End Date': contractEndDate,
      'Auto Renew': autoRenew,
      'Monthly Charge GBP': monthlyChargeGbp,
      'Average Monthly Usage GB': averageMonthlyUsageGb,
      'Data Allowance GB': allowanceGb,
      'Overage Charges GBP': overageChargesGbp,
      'Discount Percent': discountPercent,
      'Payment Method': paymentMethod,
      'Direct Debit': directDebit,
      'Late Payments 12M': latePayments12m,
      'Failed Payments 12M': failedPayments12m,
      'Support Tickets 12M': supportTickets12m,
      'Complaints 12M': complaints12m,
      'Average Resolution Hours': averageResolutionHours,
      'Network Outages 12M': networkOutages12m,
      'Satisfaction Score 1 10': satScore,
      'NPS Score': npsScore,
      'Competitor Offer Received': competitorOffer,
      'Churn Status': churnStatus,
      'Churn Date': churnDate,
      'Churn Reason': churnReason,
      'Lifetime Revenue GBP': lifetimeRevenueGbp,
      'Monthly Revenue At Risk GBP': monthlyRevenueAtRiskGbp,
      'Churn Flag': churnFlag
    });
  }

  return rows;
}

function formatDateUK(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}
