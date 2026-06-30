# Warehouse Management System — AI Architecture Documentation

---

## 1. How Agents Are Communicated

The system follows a **Master–Agent Coordinator Pattern**. A central `MasterAgent` coordinates all communication between the application and 7 specialized AI agents.

### Communication Flow

```
User Request → FastAPI Endpoint → MasterAgent.route(agent_name, data) → SpecificAgent.process(data) → Response
```

### How It Works

1. **MasterAgent** (file: `ai-engine/coordinator/master_agent.py`) instantiates all 7 agents in its constructor and stores them in a dictionary:

   ```python
   self.agents = {
       'chat': ChatAgent(),
       'inventory': InventoryAgent(),
       'weighbridge': WeighbridgeAgent(),
       'duration': DurationAgent(),
       'loan_risk': LoanRiskAgent(),
       'pricing': PricingAgent(),
       'anomaly': AnomalyAgent()
   }
   ```

2. **Direct Routing** — `route(agent_name, data)`: The FastAPI endpoints determine which agent to call (e.g., `/chat` → `'chat'`, `/market/predict` → `'pricing'`). The master agent looks up the agent by key and calls its `process(data)` method.

3. **Auto Routing** — `auto_route(message, context)`: For ambiguous queries, the master sends the user's message to Google Gemini with a prompt listing all agent names and descriptions. Gemini returns the best agent name, then `route()` is called. If the LLM picks an invalid agent, it falls back to `ChatAgent`.

4. **Standardized Response Format** — Every agent extends `BaseAgent` (file: `ai-engine/agents/base_agent.py`), which provides `format_response()`:

   ```python
   {
       "agent": "ChatAgent",     # Which agent handled this
       "success": True/False,
       "data": { ... },          # Agent-specific result
       "message": "description"
   }
   ```

5. **Agent Processing Pattern** — All agents follow the same internal workflow:
   - Receive a `data` dict with action and parameters
   - Query MongoDB in real-time via `DBConnector` (e.g., fetch users, transactions, warehouse layouts)
   - Construct a detailed prompt that embeds the live database data as JSON context
   - Call `GeminiClient.generate_text()` or `GeminiClient.generate_json()` to get the AI response
   - Return the result via `self.format_response()`

Agents do **not** communicate with each other directly. All inter-agent coordination goes through the MasterAgent.

---

## 2. How We Implemented Language Translation

### Architecture

The translation system uses a **client-side LanguageProvider** with a **server-side Google Translate proxy**.

### Implementation Details

**Frontend — `client/src/i18n/LanguageContext.js`:**

- Contains **400+ default English translations** as a nested object, flattened to dot-notation keys (e.g., `dashboard.totalCustomers`, `market.livePrices`).
- `LanguageProvider` wraps the entire app and provides:
  - `t(key)` — looks up a translated string by dot-notation key
  - `translateText(text)` — dynamically translates any arbitrary text
  - `changeLanguage(lang)` — switches language and triggers batch translation
- On language change, **all 400+ English values are batch-translated** via `POST /api/translate` and cached in memory (`translationCache`).
- Language preference is persisted to `localStorage` and also synced to the server via `PUT /api/users/update-language`.

**Language Selection UI — `client/src/App.js` → `LanguageGate`:**

- A `LanguageGate` component wraps the entire app inside `LanguageProvider`.
- On every browser refresh, a language selection dialog appears (6 languages: English, Telugu, Hindi, Tamil, Kannada, Urdu).
- The app only renders after the user picks a language.

**Backend — `server/routes/translate.js`:**

- Uses the **free Google Translate API endpoint**: `https://translate.googleapis.com/translate_a/single?client=gtx`
- `POST /api/translate` — accepts `{ texts: string[], targetLanguage: string }`, batch-translates in groups of 20.
- `POST /api/translate/single` — translates a single text.
- English passthrough: returns original texts when `targetLanguage === 'en'`.
- No API key required — uses the free `gtx` client endpoint.

### Supported Languages

| Code | Language | Native Name |
|------|----------|-------------|
| `en` | English  | English     |
| `te` | Telugu   | తెలుగు       |
| `hi` | Hindi    | हिन्दी        |
| `ta` | Tamil    | தமிழ்        |
| `kn` | Kannada  | ಕನ್ನಡ        |
| `ur` | Urdu     | اردو         |

---

## 3. Did We Use RAG? If Yes, How and Where?

### Answer: No, We Did NOT Use RAG

The system does **not** use Retrieval Augmented Generation (RAG). There are:
- **No vector databases** (no Pinecone, ChromaDB, FAISS, etc.)
- **No embeddings** generated or stored
- **No document chunking** or similarity search
- **No semantic retrieval** pipeline

### What We Use Instead: Live Database Context Injection

