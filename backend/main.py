import os
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import requests

# Load environment from .env.local first, then fallback to .env
load_dotenv(".env.local")
load_dotenv(".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""))
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY", os.getenv("SUPABASE_PUBLISHABLE_KEY", os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")))

app = FastAPI(
    title="NuvRAG - Grounded Financial Co-Pilot API",
    description="Deterministic and grounded financial RAG analysis service for startups.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def supabase_request(endpoint: str, params: Optional[Dict[str, Any]] = None) -> Any:
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise HTTPException(status_code=503, detail="Supabase environment is not configured")
    
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/{endpoint}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    
    try:
        response = requests.get(url, headers=headers, params=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database request failed: {str(e)}")

class TransactionItem(BaseModel):
    id: Optional[str] = None
    workspace_id: Optional[str] = None
    transaction_date: str
    description: str
    merchant: Optional[str] = None
    category: str
    amount: float
    currency: str = "USD"
    transaction_type: str = "expense"
    status: str = "completed"

class QueryRequest(BaseModel):
    query: str
    workspace_id: Optional[str] = None
    transactions: List[TransactionItem] = Field(default_factory=list)

class ScenarioRequest(BaseModel):
    cash_on_hand: float
    current_monthly_burn: float
    additional_hires: int = 0
    salary_per_hire: float = 80000.0
    additional_monthly_spend: float = 0.0

@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "service": "NuvRAG Grounded Financial Co-Pilot",
        "version": "1.0.0",
        "supabase_configured": bool(SUPABASE_URL and SUPABASE_KEY)
    }

@app.get("/api/health")
def api_health():
    db_ok = False
    tx_count = 0
    try:
        if SUPABASE_URL and SUPABASE_KEY:
            res = supabase_request("transactions", {"select": "id", "limit": "1"})
            db_ok = True
            tx_count = len(res)
    except Exception:
        db_ok = False

    return {
        "status": "healthy" if db_ok else "degraded",
        "service": "NuvRAG Grounded Financial Co-Pilot",
        "supabase_connected": db_ok,
        "database_accessible": db_ok
    }

@app.get("/api/transactions")
def get_transactions(workspace_id: Optional[str] = None, limit: int = 100):
    params: Dict[str, Any] = {"select": "*", "order": "transaction_date.desc", "limit": str(limit)}
    if workspace_id:
        params["workspace_id"] = f"eq.{workspace_id}"
    return supabase_request("transactions", params)

@app.get("/api/monthly-summary")
def get_monthly_summary(workspace_id: Optional[str] = None):
    params: Dict[str, Any] = {"select": "*", "order": "month.asc"}
    if workspace_id:
        params["workspace_id"] = f"eq.{workspace_id}"
    return supabase_request("monthly_financial_summary", params)

@app.get("/api/knowledge")
def get_knowledge_documents(workspace_id: Optional[str] = None):
    params: Dict[str, Any] = {"select": "*"}
    if workspace_id:
        params["workspace_id"] = f"eq.{workspace_id}"
    return supabase_request("knowledge_documents", params)

@app.post("/api/scenario")
def calculate_scenario(req: ScenarioRequest):
    monthly_cost_hires = (req.additional_hires * req.salary_per_hire) / 12.0
    total_delta_burn = monthly_cost_hires + req.additional_monthly_spend
    new_monthly_burn = max(0.0, req.current_monthly_burn + total_delta_burn)
    
    current_runway = (req.cash_on_hand / req.current_monthly_burn) if req.current_monthly_burn > 0 else 999.0
    projected_runway = (req.cash_on_hand / new_monthly_burn) if new_monthly_burn > 0 else 999.0
    difference_months = max(0.0, current_runway - projected_runway)
    
    return {
        "cash_on_hand": req.cash_on_hand,
        "current_monthly_burn": req.current_monthly_burn,
        "new_monthly_burn": new_monthly_burn,
        "current_runway_months": round(current_runway, 1),
        "projected_runway_months": round(projected_runway, 1),
        "difference_months": round(difference_months, 1),
        "monthly_cost_impact": round(total_delta_burn, 2),
        "assumptions": [
            f"Additional headcount: {req.additional_hires} at ${req.salary_per_hire:,.0f}/yr",
            f"Monthly hire cost: +${monthly_cost_hires:,.0f}/mo",
            f"Monthly discretionary delta: ${req.additional_monthly_spend:,.0f}/mo"
        ]
    }

@app.post("/api/analyze")
def analyze_financials(req: QueryRequest):
    tx_list = req.transactions
    
    # If no transactions passed in request, attempt to load from Supabase
    if not tx_list and SUPABASE_URL and SUPABASE_KEY:
        try:
            params = {"select": "*", "limit": "200"}
            if req.workspace_id:
                params["workspace_id"] = f"eq.{req.workspace_id}"
            db_records = supabase_request("transactions", params)
            tx_list = [
                TransactionItem(
                    id=r.get("id"),
                    workspace_id=r.get("workspace_id"),
                    transaction_date=r.get("transaction_date", ""),
                    description=r.get("description", ""),
                    merchant=r.get("merchant"),
                    category=r.get("category", "Other"),
                    amount=float(r.get("amount", 0)),
                    currency=r.get("currency", "USD"),
                    transaction_type=r.get("transaction_type", "expense"),
                    status="completed"
                )
                for r in db_records
            ]
        except Exception:
            pass

    total_income = sum(t.amount for t in tx_list if t.transaction_type == "income")
    total_expense = sum(t.amount for t in tx_list if t.transaction_type == "expense")
    
    # Category aggregation
    categories: Dict[str, float] = {}
    for t in tx_list:
        if t.transaction_type == "expense":
            categories[t.category] = categories.get(t.category, 0.0) + t.amount
            
    sorted_categories = sorted(categories.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "query": req.query,
        "total_transactions": len(tx_list),
        "total_income": total_income,
        "total_expense": total_expense,
        "net_cash_flow": total_income - total_expense,
        "top_expense_categories": [
            {"category": k, "amount": v, "percentage": round((v / total_expense * 100) if total_expense > 0 else 0, 1)}
            for k, v in sorted_categories[:5]
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

