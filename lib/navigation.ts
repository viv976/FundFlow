export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badgeKey?: 'alerts';
  mobilePrimary?: boolean;
  description?: string;
}

/**
 * Authoritative single source of truth for all application navigation routes.
 * Preserves the exact ordering, icons, paths, and labels from the sidebar ledger design.
 */
export const ALL_NAV_ITEMS: readonly NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'dashboard',
    mobilePrimary: true,
    description: 'Financial intelligence & runway overview',
  },
  {
    id: 'transactions',
    label: 'Transactions',
    href: '/transactions',
    icon: 'receipt_long',
    mobilePrimary: true,
    description: 'Reconciled multi-tenant ledger & cash transactions',
  },
  {
    id: 'scenarios',
    label: 'Scenario Planner',
    href: '/scenarios',
    icon: 'query_stats',
    mobilePrimary: true,
    description: 'Deterministic what-if financial forecasting',
  },
  {
    id: 'alerts',
    label: 'Risk Alerts',
    href: '/alerts',
    icon: 'notifications',
    badgeKey: 'alerts',
    description: 'Rule-based guardrails & cash drawdown alerts',
  },
  {
    id: 'reports',
    label: 'Reports & Trends',
    href: '/reports',
    icon: 'analytics',
    description: 'Executive burn analytics & category breakdown',
  },
  {
    id: 'ask-ai',
    label: 'AI Co-Pilot',
    href: '/ask-ai',
    icon: 'smart_toy',
    mobilePrimary: true,
    description: 'Grounded financial reasoning & ledger insights',
  },
  {
    id: 'documents',
    label: 'Knowledge Base',
    href: '/documents',
    icon: 'menu_book',
    description: 'Corporate context & accounting documentation',
  },
  {
    id: 'upload',
    label: 'Upload CSV',
    href: '/upload',
    icon: 'cloud_upload',
    description: 'Bank statement & transaction ingestion wizard',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: 'settings',
    description: 'Guardrail thresholds & workspace preferences',
  },
] as const;

/**
 * 4 Primary mobile bottom navigation items.
 * Combined with the "More" menu item, this gives exactly 5 touch-friendly destinations.
 */
export const PRIMARY_MOBILE_ITEMS: readonly NavItem[] = ALL_NAV_ITEMS.filter(
  (item) => item.mobilePrimary === true
);

/**
 * Secondary navigation items exposed in the mobile "More" menu sheet.
 */
export const SECONDARY_MOBILE_ITEMS: readonly NavItem[] = ALL_NAV_ITEMS.filter(
  (item) => !item.mobilePrimary
);

/**
 * Determines whether a given route is currently active.
 * Exact match for root /dashboard, prefix match for nested routes.
 */
export function isRouteActive(href: string, pathname: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname.startsWith(href);
}

/**
 * Checks if the current pathname matches any item in the secondary navigation list.
 */
export function isSecondaryRouteActive(pathname: string): boolean {
  return SECONDARY_MOBILE_ITEMS.some((item) => isRouteActive(item.href, pathname));
}
