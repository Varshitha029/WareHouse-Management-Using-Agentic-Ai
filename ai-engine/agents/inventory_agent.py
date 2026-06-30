from agents.base_agent import BaseAgent
from tools.gemini_client import GeminiClient
from tools.db_connector import DBConnector
from config.prompts import INVENTORY_AGENT_PROMPT
import json


class InventoryAgent(BaseAgent):
    """AI agent for inventory intelligence and storage optimization."""
    
    def __init__(self):
        super().__init__("InventoryAgent", "Inventory intelligence and storage optimization")
    
    async def process(self, data: dict) -> dict:
        try:
            action = data.get('action', 'analyze')
            
            if action == 'analyze':
                return await self._analyze_inventory()
            elif action == 'optimize':
                return await self._optimize_storage(data)
            elif action == 'predict_duration':
                return await self._predict_storage_duration(data)
            else:
                return await self._analyze_inventory()
        except Exception as e:
            return self.format_response(success=False, message=f"Inventory error: {str(e)}")
    
    async def _analyze_inventory(self):
        """Analyze current inventory status."""
        try:
            allocations = await DBConnector.get_storage_allocations(limit=200)
            layouts = await DBConnector.get_warehouse_layouts(limit=5)
            customers = await DBConnector.get_users(role='customer')
            
            context = {
                "total_allocations": len(allocations),
                "allocations": [
                    {
                        "customer": str(a.get('customer', '')),
                        "grainType": a.get('grainType', ''),
                        "quantity": a.get('quantity', 0),
                        "section": a.get('section', ''),
                        "status": a.get('status', 'active')
                    } for a in allocations[:50]
                ],
                "warehouse_count": len(layouts),
                "total_customers": len(customers)
            }
            
            prompt = f"""Analyze the following warehouse inventory data and provide insights:
            
{json.dumps(context, default=str)}

Provide:
1. Overall inventory health score (0-100)
2. Storage utilization percentage estimate
3. Key insights about grain distribution
4. Recommendations for optimization
5. Risk alerts (if any)

Respond in JSON format with keys: healthScore, utilization, insights (array), recommendations (array), alerts (array)"""
            
            result = await GeminiClient.generate_json(prompt, INVENTORY_AGENT_PROMPT)
            
            return self.format_response(
                success=True,
                data=result,
                message="Inventory analysis complete"
            )
        except Exception as e:
            return self.format_response(success=False, message=str(e))
    
    async def _optimize_storage(self, data):
        """Suggest storage optimization."""
        grain_type = data.get('grainType', '')
        quantity = data.get('quantity', 0)
        
        layouts = await DBConnector.get_warehouse_layouts()
        allocations = await DBConnector.get_storage_allocations()
        
        prompt = f"""Given the warehouse data:
Layouts: {json.dumps([{'sections': l.get('sections', [])} for l in layouts], default=str)}
Current allocations: {len(allocations)} active

A customer wants to store {quantity} quintals of {grain_type}.
Suggest the best storage location considering:
1. Grain compatibility (don't mix incompatible grains)
2. Available space
3. Optimal section for this grain type
4. Temperature and humidity considerations

Respond in JSON: {{section: str, reasoning: str, compatibility_score: int, recommendations: [str]}}"""
        
        result = await GeminiClient.generate_json(prompt, INVENTORY_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Storage optimization complete")
    
    async def _predict_storage_duration(self, data):
        """Predict optimal storage duration for grains."""
        grain_type = data.get('grainType', 'rice')
        quantity = data.get('quantity', 100)
        
        market_prices = await DBConnector.get_market_prices()
        
        prompt = f"""Predict the optimal storage duration for:
Grain: {grain_type}
Quantity: {quantity} quintals
Current market prices: {json.dumps(market_prices, default=str)}

Consider:
1. Price trends and seasonal patterns
2. Storage costs vs price appreciation
3. Grain quality degradation over time
4. Market demand patterns

Respond in JSON: {{
    optimal_months: int,
    expected_price_change: str,
    confidence: int,
    reasoning: str,
    monthly_forecast: [{{month: str, predicted_price: int}}]
}}"""
        
        result = await GeminiClient.generate_json(prompt, INVENTORY_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Duration prediction complete")
