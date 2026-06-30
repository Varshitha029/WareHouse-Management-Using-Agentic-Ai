import os
from dotenv import load_dotenv

load_dotenv()

# Gemini Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')

# MongoDB Configuration
MONGODB_URL = os.getenv('MONGODB_URL', 'mongodb://localhost:27017')
MONGODB_DB_NAME = os.getenv('MONGODB_DB_NAME', 'wms_ai_engine')
WMS_DB_NAME = os.getenv('WMS_DB_NAME', 'test')

# Server Configuration
AI_ENGINE_PORT = int(os.getenv('AI_ENGINE_PORT', 8001))
ML_API_URL = os.getenv('ML_API_URL', 'http://localhost:8050')

# Agent Configuration
MAX_RESPONSE_LENGTH = 2000
TEMPERATURE = 0.7
TEMPERATURE_CREATIVE = 0.9
TEMPERATURE_ANALYTICAL = 0.3
