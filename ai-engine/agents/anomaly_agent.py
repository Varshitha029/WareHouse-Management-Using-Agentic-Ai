from agents.base_agent import BaseAgent
from tools.gemini_client import GeminiClient
from tools.db_connector import DBConnector
from config.prompts import ANOMALY_AGENT_PROMPT
import json
from datetime import datetime


class AnomalyAgent(BaseAgent):
    """AI agent for anomaly and fraud detection across warehouse operations."""
    
    def __init__(self):
        super().__init__("AnomalyAgent", "Anomaly and fraud detection")
    
    async def process(self, data: dict) -> dict:
        try:
            action = data.get('action', 'detect')
            
            if action == 'detect':
                return await self._detect_anomalies()
            elif action == 'alerts':
                return await self._get_alerts()
            elif action == 'investigate':
                return await self._investigate(data)
            else:
                return await self._detect_anomalies()
        except Exception as e:
            return self.format_response(success=False, message=f"Anomaly error: {str(e)}")
    
    async def _detect_anomalies(self):
        """Run comprehensive anomaly detection across all operations."""
        # Gather all relevant data
        vehicles = await DBConnector.get_vehicles(limit=100)
        transactions = await DBConnector.get_transactions(limit=200)
        loans = await DBConnector.get_loans(limit=100)
        allocations = await DBConnector.get_storage_allocations(limit=200)
        
        context = {
            "vehicles": [
                {
                    "number": v.get('vehicleNumber', ''),
                    "grossWeight": v.get('grossWeight', 0),
                    "tareWeight": v.get('tareWeight', 0),
                    "netWeight": v.get('netWeight', 0),
                    "type": v.get('type', ''),
                    "date": str(v.get('createdAt', ''))
                }
                for v in vehicles[:30]
            ],
            "transactions": [
                {
                    "type": t.get('type', ''),
                    "grainType": t.get('grainType', ''),
                    "amount": t.get('amount', {}).get('totalAmount', 0) if isinstance(t.get('amount'), dict) else 0,
                    "date": str(t.get('createdAt', ''))
                }
                for t in transactions[:30]
            ],
            "loans": {
                "total": len(loans),
                "active": len([l for l in loans if l.get('status') == 'active']),
                "defaulted": len([l for l in loans if l.get('status') == 'defaulted'])
            },
            "storage": {
                "total_allocations": len(allocations),
                "grain_types": list(set(a.get('grainType', '') for a in allocations))
            }
        }
        
        prompt = f"""Perform comprehensive anomaly detection on this warehouse data:

{json.dumps(context, default=str)}

Check for:
1. Weighbridge fraud patterns (weight manipulation, tare weight inconsistencies)
2. Transaction anomalies (unusual amounts, timing patterns)
3. Loan risks (potential defaults, overleveraged customers)
4. Storage irregularities (quantity mismatches, unauthorized access patterns)
5. Operational inefficiencies that could indicate issues
6. Financial discrepancies

Respond in JSON: {{
    scan_timestamp: str,
    total_alerts: int,
    critical_alerts: int,
    alerts: [{{
        id: str,
        category: "weighbridge"|"transaction"|"loan"|"storage"|"financial",
        severity: "info"|"warning"|"critical",
        title: str,
        description: str,
        evidence: str,
        recommended_action: str,
        affected_entity: str
    }}],
    risk_summary: {{
        weighbridge: str,
        transactions: str,
        loans: str,
        storage: str,
        overall: str
    }},
    recommendations: [str]
}}"""
        
        result = await GeminiClient.generate_json(prompt, ANOMALY_AGENT_PROMPT)
        
        # Cache alerts
        try:
            db = await DBConnector.get_ai_db()
            await db.anomaly_alerts.insert_one({
                "timestamp": datetime.utcnow(),
                "alerts": result.get('alerts', []),
                "risk_summary": result.get('risk_summary', {})
            })
        except Exception:
            pass
        
        return self.format_response(success=True, data=result, message="Anomaly detection complete")
    
    async def _get_alerts(self):
        """Get recent anomaly alerts."""
        try:
            db = await DBConnector.get_ai_db()
            latest = await db.anomaly_alerts.find_one(
                {}, sort=[('timestamp', -1)]
            )
            
            if latest:
                return self.format_response(
                    success=True,
                    data={
                        "alerts": latest.get('alerts', []),
                        "risk_summary": latest.get('risk_summary', {}),
                        "last_scan": str(latest.get('timestamp', ''))
                    },
                    message="Alerts retrieved"
                )
            
            # No cached alerts, run fresh scan
            return await self._detect_anomalies()
        except Exception as e:
            return self.format_response(success=False, message=str(e))
    
    async def _investigate(self, data):
        """Investigate a specific anomaly or entity."""
        entity_type = data.get('entityType', '')  # vehicle, customer, loan
        entity_id = data.get('entityId', '')
        
        prompt = f"""Investigate potential anomaly for {entity_type}: {entity_id}

Provide a detailed investigation report in JSON: {{
    entity: str,
    investigation_summary: str,
    findings: [{{finding: str, severity: str, evidence: str}}],
    risk_level: str,
    recommended_actions: [str],
    requires_immediate_attention: bool
}}"""
        
        result = await GeminiClient.generate_json(prompt, ANOMALY_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Investigation complete")
