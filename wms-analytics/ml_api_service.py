from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import pandas as pd
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# Load trained models and encoders
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))

# Model 1: Price Prediction
try:
    with open(os.path.join(MODEL_DIR, 'model1_price_prediction_BEST.pkl'), 'rb') as f:
        price_model = pickle.load(f)
    with open(os.path.join(MODEL_DIR, 'model1_label_encoders.pkl'), 'rb') as f:
        price_encoders = pickle.load(f)
    print("✓ Price prediction model loaded")
except Exception as e:
    print(f"✗ Failed to load price model: {e}")
    price_model = None
    price_encoders = None

# Model 2: Profit/Loss Classification
try:
    with open(os.path.join(MODEL_DIR, 'model2_profit_classification_BEST.pkl'), 'rb') as f:
        profit_model = pickle.load(f)
    with open(os.path.join(MODEL_DIR, 'model2_label_encoders.pkl'), 'rb') as f:
        profit_encoders = pickle.load(f)
    print("✓ Profit classification model loaded")
except Exception as e:
    print(f"✗ Failed to load profit model: {e}")
    profit_model = None
    profit_encoders = None

# Model 3: Storage Duration Prediction
try:
    with open(os.path.join(MODEL_DIR, 'model3_duration_prediction_BEST.pkl'), 'rb') as f:
        duration_model = pickle.load(f)
    with open(os.path.join(MODEL_DIR, 'model3_label_encoders.pkl'), 'rb') as f:
        duration_encoders = pickle.load(f)
    print("✓ Storage duration model loaded")
except Exception as e:
    print(f"✗ Failed to load duration model: {e}")
    duration_model = None
    duration_encoders = None

# Grain type mapping
GRAIN_TYPE_MAP = {
    'wheat': 0,
    'rice': 1,
    'maize': 2,
    'barley': 3,
    'soybean': 4
}

ACTIVITY_STATUS_MAP = {
    'active': 0,
    'inactive': 1,
    'completed': 2
}

SOLD_STATUS_MAP = {
    'sold': 0,
    'not_sold': 1
}

def encode_grain_type(grain_type):
    """Encode grain type to numeric value"""
    grain_lower = grain_type.lower()
    return GRAIN_TYPE_MAP.get(grain_lower, 0)  # Default to wheat

def encode_activity_status(status):
    """Encode activity status to numeric value"""
    status_lower = status.lower()
    return ACTIVITY_STATUS_MAP.get(status_lower, 0)  # Default to active

def encode_sold_status(status):
    """Encode sold status to numeric value"""
    status_lower = status.lower()
    return SOLD_STATUS_MAP.get(status_lower, 1)  # Default to not_sold

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'models_loaded': {
            'price_prediction': price_model is not None,
            'profit_classification': profit_model is not None,
            'duration_prediction': duration_model is not None
        }
    })

