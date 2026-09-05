# 🚀 How to Run NuvRAG (Grounded Financial Co-Pilot)

Welcome to **NuvRAG**, a deterministic, grounded financial intelligence platform and AI co-pilot designed for startup founders and finance teams.

---

## 📋 Prerequisites

Before running the application, make sure you have the following installed:

- **Node.js**: Version `18.18.0` or higher (Recommended: Node.js 20 LTS)
- **npm** (comes with Node.js) or `pnpm` / `yarn` / `bun`
- **Python**: Version `3.10+` (required only if running the standalone Python FastAPI backend)
- **Google Gemini API Key** (optional but recommended for live LLM reasoning — [Get a free key here](https://aistudio.google.com/app/apikey))

---

## ⚡ Quickstart (Frontend & Full Next.js Stack)

The Next.js application contains the complete UI, interactive charts, deterministic scenario calculation engine, and integrated AI chat routes.

### Step 1: Clone or Navigate to the Project Directory
```bash
cd /Users/vivaandesai/nuvrag
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables (Optional)
Create a `.env.local` file from the provided `.env.example`:
```bash
cp .env.example .env.local
```

Edit `.env.local` to add your Gemini API Key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
```

> **Note:** If you do not provide an API key in `.env.local`, you can still enter it directly within the web application on the **Settings** page (`/settings`), or rely on the built-in deterministic mathematical engine for financial calculations!

### Step 4: Start the Next.js Development Server
```bash
npm run dev
```

### Step 5: Open the Web Application
Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🐍 Running the FastAPI Backend Microservice (Optional)

NuvRAG includes an optional Python FastAPI backend microservice in [`backend/main.py`](backend/main.py) for external scenario simulation and financial analysis endpoints.

### Step 1: Create and Activate Python Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Step 2: Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Start the FastAPI Server
```bash
python backend/main.py
# or using uvicorn:
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### Step 4: Access API Documentation
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 🗄️ Setting Up Supabase Database (Optional)

By default, NuvRAG operates with responsive in-memory/browser-cached storage and built-in mock data for instant testing. If you want persistent cloud storage via Supabase:

1. Create a free project at [supabase.com](https://supabase.com).
2. Go to your Supabase SQL Editor and run the SQL migration script located at:
   - [`supabase/schema.sql`](supabase/schema.sql)
3. Copy your **Project URL** and **Anon Public Key** from Supabase Settings -> API.
4. Add them to `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

---

## 🗺️ Application Routes & Features

Once running, you can explore the following pages:

| Route | Page | Purpose |
| :--- | :--- | :--- |
| `/` | **Dashboard** | Financial overview: Runway, Monthly Burn, Cash on Hand, Inflow/Outflow charts, and AI Insights Feed. |
| `/ask-ai` | **Ask AI Co-Pilot** | Grounded financial reasoning, ledger citations, and "What-If" headcount scenario modeling. |
| `/transactions` | **Transactions Ledger** | View, search, filter by category/type, edit, and export transaction data. |
| `/upload` | **CSV Ingestion** | Drag & drop financial CSVs with automatic column header mapping & validation. |
| `/alerts` | **Alerts & Anomalies** | Automated detection of burn spikes, runway warnings, and recurring cost alerts. |
| `/settings` | **Settings** | Configure Gemini API keys, default currency, baseline burn thresholds, and reset data. |

---

## 🛠️ Verification & Build Commands

- **Run Next.js Dev Server**: `npm run dev`
- **Create Production Build**: `npm run build`
- **Start Production Server**: `npm run start`
- **Run ESLint Linter**: `npm run lint`

---

## 💡 Troubleshooting

- **Port 3000 is in use**: Run `npm run dev -- -p 3001` or kill the existing process on port 3000.
- **Missing Gemini Key warning**: Add `GEMINI_API_KEY` to `.env.local` or enter it directly in **Settings** (`/settings`) in the UI.
- **FastAPI CORS errors**: The backend middleware is configured to allow `*` by default for local development.
