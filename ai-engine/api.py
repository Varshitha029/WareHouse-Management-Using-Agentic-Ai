from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, model_validator
from typing import Optional, List, Dict, Any
import uvicorn
import subprocess
import threading
import json as _json
import os as _os
import sys as _sys

from coordinator.master_agent import MasterAgent
from config.settings import AI_ENGINE_PORT

app = FastAPI(
    title="WMS AI Engine",
    description="AI-powered analytics engine for Warehouse Management System",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize master agent
master = MasterAgent()

# ==================== Request Models ====================

class ChatRequest(BaseModel):
    message: str
    role: str = "owner"
    userId: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = []

    @model_validator(mode='before')
    @classmethod
    def unwrap_n8n_body(cls, data):
        """n8n wraps the payload as {body: {...}, query: {}, originalEndpoint: '...' }.
        Unwrap it so the actual fields are at the top level."""
        if isinstance(data, dict) and 'body' in data and 'message' not in data:
            body = data['body']
            if isinstance(body, dict) and 'message' in body:
                return body
        return data

class InventoryRequest(BaseModel):
    action: str = "analyze"
    grainType: Optional[str] = None
    quantity: Optional[float] = None

class EmailRequest(BaseModel):
    action: str = "generate"
    purpose: Optional[str] = None
    customerName: Optional[str] = None
    customerId: Optional[str] = None
    loanAmount: Optional[float] = None
    loanId: Optional[str] = None
    dueDate: Optional[str] = None
    daysOverdue: Optional[float] = None
    grainType: Optional[str] = None
    bags: Optional[int] = None
    storedSince: Optional[str] = None
    expiryDate: Optional[str] = None
    storageCharges: Optional[float] = None
    amount: Optional[float] = None
    paymentMode: Optional[str] = None
    reference: Optional[str] = None
    tone: Optional[str] = None
    extraContext: Optional[str] = None
    role: Optional[str] = "owner"

class LoanRiskRequest(BaseModel):
    action: str = "assess"
    customerId: Optional[str] = None
    loanAmount: Optional[float] = None
    grainType: Optional[str] = None
    grainQuantity: Optional[float] = None

class RiskAssessmentRequest(BaseModel):
    action: str = "portfolio"
    customerId: Optional[str] = None
    loanAmount: Optional[float] = None
    grainType: Optional[str] = None
    grainQuantity: Optional[float] = None
    entityType: Optional[str] = None
    entityId: Optional[str] = None

class MarketRequest(BaseModel):
    action: str = "predict"
    grainType: Optional[str] = "all"
    horizon: Optional[str] = "3months"
    quantity: Optional[float] = None
    storedSince: Optional[str] = None
    marketState: Optional[str] = None

class PredictDurationRequest(BaseModel):
    grain_type: str = "rice"
    total_bags: int = 100
    total_weight_kg: float = 5000
    monthly_rent_per_bag: float = 50

class AnomalyRequest(BaseModel):
    action: str = "detect"
    entityType: Optional[str] = None
    entityId: Optional[str] = None

class AutoRouteRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None

# ==================== Endpoints ====================

@app.get("/")
async def root():
    return {"message": "WMS AI Engine v2.0", "status": "running"}

@app.get("/health")
async def health():
    result = await master.health_check()
    return result

@app.post("/chat")
async def chat(request: ChatRequest):
    """
    WMS AI Chat — master orchestration endpoint.
    Automatically routes to the best specialist agent, enriches the
    response with real analysis data, then returns a natural language reply.
    """
    try:
        result = await master.auto_route(
            request.message,
            {
                'role':    request.role,
                'userId':  request.userId,
                'history': request.history or [],
            }
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FullAnalysisRequest(BaseModel):
    role: str = "owner"
    userId: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def unwrap_n8n_body(cls, data):
        if isinstance(data, dict) and 'body' in data and 'role' not in data:
            body = data['body']
            if isinstance(body, dict):
                return body
        return data


@app.post("/full-analysis")
async def full_analysis(request: FullAnalysisRequest):
    """
    WMS Full AI Analysis — runs all 5 specialist agents concurrently
    (Inventory, Market Pricing, Storage Duration, Loan Risk, Anomaly Detection)
    and synthesises a comprehensive management summary via the Chat Agent.
    """
    try:
        result = await master.full_analysis({
            'role':   request.role,
            'userId': request.userId,
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/inventory/analyze")
async def inventory_analyze(request: InventoryRequest):
    try:
        result = await master.route('inventory', {
            'action': request.action,
            'grainType': request.grainType,
            'quantity': request.quantity
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/email/generate")
async def email_generate(request: EmailRequest):
    try:
        result = await master.route('email', {
            'action':         request.action,
            'purpose':        request.purpose,
            'customerName':   request.customerName,
            'customerId':     request.customerId,
            'loanAmount':     request.loanAmount,
            'loanId':         request.loanId,
            'dueDate':        request.dueDate,
            'daysOverdue':    request.daysOverdue,
            'grainType':      request.grainType,
            'bags':           request.bags,
            'storedSince':    request.storedSince,
            'expiryDate':     request.expiryDate,
            'storageCharges': request.storageCharges,
            'amount':         request.amount,
            'paymentMode':    request.paymentMode,
            'reference':      request.reference,
            'tone':           request.tone,
            'extraContext':   request.extraContext,
            'role':           request.role or 'owner',
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/loan-risk/assess")
async def loan_risk_assess(request: LoanRiskRequest):
    try:
        result = await master.route('loan_risk', {
            'action': request.action,
            'customerId': request.customerId,
            'loanAmount': request.loanAmount,
            'grainType': request.grainType,
            'grainQuantity': request.grainQuantity
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/risk-assessment")
async def risk_assessment(request: RiskAssessmentRequest):
    """Portfolio-level risk snapshot used by backend fallback when n8n is slow/unavailable."""
    try:
        loan_risk = await master.route('loan_risk', {
            'action': 'assess',
            'customerId': request.customerId,
            'loanAmount': request.loanAmount,
            'grainType': request.grainType,
            'grainQuantity': request.grainQuantity
        })
        anomaly = await master.route('anomaly', {
            'action': 'detect',
            'entityType': request.entityType,
            'entityId': request.entityId
        })
        return {
            'success': True,
            'agent': 'risk_assessment',
            'data': {
                'loan_risk': loan_risk,
                'anomaly': anomaly
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/market/predict")
async def market_predict(request: MarketRequest):
    try:
        result = await master.route('pricing', {
            'action': request.action,
            'grainType': request.grainType,
            'horizon': request.horizon,
            'quantity': request.quantity,
            'storedSince': request.storedSince,
            'marketState': request.marketState
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/market/live")
async def market_live():
    try:
        result = await master.route('pricing', {'action': 'live'})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict-duration")
async def predict_duration(request: PredictDurationRequest):
    """Predict optimal storage duration for specific grain allocation."""
    try:
        result = await master.route('duration', {
            'action': 'predict_duration',
            'grainType': request.grain_type,
            'totalBags': request.total_bags,
            'totalWeightKg': request.total_weight_kg,
            'monthlyRentPerBag': request.monthly_rent_per_bag
        })
        # Wrap in expected format for frontend
        prediction = result.get('data', result) if isinstance(result, dict) else result
        return {'success': True, 'prediction': prediction}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/anomaly/detect")
async def anomaly_detect(request: AnomalyRequest):
    try:
        result = await master.route('anomaly', {
            'action': request.action,
            'entityType': request.entityType,
            'entityId': request.entityId
        })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/anomaly/alerts")
async def anomaly_alerts():
    try:
        result = await master.route('anomaly', {'action': 'alerts'})
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auto")
async def auto_route(request: AutoRouteRequest):
    """Automatically route to the best agent."""
    try:
        result = await master.auto_route(request.message, request.context)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Evaluation Endpoints ====================

_EVAL_DIR = _os.path.join(_os.path.dirname(__file__), "eval_results")
_eval_status = {"running": False, "started_at": None, "finished_at": None, "error": None}
_EVAL_TIMEOUT_SECONDS = int(_os.getenv("EVAL_TIMEOUT_SECONDS", "1800"))

def _run_eval_background():
    """Run evaluate_agents.py in a subprocess (blocking, called in a thread)."""
    global _eval_status
    import datetime
    _eval_status = {"running": True, "started_at": datetime.datetime.now().isoformat(), "finished_at": None, "error": None}
    script = _os.path.join(_os.path.dirname(__file__), "evaluate_agents.py")
    # Delete phase caches so evaluation re-runs fully fresh
    for phase_file in ["_phase1.json", "_phase2.json", "_phase3.json"]:
        cache = _os.path.join(_EVAL_DIR, phase_file)
        if _os.path.exists(cache):
            _os.remove(cache)
    try:
        result = subprocess.run(
            [_sys.executable, "-X", "utf8", script],
            cwd=_os.path.dirname(__file__),
            capture_output=True, text=True, timeout=_EVAL_TIMEOUT_SECONDS
        )
        if result.returncode != 0:
            _eval_status["error"] = result.stderr[-800:] if result.stderr else "Non-zero exit"
        _eval_status["running"] = False
        _eval_status["finished_at"] = datetime.datetime.now().isoformat()
    except subprocess.TimeoutExpired:
        _eval_status["running"] = False
        _eval_status["error"] = f"Evaluation timed out after {_EVAL_TIMEOUT_SECONDS} seconds. Increase EVAL_TIMEOUT_SECONDS or reduce evaluation workload."
        _eval_status["finished_at"] = datetime.datetime.now().isoformat()
    except Exception as exc:
        _eval_status["running"] = False
        _eval_status["error"] = str(exc)
        _eval_status["finished_at"] = datetime.datetime.now().isoformat()

@app.post("/eval/run")
async def eval_run():
    """Trigger a full re-evaluation in the background. Returns immediately."""
    if _eval_status["running"]:
        return {"success": False, "message": "Evaluation already in progress", "status": _eval_status}
    t = threading.Thread(target=_run_eval_background, daemon=True)
    t.start()
    return {"success": True, "message": "Evaluation started in background"}

@app.get("/eval/status")
async def eval_status_endpoint():
    """Return current evaluation run status."""
    return _eval_status

@app.get("/eval/summary")
async def eval_summary():
    """Return the latest eval_summary.json as JSON."""
    summary_path = _os.path.join(_EVAL_DIR, "eval_summary.json")
    if not _os.path.exists(summary_path):
        raise HTTPException(status_code=404, detail="No evaluation results found. Run evaluation first.")
    with open(summary_path, "r") as f:
        data = _json.load(f)
    return data

_ALLOWED_CHARTS = {
    "confusion_matrix.png", "response_latency.png", "success_rate.png",
    "agent_utilization.png", "orchestration_overhead.png", "radar_chart.png",
    "per_agent_accuracy.png", "architecture_diagram.png",
    "classification_metrics.png"
}

@app.get("/eval/charts/{filename}")
async def eval_chart(filename: str):
    """Serve a PNG chart from eval_results/."""
    if filename not in _ALLOWED_CHARTS:
        raise HTTPException(status_code=400, detail=f"Unknown chart: {filename}")
    chart_path = _os.path.join(_EVAL_DIR, filename)
    if not _os.path.exists(chart_path):
        raise HTTPException(status_code=404, detail=f"{filename} not found. Run evaluation first.")
    return FileResponse(chart_path, media_type="image/png")

@app.get("/eval/charts")
async def eval_chart_list():
    """List which charts are available."""
    available = []
    for name in _ALLOWED_CHARTS:
        path = _os.path.join(_EVAL_DIR, name)
        if _os.path.exists(path):
            available.append({"filename": name, "size_kb": round(_os.path.getsize(path) / 1024, 1)})
    return {"charts": sorted(available, key=lambda x: x["filename"])}


if __name__ == "__main__":
    uvicorn.run("api:app", host="0.0.0.0", port=AI_ENGINE_PORT, reload=True)