Instead of RAG, we implemented a **"Real-Time Context Injection"** pattern:

1. Before every LLM call, the agent queries MongoDB directly via `DBConnector` to fetch live, structured data (users, transactions, warehouse layouts, loans, market prices, etc.).
2. This data is serialized to JSON and **injected directly into the prompt** as context.
3. The LLM (Gemini) is instructed to use this factual data to answer the user's question.

**Example from ChatAgent:**
```python
context = await self._build_context(role, user_id)
system_prompt = CHAT_AGENT_PROMPT + f"\n\nCurrent Context:\n{json.dumps(context, default=str)}"
```

This approach is simpler than RAG and well-suited for our use case because:
- Our data is **structured** (MongoDB documents, not unstructured text)
- We need **real-time accuracy** (latest inventory counts, live prices)
- The data volume per query is small enough to fit within Gemini's context window

---

## 4. Did We Use LLM? If Yes, How and Where?

### Answer: Yes — Google Gemini 2.0 Flash

We use Google's **Gemini 2.0 Flash** LLM as the core intelligence behind all 7 AI agents.

### LLM Configuration

| Setting | Value |
|---------|-------|
| **Primary Model** | `gemini-2.0-flash` |
| **Fallback Models** | `gemini-2.0-flash-lite` → `gemma-3-27b-it` → `gemma-3-4b-it` → `gemma-3-1b-it` |
| **SDK** | `google-genai` (new Google GenAI SDK) |
| **API Key** | Stored in `ai-engine/.env` |
| **Analytical Temperature** | 0.3 (for structured predictions, risk scoring) |
| **Creative Temperature** | 0.9 (for chat conversations, advisory) |
| **Max Output Tokens** | 2048 |

### How the LLM Is Used

**GeminiClient** (file: `ai-engine/tools/gemini_client.py`) provides three methods:

| Method | Use Case | Used By |
|--------|----------|---------|
| `generate_text(prompt, system_prompt)` | Free-form text responses | ChatAgent, WeighbridgeAgent |
| `generate_json(prompt, system_prompt)` | Structured JSON responses (predictions, scores, risk data) | InventoryAgent, DurationAgent, LoanRiskAgent, PricingAgent, AnomalyAgent |
| `chat(messages, system_prompt)` | Multi-turn conversation with history | ChatAgent |

### Fallback Model Chain

If the primary model (`gemini-2.0-flash`) returns a quota error (429) or is unavailable:

```
gemini-2.0-flash → gemini-2.0-flash-lite → gemma-3-27b-it → gemma-3-4b-it → gemma-3-1b-it
```

Each model is tried in sequence with retry logic. This ensures the system never goes completely offline even when API quotas are exhausted.

### Where the LLM Is Called

Every agent calls the LLM via GeminiClient for different purposes:

- **ChatAgent** → Natural language Q&A about warehouse data
- **InventoryAgent** → Slot allocation optimization, capacity predictions
- **WeighbridgeAgent** → Fraud detection in weight entries
- **DurationAgent** → Storage duration predictions, seasonal forecasting
- **LoanRiskAgent** → Credit risk scoring (0–100), approve/reject recommendations
- **PricingAgent** → Grain price predictions (1 week to 6 months), sell/hold advisory
- **AnomalyAgent** → Fraud pattern detection, suspicious transaction alerts
- **MasterAgent** → Auto-routing (determines which agent should handle a query)

---

## 5. What Are the Agents Available, Where They Are Placed, and What Work They Do

All agents are located in the `ai-engine/agents/` directory and coordinated by `ai-engine/coordinator/master_agent.py`.

### Agent Summary Table

| # | Agent | File | Actions | Purpose |
|---|-------|------|---------|---------|
| 1 | **ChatAgent** | `agents/chat_agent.py` | Chat | General-purpose AI assistant for warehouse Q&A. Builds rich context from all DB collections (analytics, warehouse layout, customers, vehicles, loans, transactions). Supports separate context for owners vs customers. |
| 2 | **InventoryAgent** | `agents/inventory_agent.py` | `analyze`, `optimize`, `predict_duration` | Warehouse space optimization. Analyzes current allocations, predicts slot overflow, recommends optimal grain placement, detects inefficient capacity usage. |
| 3 | **WeighbridgeAgent** | `agents/weighbridge_agent.py` | `analyze`, `detect_anomaly`, `optimize` | Fraud detection at the weighbridge. Detects abnormal weight entries, flags suspicious tare/gross patterns, identifies vehicle weight variance anomalies. |
| 4 | **DurationAgent** | `agents/duration_agent.py` | `predict`, `predict_duration`, `forecast`, `seasonal` | Storage duration prediction. Predicts how long grain will stay stored, suggests optimal vacate timing, seasonal demand forecasting, helps owners plan future capacity. |
| 5 | **LoanRiskAgent** | `agents/loan_risk_agent.py` | `assess`, `score`, `portfolio` | Loan risk assessment. Computes default risk probability (0–100), recommends Approve/Reduce/Reject, suggests interest rates, portfolio-level analysis. Considers payment history, grain value, market prices, past defaults. |
| 6 | **PricingAgent** | `agents/pricing_agent.py` | `predict`, `live`, `advise` | Market price intelligence. Predicts grain price movements (1 week to 6 months), advises Sell Now/Hold/Wait, fetches and caches live market prices, provides customer-specific selling recommendations. |
| 7 | **AnomalyAgent** | `agents/anomaly_agent.py` | `detect`, `alerts`, `investigate` | System-wide fraud detection. Detects duplicate/fake payments, suspicious vacate requests, weight–payment mismatches, unusual transaction patterns. Stores alerts in a dedicated `anomaly_alerts` collection. |

