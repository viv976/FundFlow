'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/supabase/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn(email.trim(), password);
      router.push('/');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid login credentials';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail('alex.rivera@demo.fundflow.app');
    setPassword('DemoPassword2026!');
    setError('');
    setIsLoading(true);

    try {
      await signIn('alex.rivera@demo.fundflow.app', 'DemoPassword2026!');
      router.push('/');
      router.refresh();
    } catch {
      router.push('/');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-br from-surface via-surface-container-low to-surface-container">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-secondary-fixed mb-2 shadow-lg ring-4 ring-primary/10">
            <span className="material-symbols-outlined text-[32px] icon-fill">
              account_balance_wallet
            </span>
          </div>
          <h1 className="text-3xl font-bold text-primary tracking-tight font-headline-lg">
            FundFlow
          </h1>
          <p className="text-sm text-on-surface-variant font-medium">
            Financial clarity & deterministic intelligence for founders
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface-container-lowest border border-outline-variant/80 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-on-surface">
              Sign In to Your Workspace
            </h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Enter your verified work email and password to access your corporate ledgers.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-error-container/50 border border-error/30 text-error rounded-xl text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1.5">
                Work Email
              </label>
              <input
                type="email"
                required
                placeholder="alex.rivera@demo.fundflow.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/60"
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
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-bright border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-outline/60"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-primary text-on-primary rounded-xl text-xs font-semibold hover:bg-primary-container transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">
                    progress_activity
                  </span>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to FundFlow</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-outline-variant/60 w-full"></div>
            <span className="bg-surface-container-lowest px-3 text-[10px] font-mono-data text-outline uppercase tracking-wider">
              Or Demo Access
            </span>
          </div>

          {/* Quick Demo Access */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full py-2.5 border border-outline-variant bg-surface-container-low/60 hover:bg-surface-container text-on-surface rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] text-secondary">
              verified_user
            </span>
            <span>Launch Acme Technologies Demo</span>
          </button>
        </div>

        {/* Signup Link */}
        <p className="text-center text-xs text-on-surface-variant">
          Don&apos;t have a business account yet?{' '}
          <Link href="/signup" className="text-primary font-semibold hover:underline">
            Create new organization &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
