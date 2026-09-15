import type { Metadata } from 'next';
import { DemoLaunchpad } from '@/components/demo/DemoLaunchpad';

export const metadata: Metadata = {
  title: 'Demo Workspace — FundFlow',
  description: 'Explore the FundFlow interactive demo workspace with simulated startup financial data.',
};

export default function DemoPage() {
  return <DemoLaunchpad />;
}