### Supporting Infrastructure

| Component | File | Role |
|-----------|------|------|
| **BaseAgent** | `agents/base_agent.py` | Abstract base class. Defines `process(data)` interface and `format_response()` utility. |
| **MasterAgent** | `coordinator/master_agent.py` | Coordinator. Routes requests to agents by name or via LLM auto-detection. |
| **GeminiClient** | `tools/gemini_client.py` | LLM interface. Handles all Gemini API calls with fallback model chain. |
| **DBConnector** | `tools/db_connector.py` | Database interface. 15+ async methods for querying MongoDB (users, vehicles, transactions, loans, warehouse layouts, market prices, etc.). |
| **System Prompts** | `config/prompts.py` | 8 carefully crafted prompts (1 master + 7 agents) with Indian agricultural context (₹ currency, MSP, Telangana/AP region). |
| **Settings** | `config/settings.py` | Central configuration: MongoDB URLs, API keys, model names, temperatures, ports. |

### Agent Architectural Diagram

```
                    ┌──────────────────────┐
                    │     FastAPI (api.py)  │
                    │      Port 8001        │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │     MasterAgent       │
                    │   (coordinator/)      │
                    └──────────┬───────────┘
                               │
          ┌────────┬───────┬───┴────┬────────┬────────┬────────┐
          ▼        ▼       ▼        ▼        ▼        ▼        ▼
       ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
       │ Chat ││Inven ││Weigh ││Dura  ││Loan  ││Prici ││Anoma │
       │Agent ││tory  ││bridge││tion  ││Risk  ││ng    ││ly    │
       └──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘└──┬───┘
          │       │       │       │       │       │       │
          ▼       ▼       ▼       ▼       ▼       ▼       ▼
    ┌─────────────────────────────────────────────────────────┐
    │              GeminiClient + DBConnector                  │
    │         (tools/gemini_client.py, db_connector.py)       │
    └─────────────┬───────────────────────────┬───────────────┘
                  │                           │
                  ▼                           ▼
         ┌────────────────┐          ┌────────────────┐
         │  Google Gemini  │          │    MongoDB      │
         │  (LLM API)     │          │  (Atlas Cloud)  │
         └────────────────┘          └────────────────┘
```

---

## 6. How Frontend, Backend, and AI Engine Are Connected

### Three-Tier Architecture

```
┌─────────────────┐     HTTP/REST      ┌──────────────────┐     HTTP/REST     ┌──────────────────┐
│   React Client  │  ──────────────►   │  Express Server   │  ─────────────►  │  FastAPI AI Engine│
│   (Port 3001)   │  ◄──────────────   │  (Port 5000)      │  ◄─────────────  │  (Port 8001)     │
└─────────────────┘                    └──────────────────┘                   └──────────────────┘
        │                                      │                                      │
        │                                      │                                      │
   React/MUI                             Mongoose ORM                          Motor (async)
   Axios HTTP                            Socket.IO                             google-genai SDK
   React Router                          JWT Auth                              Pydantic models
                                               │                                      │
                                               ▼                                      ▼
                                      ┌──────────────────┐              ┌──────────────────────┐
                                      │   MongoDB Atlas   │              │   Google Gemini API   │
                                      │   (Cloud DB)      │              │   (LLM Service)      │
                                      └──────────────────┘              └──────────────────────┘
```

### Connection Details

#### Frontend → Backend (React → Express)

- **Protocol**: HTTP REST via `axios`
- **Proxy**: React's `package.json` has `"proxy": "http://localhost:5000"` — all `/api/*` requests from the React dev server are forwarded to Express.
- **Authentication**: JWT tokens stored in `localStorage`, sent via `x-auth-token` header. Express middleware (`server/middleware/auth.js`) validates the token and attaches `req.user` (with `id` and `role`).
- **Real-time**: Socket.IO connection for live notifications (loan approvals, alerts).

