# WMS Machine Learning Predictions Integration

## Overview
This integration adds AI-powered predictions and market intelligence to the Warehouse Management System. The system uses three trained machine learning models to provide insights and alerts to warehouse owners.

## Features

### 1. **Predictions Tab** (Owner Dashboard)
- **Price Prediction**: Predicts the expected sale price for stored grain
- **Profit/Loss Analysis**: Classifies customers as profitable or at-risk
- **Storage Duration Forecasting**: Estimates optimal storage duration
- **Real-time Alerts**: AI-generated alerts for at-risk customers
- **Market Trends**: Market intelligence and price movement alerts

### 2. **Enhanced Alerts Center**
- Integration with ML predictions
- Automated risk alerts for customers
- Market trend notifications
- Predictive insights displayed prominently

## Machine Learning Models

### Model 1: Grain Sale Price Prediction
- **Type**: Regression (Random Forest/Decision Tree)
- **Input Features**: 
  - Grain type, total bags, total weight
  - Storage duration, monthly rent, total rent paid
  - Activity status, sold status
- **Output**: Predicted sale price per kg (₹)

### Model 2: Profit/Loss Classification
- **Type**: Binary Classification
- **Input Features**:
  - Grain type, storage metrics, costs
- **Output**: Profitable (Yes/No) + Probability

### Model 3: Storage Duration Prediction
- **Type**: Regression
- **Input Features**:
  - Grain type, quantity, rent per bag
- **Output**: Predicted storage duration (days)

## Setup Instructions

### Prerequisites
```bash
# Python packages required
pip install flask flask-cors pandas numpy scikit-learn pickle5
```

### Step 1: Train Models (if not already trained)
```bash
cd wms-analytics

# Run Jupyter notebooks to train models
jupyter notebook

# Execute in order:
# 1. price_prediction.ipynb
# 2. profit_classification.ipynb
# 3. storage_duration.ipynb
```

This will generate:
- `model1_price_prediction_BEST.pkl`
- `model1_label_encoders.pkl`
- `model2_profit_classification_BEST.pkl`
- `model2_label_encoders.pkl`
- `model3_storage_duration_BEST.pkl`
- `model3_label_encoders.pkl`

### Step 2: Start ML API Service
```bash
cd wms-analytics
python ml_api_service.py
```

The service will start on `http://localhost:8050`

### Step 3: Start Backend Server
```bash
cd server
npm start
```

### Step 4: Start Frontend
```bash
cd client
npm start
```

## Usage

### Access Predictions Tab
1. Login as **Owner**
2. Navigate to **Owner Dashboard**
3. Click on **Predictions** tab (8th tab)

### View Alerts
1. Go to **Alerts Center** tab (10th tab)
2. See **ML Predictions** summary card
3. View predictive and market alerts section

### Features in Predictions Tab

#### Statistics Cards
- **Active Storage Customers**: Total customers with active storage
- **Profitable Customers**: Count and percentage of profitable customers
- **At-Risk Customers**: Customers likely to incur losses

#### Market Trends & Alerts
- Real-time market price movements
- Grain-specific trend analysis
- Recommendations based on market conditions

#### Customer Predictions Table
- Predicted sale price for each customer
- Expected profit/loss
- Storage duration analysis
- Risk status indicators
- Detailed view for each customer

## API Endpoints

### ML Service (Port 8050)

#### Health Check
```http
GET /health
```

#### Price Prediction
```http
POST /api/predict/price
Content-Type: application/json

{
  "grain_type": "wheat",
  "total_bags": 100,
  "total_weight_kg": 5000,
  "storage_duration_days": 90,
  "monthly_rent_per_bag": 50,
  "total_rent_paid": 15000,
  "activity_status": "active",
  "sold_status": "not_sold"
}
```

#### Profit/Loss Prediction
```http
POST /api/predict/profit
Content-Type: application/json

{
  "grain_type": "rice",
  "total_bags": 150,
  "total_weight_kg": 7500,
  "storage_duration_days": 120,
  "monthly_rent_per_bag": 55,
  "total_rent_paid": 24000,
  "activity_status": "active"
}
```

#### Storage Duration Prediction
```http
POST /api/predict/duration
Content-Type: application/json

{
  "grain_type": "maize",
  "total_bags": 80,
  "total_weight_kg": 4000,
  "monthly_rent_per_bag": 45,
  "activity_status": "active"
}
```

### Backend Service (Port 5000)

#### Dashboard Predictions
```http
GET /api/predictions/dashboard-predictions
Headers: x-auth-token: <owner_token>
```

#### Market Alerts
```http
GET /api/predictions/market-alerts
Headers: x-auth-token: <owner_token>
```

## Alert Types

### Predictive Alerts
1. **Potential Loss Alert** (High Severity)
   - Triggered when customer is predicted to incur losses > ₹5000
   - Shows estimated loss amount
   - Suggests corrective actions

2. **Long Storage Duration** (Medium Severity)
   - Triggered when storage > 180 days
   - Recommends evaluation for sale

3. **Price Decline Warning** (High Severity)
   - Market price dropping for stored grain type
   - Suggests immediate sale consideration

### Market Alerts
1. **Price Trends**
   - Grain-specific price movements
   - Percentage change indicators
   - Buy/sell recommendations

2. **Demand Shifts**
   - Market demand analysis
   - Optimal timing suggestions

## Fallback Mechanism

If ML service is unavailable, the system provides:
- Simple rule-based predictions
- Historical average calculations
- Basic profit/loss estimations
- User notifications about reduced accuracy

## Troubleshooting

### ML Service Not Starting
```bash
# Check if models are present
ls wms-analytics/*.pkl

# Verify Python dependencies
pip install -r requirements.txt

# Check port availability
netstat -an | findstr :8050
```

### Predictions Not Showing
1. Ensure ML service is running on port 8050
2. Check browser console for errors
3. Verify backend route `/api/predictions/` is accessible
4. Check that customers have active storage allocations

### Model Errors
- Retrain models if data structure changed
- Verify feature names match exactly
- Check data types (all numeric features must be float)

## Performance Notes

- Predictions are cached for 5 minutes
- Auto-refresh every 5 minutes in Predictions tab
- Batch prediction capability for multiple customers
- Optimized for <100ms response time per prediction

## Future Enhancements

1. **Real-time Market Data Integration**
   - Live grain price APIs
   - Commodity exchange integration

2. **Advanced Analytics**
   - Seasonal trend analysis
   - Multi-grain portfolio optimization
   - Risk scoring models

3. **Automated Notifications**
   - SMS/Email alerts for high-risk predictions
   - Daily digest for owner
   - Customer-specific recommendations

4. **Model Improvements**
   - Deep learning models
   - Time-series forecasting
   - Ensemble methods

## Security Considerations

- ML service runs on localhost only
- Authentication required for all backend endpoints
- Owner role required for prediction access
- Rate limiting on prediction endpoints

## Support

For issues or questions:
1. Check logs: `wms-analytics/ml_api_service.log`
2. Review browser console
3. Verify all services are running
4. Ensure data format matches model requirements

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Author**: WMS Analytics Team
