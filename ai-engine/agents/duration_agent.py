from agents.base_agent import BaseAgent
from tools.gemini_client import GeminiClient
from tools.db_connector import DBConnector
from config.prompts import DURATION_AGENT_PROMPT
import json


class DurationAgent(BaseAgent):
    """AI agent for demand forecasting and storage duration prediction."""
    
    def __init__(self):
        super().__init__("DurationAgent", "Demand forecasting and storage duration prediction")
    
    async def process(self, data: dict) -> dict:
        try:
            action = data.get('action', 'predict')
            
            if action == 'predict':
                return await self._predict_demand(data)
            elif action == 'predict_duration':
                return await self._predict_storage_duration(data)
            elif action == 'forecast':
                return await self._forecast_storage(data)
            elif action == 'seasonal':
                return await self._seasonal_analysis(data)
            else:
                return await self._predict_demand(data)
        except Exception as e:
            return self.format_response(success=False, message=f"Duration error: {str(e)}")
    
    async def _predict_demand(self, data):
        """Predict demand and optimal storage duration."""
        grain_type = data.get('grainType', 'all')
        quantity = data.get('quantity', 0)
        customer_id = data.get('customerId')
        
        # Gather relevant data
        market_prices = await DBConnector.get_market_prices()
        transactions = await DBConnector.get_transactions(
            customer_id=customer_id, limit=100
        )
        
        transaction_summary = [
            {
                'type': t.get('type', ''),
                'grainType': t.get('grainType', ''),
                'quantity': t.get('quantity', {}).get('quintals', 0),
                'date': str(t.get('createdAt', ''))
            }
            for t in transactions[:30]
        ]
        
        prompt = f"""Based on the following warehouse data, predict demand and optimal storage duration:

Grain Type: {grain_type}
Quantity: {quantity} quintals
Current Market Prices: {json.dumps(market_prices, default=str)}
Recent Transactions: {json.dumps(transaction_summary, default=str)}

Provide:
1. Demand forecast for next 3-6 months
2. Optimal storage duration recommendation
3. Price trend prediction
4. Best time to sell
5. Storage cost vs price gain analysis

Respond in JSON: {{
    demand_forecast: {{
        next_month: str,
        next_quarter: str,
        trend: "increasing"|"decreasing"|"stable"
    }},
    optimal_storage_months: int,
    price_prediction: {{
        current: int,
        one_month: int,
        three_months: int,
        six_months: int,
        trend: str
    }},
    best_sell_window: str,
    storage_analysis: {{
        monthly_storage_cost_per_quintal: int,
        expected_price_gain_per_month: int,
        break_even_months: int,
        net_benefit: str
    }},
    confidence: int,
    reasoning: str
}}"""
        
        result = await GeminiClient.generate_json(prompt, DURATION_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Demand prediction complete")
    
    async def _predict_storage_duration(self, data):
        """Predict optimal storage duration for a specific grain allocation."""
        grain_type = data.get('grainType', 'rice')
        total_bags = data.get('totalBags', 100)
        total_weight_kg = data.get('totalWeightKg', 5000)
        monthly_rent = data.get('monthlyRentPerBag', 50)
        
        market_prices = await DBConnector.get_market_prices()
        
        total_monthly_cost = monthly_rent * total_bags
        quintals = total_weight_kg / 100
        
        prompt = f"""Predict the optimal storage duration for this grain allocation:

Grain Type: {grain_type}
Total Bags: {total_bags}
Total Weight: {total_weight_kg} kg ({quintals} quintals)
Monthly Rent per Bag: ₹{monthly_rent}
Total Monthly Storage Cost: ₹{total_monthly_cost}

Current Market Prices: {json.dumps(market_prices, default=str)}

Analyze and respond in JSON format:
{{
    "optimal_months": <number 1-18>,
    "recommended_sell_month": "<month name like 'March 2026'>",
    "current_price_per_quintal": <number>,
    "predicted_price_per_quintal": <number after optimal months>,
    "expected_profit_per_quintal": <number>,
    "total_storage_cost": <number for total months>,
    "net_gain": <number profit minus storage cost>,
    "confidence_percent": <number 50-95>,
    "risk_level": "<low|medium|high>",
    "reasoning": "<2-3 sentence explanation>",
    "price_trend": "<increasing|stable|decreasing>",
    "best_action": "<hold|sell_now|sell_soon>"
}}"""
        
        result = await GeminiClient.generate_json(prompt, DURATION_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Duration prediction complete")
    
    async def _forecast_storage(self, data):
        """Forecast overall warehouse storage needs."""
        allocations = await DBConnector.get_storage_allocations(limit=200)
        customers = await DBConnector.get_users(role='customer')
        
        context = {
            "current_allocations": len(allocations),
            "total_customers": len(customers),
            "grain_distribution": {}
        }
        
        for a in allocations:
            grain = a.get('grainType', 'unknown')
            if grain not in context["grain_distribution"]:
                context["grain_distribution"][grain] = 0
            context["grain_distribution"][grain] += a.get('quantity', 0)
        
        prompt = f"""Forecast warehouse storage needs based on:
{json.dumps(context, default=str)}

Predict:
1. Storage demand for next 3 months
2. Which grains will need more space
3. Capacity planning recommendations
4. Seasonal storage patterns

Respond in JSON: {{
    forecast: [{{month: str, expected_occupancy: int, grain_demand: dict}}],
    capacity_alerts: [str],
    recommendations: [str],
    seasonal_patterns: str
}}"""
        
        result = await GeminiClient.generate_json(prompt, DURATION_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Storage forecast complete")
    
    async def _seasonal_analysis(self, data):
        """Analyze seasonal patterns."""
        transactions = await DBConnector.get_transactions(limit=200)
        
        monthly_data = {}
        for t in transactions:
            date = t.get('createdAt')
            if date:
                month_key = date.strftime('%Y-%m') if hasattr(date, 'strftime') else str(date)[:7]
                if month_key not in monthly_data:
                    monthly_data[month_key] = {'inward': 0, 'outward': 0, 'count': 0}
                monthly_data[month_key]['count'] += 1
                if t.get('type') == 'inward':
                    monthly_data[month_key]['inward'] += 1
                else:
                    monthly_data[month_key]['outward'] += 1
        
        prompt = f"""Analyze seasonal patterns from monthly transaction data:
{json.dumps(monthly_data, default=str)}

Provide seasonal insights in JSON: {{
    peak_months: [str],
    low_months: [str],
    patterns: [str],
    recommendations: [str]
}}"""
        
        result = await GeminiClient.generate_json(prompt, DURATION_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Seasonal analysis complete")
