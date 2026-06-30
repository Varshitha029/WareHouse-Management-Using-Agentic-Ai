from agents.base_agent import BaseAgent
from tools.gemini_client import GeminiClient
from tools.db_connector import DBConnector
from config.prompts import PRICING_AGENT_PROMPT
import json
import httpx
import os
from datetime import datetime


# ─── data.gov.in Agmarknet config ─────────────────────────────────────────────
DATAGOV_API_KEY   = os.getenv("DATAGOV_API_KEY", "")
DATAGOV_RESOURCE  = "current-daily-price-various-commodities-various-markets-mandi"
DATAGOV_STATE     = os.getenv("DATAGOV_STATE", "Telangana")

# Maps Agmarknet commodity names → our normalized grain names
COMMODITY_MAP = {
    "Wheat":               "wheat",
    "Rice":                "rice",
    "Paddy":               "rice",
    "Maize":               "maize",
    "Jowar(Sorghum)":      "jowar",
    "Jowar":               "jowar",
    "Bajra(Pearl Millet)": "bajra",
    "Bajra":               "bajra",
    "Barley":              "barley",
    "Red Gram(Tur)":       "red_gram",
    "Bengal Gram(Desi)":   "chana",
    "Soyabean":            "soybean",
    "Groundnut":           "groundnut",
    "Cotton":              "cotton",
    "Sunflower":           "sunflower",
    "Sesame(Sesame/Gingelly)": "sesame",
}


