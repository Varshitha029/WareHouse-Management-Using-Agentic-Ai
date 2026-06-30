from agents.base_agent import BaseAgent
from tools.gemini_client import GeminiClient
from tools.db_connector import DBConnector
from config.prompts import LOAN_RISK_AGENT_PROMPT
import json


class LoanRiskAgent(BaseAgent):
    """AI agent for loan risk assessment and credit scoring."""
    
    def __init__(self):
        super().__init__("LoanRiskAgent", "Loan risk assessment and credit scoring")
    
    async def process(self, data: dict) -> dict:
        try:
            action = data.get('action', 'assess')
            
            if action == 'assess':
                return await self._assess_loan_risk(data)
            elif action == 'score':
                return await self._credit_score(data)
            elif action == 'portfolio':
                return await self._portfolio_analysis()
            else:
                return await self._assess_loan_risk(data)
        except Exception as e:
            return self.format_response(success=False, message=f"Loan risk error: {str(e)}")
    
    async def _assess_loan_risk(self, data):
        """Assess loan risk for a specific customer or request."""
        customer_id = data.get('customerId')
        loan_amount = float(data.get('loanAmount', 0) or 0)
        grain_type = data.get('grainType', '')
        grain_quantity = float(data.get('grainQuantity', 0) or 0)
        
        # Gather customer data
        customer = None
        customer_loans = []
        customer_transactions = []
        customer_allocations = []
        
        if customer_id:
            customer = await DBConnector.get_user_by_id(customer_id)
            customer_loans = await DBConnector.get_loans(customer_id=customer_id)
            customer_transactions = await DBConnector.get_transactions(customer_id=customer_id)
            customer_allocations = await DBConnector.get_storage_allocations(customer_id=customer_id)
        
        market_prices = await DBConnector.get_market_prices()
        
        customer_profile = {
            "name": customer.get('name', 'Unknown') if customer else 'Unknown',
            "join_date": str(customer.get('createdAt', '')) if customer else '',
            "grain_type": customer.get('grainType', grain_type) if customer else grain_type,
            "total_loans": len(customer_loans),
            "active_loans": len([l for l in customer_loans if l.get('status') == 'active']),
            "completed_loans": len([l for l in customer_loans if l.get('status') == 'completed']),
            "defaulted_loans": len([l for l in customer_loans if l.get('status') == 'defaulted']),
            "total_transactions": len(customer_transactions),
            "stored_quantity": sum(a.get('quantity', 0) for a in customer_allocations),
            "storage_units": len(customer_allocations)
        }
        
        loan_details = [
            {
                "amount": l.get('amount', 0),
                "status": l.get('status', ''),
                "interestRate": l.get('interestRate', 0),
                "date": str(l.get('createdAt', ''))
            }
            for l in customer_loans[:10]
        ]
        
        prompt = f"""Assess loan risk for this customer:

Customer Profile: {json.dumps(customer_profile, default=str)}
Requested Loan Amount: ₹{loan_amount}
Grain as Collateral: {grain_quantity} quintals of {grain_type}
Loan History: {json.dumps(loan_details, default=str)}
Current Market Prices: {json.dumps(market_prices, default=str)}

Evaluate:
1. Customer creditworthiness based on history
2. Collateral adequacy (grain value vs loan amount)
3. Repayment likelihood
4. Risk factors
5. Recommendation (approve/reject/conditional)

Respond in JSON: {{
    risk_level: "low"|"medium"|"high"|"critical",
    risk_score: int (0-100, higher = riskier),
    credit_score: int (300-900),
    collateral_coverage: float,
    recommendation: "approve"|"reject"|"conditional",
    max_recommended_amount: int,
    suggested_interest_rate: float,
    conditions: [str],
    risk_factors: [{{factor: str, severity: str, description: str}}],
    strengths: [str],
    reasoning: str
}}"""
        
        result = await GeminiClient.generate_json(prompt, LOAN_RISK_AGENT_PROMPT)

        result = result or {}
        if not isinstance(result, dict):
            result = {}

        risk_score = int(max(0, min(100, self._to_float(result.get('risk_score'), 50))))
        recommendation = str(result.get('recommendation', '')).lower()
        if recommendation not in ('approve', 'reject', 'conditional'):
            recommendation = 'reject' if risk_score > 65 else ('conditional' if risk_score > 35 else 'approve')

        collateral_coverage = self._to_float(result.get('collateral_coverage'), 0)
        if collateral_coverage <= 0 and loan_amount > 0:
            collateral_value = self._estimate_collateral_value(
                market_prices,
                grain_type,
                grain_quantity,
                customer_profile.get('stored_quantity', 0)
            )
            if collateral_value > 0:
                collateral_coverage = collateral_value / loan_amount

        is_fresh_customer = (
            customer_profile.get('total_loans', 0) == 0 and
            customer_profile.get('completed_loans', 0) == 0 and
            customer_profile.get('defaulted_loans', 0) == 0 and
            customer_profile.get('total_transactions', 0) <= 5
        )

        has_reasonable_collateral = collateral_coverage >= 0.8
        has_strong_collateral = collateral_coverage >= 1.1
        is_small_ticket = 0 < loan_amount <= 150000

        conditions = result.get('conditions') if isinstance(result.get('conditions'), list) else []

        if is_fresh_customer and recommendation == 'reject':
            if has_strong_collateral:
                recommendation = 'conditional'
                risk_score = min(risk_score, 58)
                conditions.append('Fresh customer: start with monitored disbursement and shorter review cycle')
            elif has_reasonable_collateral and is_small_ticket:
                recommendation = 'conditional'
                risk_score = min(risk_score, 62)
                conditions.append('Fresh customer: approve only limited starter loan with periodic repayment checks')

        if recommendation == 'approve' and risk_score > 35:
            recommendation = 'conditional'

        if recommendation == 'reject' and risk_score <= 35:
            recommendation = 'conditional'

        if risk_score <= 30:
            risk_level = 'low'
        elif risk_score <= 60:
            risk_level = 'medium'
        elif risk_score <= 80:
            risk_level = 'high'
        else:
            risk_level = 'critical'

        result['risk_score'] = risk_score
        result['risk_level'] = risk_level
        result['recommendation'] = recommendation
        result['collateral_coverage'] = round(collateral_coverage, 3) if collateral_coverage else 0
        result['conditions'] = conditions

        if is_fresh_customer:
            reasoning = str(result.get('reasoning', '')).strip()
            fresh_note = 'Calibrated for fresh-customer profile: limited history increases uncertainty; recommendation softened when collateral coverage is adequate.'
            result['reasoning'] = f"{reasoning} {fresh_note}".strip()
        
        return self.format_response(success=True, data=result, message="Loan risk assessment complete")

    def _to_float(self, value, default=0.0):
        try:
            return float(value)
        except Exception:
            return float(default)

    def _extract_price_per_quintal(self, market_prices, grain_type):
        if not grain_type or not isinstance(market_prices, dict):
            return 0.0

        key = str(grain_type).strip().lower()
        value = market_prices.get(key)

        if isinstance(value, dict):
            return self._to_float(value.get('price'), 0.0)

        if isinstance(value, (int, float, str)):
            return self._to_float(value, 0.0)

        return 0.0

    def _estimate_collateral_value(self, market_prices, grain_type, requested_quantity_qtl, stored_quantity_qtl):
        quantity = requested_quantity_qtl if requested_quantity_qtl > 0 else self._to_float(stored_quantity_qtl, 0.0)
        if quantity <= 0:
            return 0.0

        price = self._extract_price_per_quintal(market_prices, grain_type)
        if price <= 0:
            return 0.0

        return quantity * price
    
    async def _credit_score(self, data):
        """Calculate credit score for a customer."""
        customer_id = data.get('customerId')
        
        if not customer_id:
            return self.format_response(success=False, message="Customer ID required")
        
        customer = await DBConnector.get_user_by_id(customer_id)
        loans = await DBConnector.get_loans(customer_id=customer_id)
        transactions = await DBConnector.get_transactions(customer_id=customer_id)
        
        prompt = f"""Calculate a credit score (300-900) for this warehouse customer:

Name: {customer.get('name', 'Unknown') if customer else 'Unknown'}
Total Loans: {len(loans)}
Active: {len([l for l in loans if l.get('status') == 'active'])}
Completed: {len([l for l in loans if l.get('status') == 'completed'])}
Defaulted: {len([l for l in loans if l.get('status') == 'defaulted'])}
Total Transactions: {len(transactions)}
Member Since: {str(customer.get('createdAt', '')) if customer else 'Unknown'}

Respond in JSON: {{
    credit_score: int,
    rating: "Excellent"|"Good"|"Fair"|"Poor",
    factors: [{{name: str, impact: "positive"|"negative", weight: int}}],
    improvement_tips: [str]
}}"""
        
        result = await GeminiClient.generate_json(prompt, LOAN_RISK_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Credit score calculated")
    
    async def _portfolio_analysis(self):
        """Analyze the overall loan portfolio."""
        all_loans = await DBConnector.get_loans(limit=200)
        
        portfolio = {
            "total": len(all_loans),
            "active": len([l for l in all_loans if l.get('status') == 'active']),
            "pending": len([l for l in all_loans if l.get('status') == 'pending']),
            "completed": len([l for l in all_loans if l.get('status') == 'completed']),
            "defaulted": len([l for l in all_loans if l.get('status') == 'defaulted']),
            "total_amount": sum(l.get('amount', 0) for l in all_loans),
            "active_amount": sum(l.get('amount', 0) for l in all_loans if l.get('status') == 'active')
        }
        
        prompt = f"""Analyze this loan portfolio:
{json.dumps(portfolio, default=str)}

Provide:
1. Portfolio health assessment
2. Risk distribution
3. Collection efficiency estimate
4. Recommendations

Respond in JSON: {{
    health_score: int,
    risk_distribution: {{low: int, medium: int, high: int}},
    collection_rate: float,
    at_risk_amount: int,
    recommendations: [str],
    summary: str
}}"""
        
        result = await GeminiClient.generate_json(prompt, LOAN_RISK_AGENT_PROMPT)
        
        return self.format_response(success=True, data=result, message="Portfolio analysis complete")
