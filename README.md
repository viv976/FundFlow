# FundFlow

**Financial Co-Pilot for Startups** — CFO-level financial clarity without needing a CFO.

Live demo: [fundflow-nine.vercel.app](https://fundflow-nine.vercel.app/)

## Overview

FundFlow is a multi-tenant financial dashboard that gives founders real-time visibility into their company's cash position. It tracks cash on hand, monthly burn rate, runway, and month-over-month growth, then layers on AI-generated insights to flag risks and opportunities before they become problems.

## Features

- **Financial Dashboard** — live view of cash on hand, monthly burn, runway (in months), and MoM growth, each benchmarked against the prior period
- **Cash Flow Projection** — deterministic forecast chart comparing actual vs. projected cash trajectory
- **AI Insights / Co-Pilot** — grounded AI analysis surfacing revenue anomalies, burn rate alerts, and cost optimization suggestions
- **Expense Breakdown** — categorized view of operating expenses (payroll, marketing, software, infrastructure, etc.)
- **Transaction Ledger** — full record of inflows and outflows with category tagging
- **CSV Import** — bulk upload transactions to sync the ledger
- **Risk Alerts** — automated notifications for financial anomalies
- **Knowledge Base** — reference documents tied to the company's financial data
- **Multi-Tenant Support** — switch between businesses/organizations from a single account

## Tech Stack

- **Framework:** Next.js (React)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Deployment:** Vercel

## Deployment

FundFlow is deployed on [Vercel](https://vercel.com/). Pushing to the main branch triggers an automatic build and deployment.
