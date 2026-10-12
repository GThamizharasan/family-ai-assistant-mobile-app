import { GcpBillingConfig } from '../types';

export const INITIAL_GCP_BILLING_CONFIG: GcpBillingConfig = {
  projectId: 'gen-lang-client-0121247108',
  projectNumber: '600050762948',
  billingAccountId: '01A84F-992BE1-773C90',
  billingAccountName: 'Thamizharasan Sovereign Cloud (gen-lang-client-0121247108)',
  currency: 'USD',
  monthlyBudgetLimit: 300.0,
  currentMtdSpend: 142.8,
  projectedSpend: 218.4,
  lastUpdated: 'Today at 03:25 AM UTC (Real-Time Billing Export)',
  paymentMethod: {
    type: 'Visa Corporate Credit',
    last4: '4242',
    expiry: '09/29',
    status: 'Verified & Active',
  },
  alertThresholds: {
    at50Percent: true,
    at80Percent: true,
    at90Percent: true,
    at100Percent: true,
    notifyEmail: true,
    notifyWhatsApp: true,
    notifyPush: true,
  },
  controlGuardrails: {
    autoScaleDownOnCap: true,
    throttleAiModelsAt90: true,
    pauseIdleDevEnvironments: true,
    maxCloudRunInstances: 5,
    apiRateLimitPerMinute: 120,
    hardSpendCapEnforced: false,
  },
  services: [
    {
      serviceId: 'srv-cloud-run',
      name: 'Cloud Run & Microservices',
      category: 'compute',
      currentSpend: 58.4,
      projectedSpend: 89.2,
      percentage: 40.9,
      usageMetric: '2.4M vCPU-seconds • 4.8M GB-seconds',
      changePercent: -4.2,
      color: '#3B82F6', // Blue
    },
    {
      serviceId: 'srv-vertex-gemini',
      name: 'Vertex AI & Gemini 3.8 Flash SDK',
      category: 'ai',
      currentSpend: 42.2,
      projectedSpend: 64.8,
      percentage: 29.5,
      usageMetric: '14.2M Input Tokens • 1.8M Output Tokens',
      changePercent: +8.5,
      color: '#8B5CF6', // Purple
    },
    {
      serviceId: 'srv-cloud-sql',
      name: 'Cloud SQL PostgreSQL & Firestore',
      category: 'database',
      currentSpend: 24.8,
      projectedSpend: 38.0,
      percentage: 17.4,
      usageMetric: '288 Instance Hours (db-f1-micro) • 120k I/O',
      changePercent: +0.0,
      color: '#10B981', // Emerald
    },
    {
      serviceId: 'srv-cloud-storage',
      name: 'Cloud Storage & Sovereign Buckets',
      category: 'storage',
      currentSpend: 11.6,
      projectedSpend: 17.8,
      percentage: 8.1,
      usageMetric: '142.8 GB Standard • 12k Class A ops',
      changePercent: -1.5,
      color: '#F59E0B', // Amber
    },
    {
      serviceId: 'srv-networking',
      name: 'Cloud CDN, Egress & Cloud DNS',
      category: 'network',
      currentSpend: 5.8,
      projectedSpend: 8.6,
      percentage: 4.1,
      usageMetric: '48.2 GB North America & Europe Egress',
      changePercent: +2.1,
      color: '#EC4899', // Pink
    },
  ],
  invoices: [
    {
      invoiceId: 'GCP-INV-2026-09',
      period: 'September 2026',
      amount: 238.1,
      status: 'paid',
      paymentMethod: 'Visa •••• 4242',
    },
    {
      invoiceId: 'GCP-INV-2026-08',
      period: 'August 2026',
      amount: 212.4,
      status: 'paid',
      paymentMethod: 'Visa •••• 4242',
    },
    {
      invoiceId: 'GCP-INV-2026-07',
      period: 'July 2026',
      amount: 194.5,
      status: 'paid',
      paymentMethod: 'Visa •••• 4242',
    },
  ],
};

// Daily cumulative spending history for current month
export const GCP_DAILY_SPEND_SERIES = [
  { day: 'Day 1', spend: 11.2 },
  { day: 'Day 2', spend: 22.8 },
  { day: 'Day 3', spend: 34.6 },
  { day: 'Day 4', spend: 46.1 },
  { day: 'Day 5', spend: 58.0 },
  { day: 'Day 6', spend: 69.8 },
  { day: 'Day 7', spend: 81.5 },
  { day: 'Day 8', spend: 93.4 },
  { day: 'Day 9', spend: 105.8 },
  { day: 'Day 10', spend: 118.2 },
  { day: 'Day 11', spend: 130.6 },
  { day: 'Day 12', spend: 142.8 },
];

/**
 * Generate CSV export data of current billing report
 */
export function generateBillingCsvContent(config: GcpBillingConfig): string {
  const headers = ['Service', 'Category', 'Current MTD Spend (USD)', 'Projected Spend (USD)', 'Usage Metric'];
  const rows = config.services.map((s) => [
    `"${s.name}"`,
    s.category,
    s.currentSpend.toFixed(2),
    s.projectedSpend.toFixed(2),
    `"${s.usageMetric}"`,
  ]);

  return [
    `# Google Cloud Platform Billing Export`,
    `# Project ID: ${config.projectId}`,
    `# Billing Account: ${config.billingAccountId}`,
    `# Budget Limit: $${config.monthlyBudgetLimit.toFixed(2)}`,
    `# Generated: ${new Date().toISOString()}`,
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n');
}
