# 🎯 Enterprise AI Interview & Evaluation Platform

An end-to-end, enterprise-grade AI hiring platform designed for HR leaders and Engineering Managers. The application ingests company-specific Job Descriptions, Interview Guidelines, Curated Question Banks, and Technical Specs to conduct real-time, grounded technical interviews. It features **Human-in-the-Loop (HITL) manager steering** and calculates **mathematical per-question scorecards** with automated hiring recommendations.

---

## 🌟 Key Highlights & Architecture

┌────────────────────────────────────────────────────────┐
│             1. HR / Manager Knowledge Hub              │
│  Upload: Role Title + JD + Question Bank + Tech Specs  │
└──────────────────────────┬─────────────────────────────┘
│ Vectorized via ChromaDB / RAG
▼
┌────────────────────────────────────────────────────────┐
│             2. Live Interactive AI Interview           │
│  • Grounded probing based on uploaded question banks   │
│  • Gibberish & invalid token detection                 │
│  • Human-in-the-Loop (HITL) real-time probe injection  │
└──────────────────────────┬─────────────────────────────┘
│ Multi-turn Transcript Evaluation
▼
┌────────────────────────────────────────────────────────┐
│             3. Evidence-Based Scorecard Dashboard      │
│  • Per-question rubric grading (True mathematical avg) │
│  • Conditional UI: Balloons & Celebration (≥ 90%)      │
│  • Rejection alert & Red Flags breakdown (< 70%)       │
└────────────────────────────────────────────────────────┘

---

## ✨ Features

- **100% Dynamic Ingestion (No Hardcoded Questions)**: HR and managers can enter any role (e.g., *Full-Stack AI Engineer*, *IoT Embedded Firmware Engineer*, *Backend Architect*). Questions are pulled directly from the uploaded Question Bank.
- **RAG-Grounded Context**: The AI strictly references the provided technical documentation rather than hallucinating generic internet trivia.
- **Human-in-the-Loop (HITL) Manager Telemetry & Probe**: Allows hiring managers to silently observe the interview and inject custom edge-case questions mid-session without interrupting the candidate.
- **Strict Per-Question Mathematical Scoring**: Each response is evaluated individually. If a candidate answers 1 question well but inputs gibberish or dangerous anti-patterns for the rest, the score accurately reflects the failure (~33%, **No Hire**) rather than awarding a false pass.
- **Dynamic Conditional UI**:
  - **Selected ($\ge 90\%$)**: Triggers an animated celebration banner with floating balloons ($\text{🎈}$) and party poppers ($\text{🎉}$).
  - **Not Selected ($< 70\%$)**: Displays a clear rejection banner detailing observed anti-patterns and critical red flags.
- **Zero-API Local Fallback Engine**: Works seamlessly with Google Gemini 1.5 Flash, but includes an intelligent offline rule-engine so demonstrations never fail if API keys expire or rate limits hit.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic
- **AI & Vector Retrieval**: LangChain, ChromaDB, Google Gemini 1.5 Flash / Embeddings
- **Environment Management**: Python venv, Dotenv

---

## 📁 Repository Structure

```text
Enterprise-AI-Interview-Platform/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py          # FastAPI server, endpoints, and per-question scoring engine
│   │   ├── rag_service.py   # ChromaDB vector store and Gemini LLM interface
│   │   ├── prompts.py       # Strict system prompts for blueprinting & rubrics
│   │   └── schemas.py       # Pydantic data models
│   ├── requirements.txt     # Python backend dependencies
│   ├── .env.example         # Template for environment variables
│   └── .env                 # (Ignored) Secret API keys
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Complete single-page React application
│   │   ├── index.css        # Tailwind directives and celebration balloon keyframes
│   │   └── main.jsx         # React DOM entrypoint
│   ├── index.html           # HTML root template
│   ├── package.json         # Node dependencies
│   ├── tailwind.config.js   # Tailwind styling configurations
│   └── vite.config.js       # Vite build configurations
├── .gitignore               # Excludes venv, node_modules, and secrets
└── README.md                # Project documentation

🚀 Quickstart Guide
1. Clone the Repository
git clone [https://github.com/YOUR_USERNAME/Enterprise-AI-Interview-Platform.git](https://github.com/YOUR_USERNAME/Enterprise-AI-Interview-Platform.git)
cd Enterprise-AI-Interview-Platform

2. Backend Setup
Bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
pip install langchain-core langchain-text-splitters

# Configure API Key (Optional: system works in local fallback mode if blank)
cp .env.example .env
# Open .env and add your GOOGLE_API_KEY if desired

# Start FastAPI server
uvicorn app.main:app --reload --port 8000

Backend runs on: http://localhost:8000

Swagger API Docs available at: http://localhost:8000/docs

3. Frontend Setup
Open a second terminal window:

Bash
cd frontend

# Install packages
npm install

# Start Vite dev server
npm run dev

Frontend runs on: http://localhost:5173

🧪 Step-by-Step Testing & Evaluation Scenarios

Scenario A: Successful Candidate ($\ge 90\%$, Celebration & Selected)

1. Navigate to Tab 1: Knowledge Hub and fill in your target role (e.g., IoT & Embedded Firmware Engineer), job description, and 3 specific technical questions.
2. Click Ingest Documents & Start Interview.
3. In Tab 2: Live Interview, answer each question with deep architectural accuracy (e.g., non-blocking RTOS queues, 9-clock I2C bus recovery, decoupling capacitors).
4. Use the Manager Telemetry & Probe panel on the right to inject an edge-case question mid-interview.
5. Click Conclude & Score.
6. Result: The candidate receives Strong Hire (95/100), triggering floating balloons and the green "Congratulations! You Are Selected!" celebration banner.


Scenario B: Failed Candidate ($< 70\%$, Rejection & Red Flags)

1. In the interview room, enter dangerous anti-patterns (e.g., busy-wait delay loops, shared un-synchronized globals) or gibberish text (whiun djkfgauf...).
2. Notice the AI calls out the nonsensical input immediately.
3. Click Conclude & Score.
4. Result: The system computes the true mathematical score across questions, resulting in No Hire (~35/100), displaying a red "Application Status: Not Selected" alert, and detailing critical red flags.

🔒 Security & Best Practices

API Key Safety: .env is strictly excluded in .gitignore to prevent leaking cloud secrets.

Resilient Fallback: Designed to handle production rate limits, network timeouts, or expired trial keys without interrupting the user interface.