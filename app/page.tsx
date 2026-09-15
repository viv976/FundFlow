'use client';

import React from 'react';
import { LandingHeader } from '@/components/landing/LandingHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { CapabilitiesSection } from '@/components/landing/CapabilitiesSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { ProductPreview } from '@/components/landing/ProductPreview';
import { ProductStatusSection } from '@/components/landing/ProductStatusSection';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function PublicLandingPage() {
  return (
    <div className="min-h-screen w-full bg-surface text-on-surface flex flex-col justify-between">
      {/* 1. Public Navigation Header */}
      <LandingHeader />

      <main className="flex-1 w-full">
        {/* 2. Hero Section with Grounded SaaS Positioning */}
        <HeroSection />

        {/* 3. Four Implemented Capabilities */}
        <CapabilitiesSection />

        {/* 4. Five-Stage Implemented How-It-Works Pipeline */}
        <HowItWorksSection />

        {/* 5. Authentic Product Preview */}
        <ProductPreview />

        {/* 6. Transparent Product Status & Disclaimers */}
        <ProductStatusSection />
      </main>

      {/* 7. Public Footer */}
      <LandingFooter />
    </div>
  );
}
