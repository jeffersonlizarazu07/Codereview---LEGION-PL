# ⬡ Code Review Agent

Agente de code review construido con LangGraph + FastAPI + React.

## Stack
- **Backend**: Python, FastAPI, LangGraph
- **LLM**: Google Gemini Flash 2.0 via OpenRouter
- **Frontend**: React + TypeScript + Vite

## Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Agrega tus keys en .env
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Variables de entorno
```
OPENROUTER_API_KEY=sk-or-...
GITHUB_TOKEN=ghp_...
GITHUB_REPO=juanhenaoparra/minidyn
```

## Uso
1. Abre http://localhost:3000
2. Selecciona una rama en el sidebar
3. Escribe una pregunta o solicita un code review completo