#### Backend → AI Engine (Express → FastAPI)

- **Protocol**: HTTP REST via `axios` (server-side)
- **Proxy function**: `proxyToAI()` in `server/routes/ai-predictions.js`:
  ```javascript
  const proxyToAI = async (endpoint, method = 'POST', data = null) => {
      const url = `${AI_ENGINE_URL}${endpoint}`;  // http://localhost:8001/...
      const response = await axios({ method, url, data, timeout: 30000 });
      return response.data;
  };
  ```
- **Authentication**: Express validates the JWT first, then forwards the request to FastAPI (which trusts the Express proxy and doesn't re-validate).
- **User Injection**: For the `/chat` endpoint, Express injects `req.user.id` and `req.user.role` into the request body before forwarding.

#### AI Engine → External Services

- **Google Gemini API**: via `google-genai` SDK for all LLM calls
- **MongoDB Atlas**: via `Motor` (async driver) for real-time data queries — reads the **same database** as Express (`test` database) plus its own cache database (`wms_ai_engine`)
- **Google Translate API**: used by the Express server (not the AI engine) for language translation

### Request Flow Example — AI Chat

```
1. User types "How many customers do we have?" in the chat widget

2. React (AIChat.js)
   → POST /api/ai/chat { message, role, userId, history }

3. Express (ai-predictions.js)
   → Validates JWT token (auth middleware)
   → Injects req.user.id and req.user.role
   → proxyToAI('/chat', 'POST', body)
   → axios.post('http://localhost:8001/chat', body)

4. FastAPI (api.py)
   → Receives ChatRequest
   → master.route('chat', data)
   → ChatAgent.process(data)

5. ChatAgent (chat_agent.py)
   → _build_context(role, userId)
   → DBConnector.get_analytics_summary()  → { total_customers: 2, ... }
   → DBConnector.get_warehouse_summary()  → { warehouses: [...], ... }
   → DBConnector.get_users(role='customer') → [customer1, customer2]
   → ... (more DB queries)
   → Builds system_prompt + context JSON
   → GeminiClient.chat(messages, system_prompt)

6. GeminiClient (gemini_client.py)
   → Tries gemini-2.0-flash first
   → On quota error, falls back to gemma-3-27b-it
   → Returns text response

7. Response flows back:
   ChatAgent → format_response({reply: "You have 2 customers..."})
   → FastAPI → Express → React → Displayed in chat widget
```

### Endpoint Mapping Table

| Frontend Call | Express Route | AI Engine Endpoint | Agent |
|---|---|---|---|
| `POST /api/ai/chat` | `ai-predictions.js` | `POST /chat` | ChatAgent |
| `POST /api/ai/inventory/analyze` | `ai-predictions.js` | `POST /inventory/analyze` | InventoryAgent |
| `POST /api/ai/weighbridge/analyze` | `ai-predictions.js` | `POST /weighbridge/analyze` | WeighbridgeAgent |
| `POST /api/ai/loan-risk/assess` | `ai-predictions.js` | `POST /loan-risk/assess` | LoanRiskAgent |
| `POST /api/ai/market/predict` | `ai-predictions.js` | `POST /market/predict` | PricingAgent |
| `POST /api/ai/demand/predict` | `ai-predictions.js` | `POST /demand/predict` | DurationAgent |
| `POST /api/ai/anomaly/detect` | `ai-predictions.js` | `POST /anomaly/detect` | AnomalyAgent |
| `GET /api/ai/anomaly/alerts` | `ai-predictions.js` | `GET /anomaly/alerts` | AnomalyAgent |
| `POST /api/ai/predict-duration` | `ai-predictions.js` | `POST /predict-duration` | DurationAgent |
| `GET /api/ai/health` | `ai-predictions.js` | `GET /health` | MasterAgent |

### Technology Stack Summary

| Layer | Technology | Port | Key Libraries |
|-------|------------|------|---------------|
| **Frontend** | React 19 | 3001 (dev) | Material-UI v7, React Router v7, Axios, Socket.IO Client, Recharts |
| **Backend** | Node.js + Express | 5000 | Mongoose, JWT, Socket.IO, Multer, Helmet, CORS, Rate Limiter |
| **AI Engine** | Python + FastAPI | 8001 | google-genai, Motor, Pydantic, Uvicorn |
| **Database** | MongoDB Atlas | Cloud | Shared between Express (Mongoose) and AI Engine (Motor) |
| **LLM** | Google Gemini 2.0 Flash | Cloud API | Fallback: gemma-3-27b-it, gemma-3-4b-it, gemma-3-1b-it |
| **Translation** | Google Translate API | Free endpoint | Used via Express proxy, no API key needed |

---

*Document generated for the WMS (Warehouse Management System) project.*