class PricingAgent(BaseAgent):
    """AI agent for market pricing intelligence and advisory."""
    
    def __init__(self):
        super().__init__("PricingAgent", "Market pricing intelligence and advisory")
    
    async def process(self, data: dict) -> dict:
        try:
            action = data.get('action', 'predict')
            
            if action == 'predict':
                return await self._predict_prices(data)
            elif action == 'live':
                return await self._get_live_prices()
            elif action == 'advise':
                return await self._price_advisory(data)
            else:
                return await self._predict_prices(data)
        except Exception as e:
            return self.format_response(success=False, message=f"Pricing error: {str(e)}")
    
    async def _predict_prices(self, data):
        """Predict future grain prices."""
        grain_type = data.get('grainType', 'all')
        horizon = data.get('horizon', '3months')
        market_state = data.get('marketState')

        # Always prefer live context (from n8n) or fresh Agmarknet data.
        # Fallback chain: n8n liveContext -> Agmarknet -> cached DB prices.
        live_context = data.get('liveContext')
        if isinstance(live_context, dict) and live_context:
            current_prices = live_context
            await DBConnector.save_market_prices(current_prices)
            price_source = 'n8n_live_context'
        else:
            try:
                current_prices = await self._fetch_market_data(market_state)
                await DBConnector.save_market_prices(current_prices)
                price_source = 'agmarknet_live'
            except Exception:
                current_prices = await DBConnector.get_market_prices()
                price_source = 'cached'

        transactions = await DBConnector.get_transactions(limit=100)
        
        # Calculate volume trends
        grain_volumes = {}
        for t in transactions:
            grain = t.get('grainType', 'unknown')
            qty = t.get('quantity', {}).get('quintals', 0) if isinstance(t.get('quantity'), dict) else 0
            if grain not in grain_volumes:
                grain_volumes[grain] = 0
            grain_volumes[grain] += qty
        
        prompt = f"""Predict grain market prices for Indian agricultural commodities:

Current Prices: {json.dumps(current_prices, default=str)}
Price Source: {price_source}
Grain: {grain_type}
Prediction Horizon: {horizon}
Warehouse Volume Trends: {json.dumps(grain_volumes, default=str)}
Current Date: {datetime.now().strftime('%Y-%m-%d')}

Consider:
1. Seasonal price patterns in Indian agriculture
2. Government MSP (Minimum Support Price) policies
3. Monsoon impact on supply
4. Historical price trends
5. Demand-supply dynamics

Respond in JSON: {{
    predictions: [{{
        grain: str,
        current_price: int,
        predicted_prices: {{
            one_week: int,
            one_month: int,
            three_months: int,
            six_months: int
        }},
        trend: "bullish"|"bearish"|"stable",
        confidence: int,
        factors: [str]
    }}],
    market_summary: str,
    best_time_to_sell: dict,
    alerts: [str]
}}"""
        
        result = await GeminiClient.generate_json(prompt, PRICING_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Price prediction complete")
    
    async def _get_live_prices(self):
        """Fetch and analyze live market prices."""
        try:
            # Fetch AI-generated realistic market prices
            live_prices = await self._fetch_market_data()
            
            # Save to database
            await DBConnector.save_market_prices(live_prices)
            
            return self.format_response(
                success=True,
                data={
                    "prices": live_prices,
                    "updated_at": datetime.now().isoformat(),
                    "source": "market_data"
                },
                message="Live prices fetched"
            )
        except Exception as e:
            # Fallback to cached prices
            cached = await DBConnector.get_market_prices()
            return self.format_response(
                success=True,
                data={
                    "prices": cached,
                    "updated_at": datetime.now().isoformat(),
                    "source": "cached"
                },
                message="Using cached prices"
            )
    
    async def _fetch_market_data(self, market_state=None):
        """Fetch live mandi prices from data.gov.in Agmarknet API.
        Falls back to AI-generated estimates if API key is not configured."""

        if not DATAGOV_API_KEY:
            # No API key — generate AI estimates and mark them clearly
            return await self._fetch_ai_estimated_prices()

        url = f"https://api.data.gov.in/resource/{DATAGOV_RESOURCE}"
        state = (market_state or DATAGOV_STATE or '').strip() or DATAGOV_STATE
        params = {
            "api-key": DATAGOV_API_KEY,
            "format":  "json",
            "limit":   500,
            "filters[State]": state,
        }

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        records = data.get("records", [])
        # Retry without state filter if exact state yields no rows
        if not records:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, params={"api-key": DATAGOV_API_KEY, "format": "json", "limit": 500})
                resp.raise_for_status()
                data = resp.json()
                records = data.get("records", [])
        if not records:
            raise ValueError("Agmarknet API returned no records")

        # Aggregate: grain → {total, count, markets, min_price, max_price}
        accum = {}
        for rec in records:
            raw = rec.get("commodity") or rec.get("Commodity", "")
            grain_key = COMMODITY_MAP.get(raw)
            if not grain_key:
                continue
            modal = float(rec.get("modal_price") or rec.get("Modal Price") or 0)
            mn    = float(rec.get("min_price")   or rec.get("Min Price")   or 0)
            mx    = float(rec.get("max_price")   or rec.get("Max Price")   or 0)
            mkt   = rec.get("market") or rec.get("Market", "")
            if modal <= 0:
                continue
            if grain_key not in accum:
                accum[grain_key] = {"total": 0, "count": 0, "mins": [], "maxs": [], "markets": []}
            accum[grain_key]["total"] += modal
            accum[grain_key]["count"] += 1
            accum[grain_key]["mins"].append(mn)
            accum[grain_key]["maxs"].append(mx)
            accum[grain_key]["markets"].append(mkt)

        result = {}
        for grain_key, a in accum.items():
            avg_modal = round(a["total"] / a["count"])
            result[grain_key] = {
                "price":     avg_modal,
                "unit":      "quintal",
                "min_price": round(min(a["mins"])),
                "max_price": round(max(a["maxs"])),
                "trend":     "stable",
                "source":    "agmarknet",
                "state":     state,
                "markets":   list(set(a["markets"]))[:5],
                "market_count": a["count"],
                "date":      datetime.now().strftime("%Y-%m-%d"),
            }

        return result

    async def _fetch_ai_estimated_prices(self):
        """Generate AI price estimates — used only when no Agmarknet API key is set."""
        prompt = f"""Generate current realistic Indian grain market prices as of {datetime.now().strftime('%Y-%m-%d')}.
Include: Rice (Paddy), Wheat, Maize, Jowar (Sorghum), Bajra (Pearl Millet), Cotton, Soybean, Groundnut, Red Gram (Tur), Bengal Gram (Chana).
Base on ACTUAL current Indian market rates (Telangana/AP region). Include MSP where applicable.

Respond in JSON: {{
    "rice":       {{"price": int, "unit": "quintal", "trend": str, "msp": int, "source": "ai_estimate"}},
    "wheat":      {{"price": int, "unit": "quintal", "trend": str, "msp": int, "source": "ai_estimate"}},
    "maize":      {{"price": int, "unit": "quintal", "trend": str, "msp": int, "source": "ai_estimate"}},
    "jowar":      {{"price": int, "unit": "quintal", "trend": str, "msp": int, "source": "ai_estimate"}},
    "bajra":      {{"price": int, "unit": "quintal", "trend": str, "msp": int, "source": "ai_estimate"}},
    "chana":      {{"price": int, "unit": "quintal", "trend": str, "msp": int, "source": "ai_estimate"}},
    "red_gram":   {{"price": int, "unit": "quintal", "trend": str, "msp": int, "source": "ai_estimate"}},
    "soybean":    {{"price": int, "unit": "quintal", "trend": str, "msp": int, "source": "ai_estimate"}},
    "groundnut":  {{"price": int, "unit": "quintal", "trend": str, "msp": int, "source": "ai_estimate"}},
    "cotton":     {{"price": int, "unit": "quintal", "trend": str, "msp": int, "source": "ai_estimate"}}
}}"""
        result = await GeminiClient.generate_json(prompt, PRICING_AGENT_PROMPT)
        # Tag all items as AI estimates
        if isinstance(result, dict):
            for k in result:
                if isinstance(result[k], dict):
                    result[k]["source"] = "ai_estimate"
        return result

    
    async def _price_advisory(self, data):
        """Provide price advisory for a specific customer's grain."""
        grain_type = data.get('grainType', '')
        quantity = data.get('quantity', 0)
        stored_since = data.get('storedSince', '')
        
        current_prices = await DBConnector.get_market_prices()
        
        prompt = f"""Provide pricing advisory for a warehouse customer:

Grain: {grain_type}
Quantity: {quantity} quintals
Stored Since: {stored_since}
Current Market Prices: {json.dumps(current_prices, default=str)}

Advise on:
1. Should they sell now or hold?
2. Expected price movement
3. Optimal selling strategy
4. Storage cost consideration
5. Market timing

Respond in JSON: {{
    recommendation: "sell_now"|"hold"|"partial_sell",
    current_value: int,
    expected_value_3months: int,
    reasoning: str,
    strategy: str,
    risk_level: "low"|"medium"|"high",
    key_factors: [str]
}}"""
        
        result = await GeminiClient.generate_json(prompt, PRICING_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Price advisory complete")