@app.route('/api/predict/price', methods=['POST'])
def predict_price():
    """Predict grain sale price"""
    try:
        if not price_model:
            return jsonify({'error': 'Price prediction model not loaded'}), 503

        data = request.json
        
        # Prepare features
        features = pd.DataFrame([{
            'grain_type_encoded': encode_grain_type(data.get('grain_type', 'wheat')),
            'total_bags': float(data.get('total_bags', 0)),
            'total_weight_kg': float(data.get('total_weight_kg', 0)),
            'storage_duration_days': float(data.get('storage_duration_days', 0)),
            'monthly_rent_per_bag': float(data.get('monthly_rent_per_bag', 50)),
            'total_rent_paid': float(data.get('total_rent_paid', 0)),
            'activity_status_encoded': encode_activity_status(data.get('activity_status', 'active')),
            'sold_status_encoded': encode_sold_status(data.get('sold_status', 'not_sold'))
        }])
        
        # Make prediction
        predicted_category = price_model.predict(features)[0]
        
        # Get prediction probabilities for confidence
        try:
            probabilities = price_model.predict_proba(features)[0]
            confidence = float(max(probabilities))
        except:
            confidence = 0.75  # Default confidence
        
        return jsonify({
            'predicted_category': str(predicted_category),
            'confidence': confidence,
            'probabilities': {
                'Low Price': float(probabilities[0]) if len(probabilities) > 0 else 0,
                'Medium Price': float(probabilities[1]) if len(probabilities) > 1 else 0,
                'High Price': float(probabilities[2]) if len(probabilities) > 2 else 0
            } if 'probabilities' in locals() else {}
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/predict/profit', methods=['POST'])
def predict_profit():
    """Predict profit/loss classification"""
    try:
        if not profit_model:
            return jsonify({'error': 'Profit classification model not loaded'}), 503

        data = request.json
        
        # Prepare features
        features = pd.DataFrame([{
            'grain_type_encoded': encode_grain_type(data.get('grain_type', 'wheat')),
            'total_bags': float(data.get('total_bags', 0)),
            'total_weight_kg': float(data.get('total_weight_kg', 0)),
            'storage_duration_days': float(data.get('storage_duration_days', 0)),
            'monthly_rent_per_bag': float(data.get('monthly_rent_per_bag', 50)),
            'total_rent_paid': float(data.get('total_rent_paid', 0)),
            'activity_status_encoded': encode_activity_status(data.get('activity_status', 'active'))
        }])
        
        # Make prediction
        predicted_profit = int(profit_model.predict(features)[0])
        is_profitable = bool(predicted_profit)
        
        # Get probability if model supports it
        try:
            probabilities = profit_model.predict_proba(features)[0]
            confidence = float(probabilities[predicted_profit])
        except:
            confidence = 0.75  # Default confidence
        
        return jsonify({
            'is_profitable': predicted_profit,
            'confidence': confidence,
            'profitability_status': 'Profitable' if is_profitable else 'Loss',
            'recommendation': 'Good position - continue storage' if is_profitable else 'Consider selling soon to minimize losses'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/predict/duration', methods=['POST'])
def predict_duration():
    """Predict storage duration"""
    try:
        if not duration_model:
            return jsonify({'error': 'Duration prediction model not loaded'}), 503

        data = request.json
        
        # Prepare features
        features = pd.DataFrame([{
            'grain_type_encoded': encode_grain_type(data.get('grain_type', 'wheat')),
            'total_bags': float(data.get('total_bags', 0)),
            'total_weight_kg': float(data.get('total_weight_kg', 0)),
            'monthly_rent_per_bag': float(data.get('monthly_rent_per_bag', 50)),
            'activity_status_encoded': encode_activity_status(data.get('activity_status', 'active'))
        }])
        
        # Make prediction
        predicted_category = duration_model.predict(features)[0]
        
        # Get prediction probabilities for confidence
        try:
            probabilities = duration_model.predict_proba(features)[0]
            confidence = float(max(probabilities))
        except:
            confidence = 0.75  # Default confidence
        
        # Map category to days range
        duration_mapping = {
            'Short-term': {'days': 45, 'range': '0-90 days'},
            'Medium-term': {'days': 135, 'range': '91-180 days'},
            'Long-term': {'days': 270, 'range': '181-365 days'}
        }
        
        duration_info = duration_mapping.get(str(predicted_category), {'days': 90, 'range': 'Unknown'})
        
        return jsonify({
            'predicted_category': str(predicted_category),
            'confidence': confidence,
            'estimated_days': duration_info['days'],
            'estimated_months': round(duration_info['days'] / 30, 1),
            'range': duration_info['range']
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/predict/batch', methods=['POST'])
def predict_batch():
    """Batch prediction for multiple customers"""
    try:
        data = request.json
        customers_data = data.get('customers', [])
        
        results = []
        for customer in customers_data:
            result = {
                'customerId': customer.get('customerId'),
                'predictions': {}
            }
            
            # Price prediction
            if price_model:
                try:
                    features = pd.DataFrame([{
                        'grain_type_encoded': encode_grain_type(customer.get('grain_type', 'wheat')),
                        'total_bags': float(customer.get('total_bags', 0)),
                        'total_weight_kg': float(customer.get('total_weight_kg', 0)),
                        'storage_duration_days': float(customer.get('storage_duration_days', 0)),
                        'monthly_rent_per_bag': float(customer.get('monthly_rent_per_bag', 50)),
                        'total_rent_paid': float(customer.get('total_rent_paid', 0)),
                        'activity_status_encoded': encode_activity_status(customer.get('activity_status', 'active')),
                        'sold_status_encoded': encode_sold_status(customer.get('sold_status', 'not_sold'))
                    }])
                    result['predictions']['price'] = float(price_model.predict(features)[0])
                except:
                    result['predictions']['price'] = None
            
            # Profit prediction
            if profit_model:
                try:
                    features = pd.DataFrame([{
                        'grain_type_encoded': encode_grain_type(customer.get('grain_type', 'wheat')),
                        'total_bags': float(customer.get('total_bags', 0)),
                        'total_weight_kg': float(customer.get('total_weight_kg', 0)),
                        'storage_duration_days': float(customer.get('storage_duration_days', 0)),
                        'monthly_rent_per_bag': float(customer.get('monthly_rent_per_bag', 50)),
                        'total_rent_paid': float(customer.get('total_rent_paid', 0)),
                        'activity_status_encoded': encode_activity_status(customer.get('activity_status', 'active'))
                    }])
                    result['predictions']['profitable'] = bool(profit_model.predict(features)[0])
                except:
                    result['predictions']['profitable'] = None
            
            results.append(result)
        
        return jsonify({'results': results})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/owner/portfolio-health', methods=['POST'])
def analyze_portfolio():
    """Placeholder for portfolio health analysis"""
    try:
        return jsonify({
            'success': True,
            'portfolio_health_score': 75,
            'message': 'Portfolio analysis endpoint - coming soon'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/owner/revenue-forecast', methods=['POST'])
def forecast_revenue():
    """
    Forecast revenue using linear trend analysis
    
    Expected input:
    {
        "historical_revenue": [{"month": "2024-01", "revenue": 50000}, ...],
        "forecast_months": 3
    }
    """
    try:
        data = request.json
        historical = data.get('historical_revenue', [])
        forecast_months = data.get('forecast_months', 3)
        
        if len(historical) < 2:
            return jsonify({
                'success': False,
                'error': 'Need at least 2 months of historical data'
            }), 400
        
        # Extract revenues
        revenues = np.array([item['revenue'] for item in historical])
        n = len(revenues)
        x = np.arange(n)
        
        # Linear regression
        x_mean = np.mean(x)
        y_mean = np.mean(revenues)
        slope = np.sum((x - x_mean) * (revenues - y_mean)) / np.sum((x - x_mean) ** 2)
        intercept = y_mean - slope * x_mean
        
        # Generate forecasts
        forecasts = []
        std_dev = np.std(revenues)
        
        for i in range(1, forecast_months + 1):
            next_month = n + i
            forecast_value = slope * next_month + intercept
            confidence_lower = max(0, forecast_value - 1.96 * std_dev)
            confidence_upper = forecast_value + 1.96 * std_dev
            
            forecasts.append({
                'month_offset': i,
                'forecast': round(forecast_value, 2),
                'lower_bound': round(confidence_lower, 2),
                'upper_bound': round(confidence_upper, 2)
            })
        
        trend = 'growing' if slope > 0 else 'declining' if slope < 0 else 'stable'
        growth_rate = (slope / y_mean * 100) if y_mean > 0 else 0
        
        return jsonify({
            'success': True,
            'forecasts': forecasts,
            'trend': trend,
            'monthly_growth_rate': round(growth_rate, 2),
            'current_avg_revenue': round(y_mean, 2)
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/owner/churn-prediction', methods=['POST'])
def predict_churn():
    """
    Predict customer churn risk
    
    Expected input:
    {
        "customers": [{
            "customer_id": str,
            "name": str,
            "total_transactions": int,
            "last_transaction_days_ago": int,
            "total_value": float,
            "grains_count": int
        }, ...]
    }
    """
    try:
        data = request.json
        customers = data.get('customers', [])
        
        at_risk_customers = []
        
        for customer in customers:
            risk_score = 0
            risk_factors = []
            
            # Recency factor
            days_since_last = customer.get('last_transaction_days_ago', 0)
            if days_since_last > 90:
                risk_score += 40
                risk_factors.append("No activity in 90+ days")
            elif days_since_last > 60:
                risk_score += 25
                risk_factors.append("No activity in 60+ days")
            elif days_since_last > 30:
                risk_score += 10
            
            # Transaction frequency
            if customer.get('total_transactions', 0) < 3:
                risk_score += 20
                risk_factors.append("Low transaction history")
            
            # Current engagement
            if customer.get('grains_count', 0) == 0:
                risk_score += 30
                risk_factors.append("No active grains stored")
            
            # Value factor
            if customer.get('total_value', 0) < 10000:
                risk_score += 10
            
            risk_level = 'High' if risk_score >= 60 else 'Medium' if risk_score >= 30 else 'Low'
            
            if risk_score >= 30:
                at_risk_customers.append({
                    'customer_id': customer.get('customer_id'),
                    'name': customer.get('name'),
                    'risk_score': risk_score,
                    'risk_level': risk_level,
                    'risk_factors': risk_factors,
                    'last_activity_days': days_since_last
                })
        
        at_risk_customers.sort(key=lambda x: x['risk_score'], reverse=True)
        
        return jsonify({
            'success': True,
            'at_risk_customers': at_risk_customers,
            'total_analyzed': len(customers),
            'high_risk_count': len([c for c in at_risk_customers if c['risk_level'] == 'High']),
            'medium_risk_count': len([c for c in at_risk_customers if c['risk_level'] == 'Medium'])
        })
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    print("\n" + "="*60)
    print("  WMS ML Prediction Service Starting...")
    print("="*60)
    print(f"\n  Models Directory: {MODEL_DIR}")
    print(f"  Price Model: {'✓ Loaded' if price_model else '✗ Not loaded'}")
    print(f"  Profit Model: {'✓ Loaded' if profit_model else '✗ Not loaded'}")
    print(f"  Duration Model: {'✓ Loaded' if duration_model else '✗ Not loaded'}")
    print("\n  Owner Analytics Endpoints: ✓ Enabled")
    print("    - /api/owner/portfolio-health")
    print("    - /api/owner/revenue-forecast")
    print("    - /api/owner/churn-prediction")
    print("\n" + "="*60)
    print("  Server running on http://localhost:8050")
    print("="*60 + "\n")
    
    app.run(host='0.0.0.0', port=8050, debug=True)
