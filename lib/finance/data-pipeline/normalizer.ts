import { Transaction } from '@/types/finance';
import { NormalizedCandidate } from './types';

/**
 * Deterministic categorization rules matching standard business accounting
 */
export const CATEGORY_RULES: { keywords: string[]; category: string; isIncome?: boolean }[] = [
  {
    keywords: [
      'aws',
      'amazon web services',
      'google cloud',
      'gcp',
      'azure',
      'digitalocean',
      'vercel',
      'cloudflare',
      'datadog',
      'mongodb',
      'heroku',
      'redis',
      'render',
      'supabase',
      'neon',
    ],
    category: 'Cloud Infrastructure',
    isIncome: false,
  },
  {
    keywords: [
      'stripe',
      'client wire',
      'payout',
      'customer payment',
      'customer revenue',
      'shopify',
      'subscription revenue',
      'invoice paid',
      'deposit',
      'wire transfer in',
      'acme corp',
      'pilot customer',
      'orbit systems',
      'northstar inc',
      'vertex labs',
      'revenue',
    ],
    category: 'Customer Revenue',
    isIncome: true,
  },
  {
    keywords: [
      'gusto',
      'rippling',
      'deel',
      'payroll',
      'salary',
      'salaries',
      'wages',
      'bonus',
      'direct deposit payroll',
      'compensation',
      'employee',
    ],
    category: 'Payroll',
    isIncome: false,
  },
  {
    keywords: [
      'adobe',
      'adobe creative cloud',
      'github',
      'slack',
      'figma',
      'notion',
      'linear',
      'zoom',
      'openai',
      'anthropic',
      'hubspot',
      'atlassian',
      'jira',
      'google workspace',
      'gsuite',
      'microsoft 365',
      'office 365',
      'docker',
      'postman',
      'sentry',
      '1password',
    ],
    category: 'SaaS & Software',
    isIncome: false,
  },
  {
    keywords: [
      'google ads',
      'meta ads',
      'facebook ads',
      'linkedin ads',
      'twitter ads',
      'x ads',
      'advertising',
      'marketing',
      'agency fee',
      'sponsorship',
      'campaign',
      'adwords',
    ],
    category: 'Marketing',
    isIncome: false,
  },
  {
    keywords: [
      'wework',
      'office rent',
      'real estate',
      'coworking',
      'landlord',
      'facilities',
      'lease',
      'rent',
      'office space',
    ],
    category: 'Rent & Office',
    isIncome: false,
  },
  {
    keywords: [
      'contractor',
      'freelance',
      'upwork',
      'fiverr',
      'consultant',
      'design agency',
      'contractors',
    ],
    category: 'Contractors',
    isIncome: false,
  },
  {
    keywords: [
      'legal',
      'lawyer',
      'law firm',
      'cpa',
      'accounting',
      'tax',
      'audit',
      'incorporation',
      'delaware',
      'professional services',
      'consulting',
      'notary',
    ],
    category: 'Legal & Professional',
    isIncome: false,
  },
  {
    keywords: [
      'delta',
      'united',
      'american airlines',
      'uber',
      'lyft',
      'airbnb',
      'flight',
      'hotel',
      'expedia',
      'railway',
      'train',
      'travel',
      'airline',
    ],
    category: 'Travel',
    isIncome: false,
  },
];

/**
 * Standard RFC4122 v4 UUID generator
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Deterministic categorization based on description and merchant keywords
 */
export function categorizeTransaction(
  description: string,
  merchant?: string,
  defaultType: 'income' | 'expense' = 'expense'
): {
  category: string;
  isCategorized: boolean;
} {
  const text = `${description || ''} ${merchant || ''}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        return {
          category: rule.category,
          isCategorized: true,
        };
      }
    }
  }

  return {
    category: defaultType === 'income' ? 'Customer Revenue' : 'Uncategorized',
    isCategorized: false,
  };
}

/**
 * Normalizes a candidate into a canonical Transaction entity ready for persistence.
 */
export function normalizeCandidateToTransaction(
  candidate: NormalizedCandidate,
  workspaceId: string
): Transaction {
  let finalCategory = candidate.category;

  if (!finalCategory || finalCategory === 'Uncategorized' || finalCategory === 'Other') {
    const autoCat = categorizeTransaction(
      candidate.description,
      candidate.merchant,
      candidate.transaction_type
    );
    if (autoCat.isCategorized) {
      finalCategory = autoCat.category;
    } else {
      finalCategory = 'Uncategorized';
    }
  }

  return {
    id: generateUUID(),
    workspace_id: workspaceId,
    transaction_date: candidate.transaction_date,
    description: candidate.description,
    merchant: candidate.merchant,
    category: finalCategory,
    subcategory: candidate.subcategory,
    amount: Math.abs(candidate.amount),
    currency: candidate.currency || 'USD',
    transaction_type: candidate.transaction_type,
    status: 'completed',
    source: 'csv_import',
    external_reference: candidate.external_reference,
    metadata: {
      ...candidate.metadata,
      fingerprint: candidate.fingerprint,
    },
    created_at: new Date().toISOString(),
  };
}
