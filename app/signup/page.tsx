'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useFinance } from '@/lib/store/finance-context';

export default function SignupPage() {
  const router = useRouter();
  const { refreshWorkspaces } = useFinance();

  // Form fields
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsExistingAccount(false);

    // Client-side validations
    const cleanFullName = fullName.trim();
    if (!cleanFullName) {
      setError('Please enter your full name.');
      return;
    }

    const cleanCompanyName = companyName.trim();
    if (!cleanCompanyName) {
      setError('Please enter your business or company name.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError('Please enter a valid work email address.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);

    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('fundflow_demo_mode_active_v1');
        localStorage.removeItem('fundflow_demo_mode_active_v1');
      }
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: cleanFullName,
          companyName: cleanCompanyName,
          email: cleanEmail,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409 || data.code === 'USER_ALREADY_EXISTS') {
        setIsExistingAccount(true);
        setError('An account with this email already exists. Please log in instead.');
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create account. Please try again.');
      }

      // If email confirmation is required by Supabase configuration
      if (data.requiresEmailConfirmation) {
        setConfirmedEmail(cleanEmail);
        setVerificationSent(true);
        return;
      }

      // If auto-authenticated (session issued immediately)
      if (data.session) {
        await supabase.auth.setSession(data.session);
      }

      if (data.workspace) {
        try {
          localStorage.setItem('fundflow_workspace_v1', JSON.stringify(data.workspace));
        } catch {}
      }

      if (refreshWorkspaces && data.workspace?.id) {
        await refreshWorkspaces(data.workspace.id);
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during account creation.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-surface via-surface-container-low to-surface-container">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-secondary-fixed mb-2 shadow-lg ring-4 ring-primary/10 hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-[32px] icon-fill">
              account_balance_wallet
            </span>
          </Link>
          <h1 className="text-3xl font-bold text-primary tracking-tight font-headline-lg">
            FundFlow
          </h1>
          <p className="text-sm text-on-surface-variant font-medium">
            Financial clarity & deterministic intelligence for founders
          </p>
        </div>

        {/* Verification Sent Success View */}
        {verificationSent ? (
          <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl p-6 sm:p-8 shadow-xl space-y-5 text-center animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-secondary-fixed/20 text-secondary mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-[28px]">mark_email_read</span>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-on-surface">Check Your Inbox</h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                We sent a verification link to{' '}
                <strong className="text-on-surface font-semibold">{confirmedEmail}</strong>.
              </p>
            </div>

            <div className="p-3.5 bg-surface-container-low rounded-xl text-xs text-on-surface-variant text-left space-y-2 border border-outline-variant/50">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm shrink-0 mt-0.5">check_circle</span>
                <span>Your workspace has been provisioned.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-primary text-sm shrink-0 mt-0.5">check_circle</span>
                <span>Click the verification link in your email to activate your account, then sign in.</span>
              </div>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="w-full py-3 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Sign In</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Signup Form Card */
          <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-on-surface">
                Create Your Business Account
              </h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Set up your dedicated corporate workspace with zero fake data.
              </p>
            </div>

            {error && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 ${
                  isExistingAccount
                    ? 'bg-primary-fixed/30 border border-primary/30 text-primary'
                    : 'bg-error-container/50 border border-error/30 text-error'
                }`}
              >
                <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                  {isExistingAccount ? 'account_circle' : 'error'}
                </span>
                <div className="flex-1 space-y-2">
                  <p className="font-medium">{error}</p>
                  {isExistingAccount && (
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[11px] font-semibold hover:bg-primary-container transition-colors"
                    >
                      <span>Sign In to Existing Account</span>
                      <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                    </Link>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="e.g. Alex Rivera"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/60 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Business / Company Name
                </label>
                <input
                  type="text"
                  required
                  autoComplete="organization"
                  placeholder="e.g. Acme Technologies Inc."
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/60 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="founder@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/60 disabled:opacity-60 font-mono-data"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-semibold text-on-surface">
                    Password
                  </label>
                  <span className="text-[11px] text-outline">Minimum 6 characters</span>
                </div>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/60 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/60 disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer pt-3"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                    <span>Creating Account & Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Create Account & Workspace</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Login Link */}
        <p className="text-center text-xs text-on-surface-variant">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-semibold hover:underline">
            Log in &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
