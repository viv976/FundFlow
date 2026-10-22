'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentAuthUser, createNewWorkspace } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/client';
import { useFinance } from '@/lib/store/finance-context';
import {
  SUPPORTED_CURRENCIES,
  SUPPORTED_INDUSTRIES,
  DEFAULT_CURRENCY,
  DEFAULT_INDUSTRY,
  DEFAULT_STARTING_CASH,
  DEFAULT_RUNWAY_ALERT_THRESHOLD,
} from '@/lib/finance/calculator';

export default function OnboardingPage() {
  const router = useRouter();
  const { refreshWorkspaces } = useFinance();

  // Founder credentials state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  // Business / Workspace state
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState<string>(DEFAULT_INDUSTRY);
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [startingCash, setStartingCash] = useState<string>(String(DEFAULT_STARTING_CASH));
  const [runwayThreshold, setRunwayThreshold] = useState<string>(String(DEFAULT_RUNWAY_ALERT_THRESHOLD));

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentAuthUserId, setCurrentAuthUserId] = useState<string | null>(null);
  const [currentAuthEmail, setCurrentAuthEmail] = useState<string | null>(null);

  useEffect(() => {
    async function checkUser() {
      const user = await getCurrentAuthUser();
      if (user && user.id) {
        setIsAuthenticated(true);
        setCurrentAuthUserId(user.id);
        setCurrentAuthEmail(user.email);
        if (user.profile?.full_name && user.profile.full_name !== 'Alex Rivera') {
          setFullName(user.profile.full_name);
        }
        if (user.email && user.email !== 'alex.rivera@demo.fundflow.app') {
          setEmail(user.email);
        }
      }
    }
    checkUser();
  }, []);

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!businessName.trim()) {
      setError('Please enter your Business / Company Legal Name.');
      return;
    }

    if (!SUPPORTED_INDUSTRIES.includes(industry as typeof SUPPORTED_INDUSTRIES[number])) {
      setError('Please select a valid industry from the supported list.');
      return;
    }

    if (!SUPPORTED_CURRENCIES.some((c) => c.code === currency)) {
      setError('Please select a supported reporting currency.');
      return;
    }

    const cash = parseFloat(startingCash);
    if (isNaN(cash) || !Number.isFinite(cash) || cash < 0) {
      setError('Please enter a valid initial cash balance (0 or greater).');
      return;
    }

    const threshold = parseFloat(runwayThreshold);
    if (isNaN(threshold) || !Number.isFinite(threshold) || threshold < 1 || threshold > 60) {
      setError('Runway threshold must be between 1 and 60 months.');
      return;
    }

    // Unauthenticated visitors must provide valid founder credentials
    const cleanEmail = email.trim().toLowerCase();
    if (!isAuthenticated) {
      if (!cleanEmail || !cleanEmail.includes('@')) {
        setError('Please enter a valid Gmail or Work Email address.');
        return;
      }

      if (!password || password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('fundflow_demo_mode_active_v1');
        localStorage.removeItem('fundflow_demo_mode_active_v1');
      }

      let effectiveUserId = currentAuthUserId;

      // 1. If not authenticated, setup / register founder account first
      if (!isAuthenticated) {
        const authSetupRes = await fetch('/api/auth/setup-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password,
            fullName: fullName.trim() || 'Founder',
            phone: phone.trim(),
            industry,
            currency,
          }),
        });

        const authData = await authSetupRes.json();
        if (!authSetupRes.ok || !authData.success) {
          throw new Error(authData.error || 'Failed to configure founder credentials');
        }

        effectiveUserId = authData.userId;

        // Sign in on client to establish active session
        try {
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });
          if (signInErr) {
            console.warn('Direct sign-in note:', signInErr.message);
          }
        } catch (clientAuthErr) {
          console.warn('Client auth warning:', clientAuthErr);
        }
      }

      // 2. Create workspace linked to authenticated founder
      const created = await createNewWorkspace(
        effectiveUserId || '',
        businessName.trim(),
        currency,
        cash,
        threshold,
        industry
      );

      if (created) {
        // Save active workspace & user profile directly to LocalStorage
        if (typeof window !== 'undefined') {
          try {
            const mappedWs = {
              id: created.id,
              name: created.name,
              owner_id: created.owner_id,
              currency: created.currency || currency,
              starting_cash: typeof created.starting_cash === 'number' ? created.starting_cash : cash,
              alert_runway_threshold: typeof created.alert_runway_threshold === 'number' ? created.alert_runway_threshold : threshold,
              created_at: created.created_at,
            };
            localStorage.setItem('fundflow_workspace_v1', JSON.stringify(mappedWs));
          } catch (storageErr) {
            console.warn('Storage sync warning:', storageErr);
          }
        }

        if (refreshWorkspaces) {
          await refreshWorkspaces(created.id);
        }

        // Navigate directly to dashboard with the new business
        router.push('/dashboard');
        router.refresh();
      } else {
        setError('Workspace could not be created. Please try again.');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create workspace';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* Header */}
      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/60 shadow-sm w-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-mono-data uppercase tracking-wider text-secondary-fixed bg-primary px-2.5 py-0.5 rounded font-bold">
            Entity Onboarding
          </span>
          <span className="text-xs text-on-surface-variant font-medium">• Multi-Tenant Setup</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tight font-headline-lg">
          Setup Your Business
        </h1>
        <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
          Create your corporate entity, setup founder credentials, and initialize your ledger. All financial records will be isolated to this workspace.
        </p>
      </div>

      {/* Main Setup Card */}
      <div className="bg-surface-container-lowest border border-outline-variant/70 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 w-full">
        {error && (
          <div className="p-3.5 bg-error-container/50 border border-error/30 text-error rounded-xl text-xs flex items-center gap-2.5">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleCreateBusiness} className="space-y-6">
          {/* Section 1: Founder Account Credentials or Active Session */}
          {isAuthenticated ? (
            <div className="p-4 bg-surface-container-low border border-outline-variant/60 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  {fullName ? fullName[0]?.toUpperCase() : 'F'}
                </div>
                <div>
                  <p className="text-xs font-semibold text-on-surface">{fullName || 'Founder'}</p>
                  <p className="text-[11px] text-on-surface-variant font-mono-data">{currentAuthEmail}</p>
                </div>
              </div>
              <span className="text-[10px] uppercase font-mono-data font-bold tracking-wider px-2.5 py-1 rounded-full bg-primary text-secondary-fixed">
                Active Account
              </span>
            </div>
          ) : (
            <div className="space-y-3.5 pb-5 border-b border-outline-variant/50">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-[18px]">badge</span>
                  <span>Founder Account Credentials</span>
                </h2>
                {currentAuthEmail && currentAuthEmail !== 'alex.rivera@demo.fundflow.app' && (
                  <span className="text-[11px] font-mono-data text-secondary-fixed bg-primary px-2 py-0.5 rounded">
                    {currentAuthEmail}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">
                    Full Name / Founder Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Rivera"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono-data"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1.5">
                    Gmail / Work Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="founder@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono-data"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-semibold text-on-surface">
                      Password *
                    </label>
                    <span className="text-[10px] text-outline">Min 6 chars</span>
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono-data"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 2: Business & Workspace Details */}
          <div className="space-y-3.5">
            <h2 className="text-sm font-bold text-on-surface uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[18px]">corporate_fare</span>
              <span>Business & Workspace Details</span>
            </h2>

            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                Business / Company Legal Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Marketing Agency or Desai Foods LLC"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Industry / Sector
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  {SUPPORTED_INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Base Ledger Currency *
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer font-medium"
                >
                  {SUPPORTED_CURRENCIES.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code} ({curr.symbol}) — {curr.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Initial Cash Balance ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="0"
                  value={startingCash}
                  onChange={(e) => setStartingCash(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl font-mono-data text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Runway Alert Threshold
                </label>
                <select
                  value={runwayThreshold}
                  onChange={(e) => setRunwayThreshold(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                >
                  <option value="3">3 Months (Aggressive)</option>
                  <option value="6">6 Months (Standard)</option>
                  <option value="9">9 Months (Conservative)</option>
                  <option value="12">12 Months (Cautious)</option>
                </select>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer mt-4"
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
                <span>Configuring Account & Provisioning Business...</span>
              </>
            ) : (
              <>
                <span>Create Business & Launch Dashboard</span>
                <span className="material-symbols-outlined text-[16px]">rocket_launch</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
