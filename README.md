# ⬡ Code Review Agent

Agente de code review construido con LangGraph + FastAPI + React que analiza ramas de GitHub, responde preguntas sobre el código y genera revisiones estructuradas.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Agente | LangGraph (Python) |
| Backend | FastAPI + uvicorn |
| LLM | Google Gemini Flash 2.0 via OpenRouter |
| Frontend | React + TypeScript + Vite |
| GitHub | REST API v3 |

---

## Arquitectura
```
Mensaje del usuario
        │
        ▼
    [router]  ← Clasifica: "qa" o "review"
        │
   ┌────┴────┐
   ▼         ▼
[fetch]   [fetch]   ← Obtiene diff de GitHub
   │         │
   ▼         ▼
[qa_node] [review_node]  ← LLM genera respuesta
   │         │
   └────┬────┘
        ▼
       END
```

### Nodos del grafo

| Nodo | Responsabilidad |
|------|----------------|
| `router` | Clasifica el intent del usuario (Q&A vs review) |
| `fetch_diff_qa/review` | Obtiene diff y contenido de archivos via GitHub API |
| `qa_node` | Responde preguntas sobre el código con contexto completo |
| `review_node` | Genera hallazgos estructurados con severidad y sugerencias |

---

## Requisitos

- Python 3.11+
- Node.js 18+
- Cuenta en [OpenRouter](https://openrouter.ai) con API key
- [GitHub Personal Access Token](https://github.com/settings/tokens) (scope: `public_repo`)

---

## Instalación y uso

### 1. Clonar el repositorio
```bash
git clone https://github.com/jeffersonlizarazu07/Codereview---LEGION-PL.git
cd Codereview---LEGION-PL
```

### 2. Configurar el backend
```bash
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno (Mac/Linux)
source venv/bin/activate

# Activar entorno (Windows)
venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus keys
```

### 3. Variables de entorno

Edita `backend/.env`:
```
OPENROUTER_API_KEY=sk-or-...
GITHUB_TOKEN=ghp_...
GITHUB_REPO=juanhenaoparra/minidyn
```

### 4. Levantar el backend
```bash
# Desde backend/ con el venv activo
uvicorn main:app --reload --port 8000
```

Verificar en: `http://localhost:8000/health`
Documentación automática: `http://localhost:8000/docs`

### 5. Configurar y levantar el frontend
```bash
# En una nueva terminal, desde la raíz
cd frontend
npm install
npm run dev
```

Abrir en: `http://localhost:3000`

---

## Uso de la aplicación

### Seleccionar rama
Usa el selector en el sidebar para elegir una de las tres ramas disponibles:

| Rama | PR |
|------|----|
| `feat/partiql-support` | PR #1 - Soporte PartiQL |
| `feat/support-streaming` | PR #2 - DynamoDB Streams |
| `feat/support-batch-read-ops` | PR #3 - Batch read ops |

### Modo Q&A
Escribe cualquier pregunta sobre los cambios:
```
¿Dónde está definido el método TranslateSelectToQuery?
¿Qué funciones tienen alta complejidad ciclomática?
¿La implementación de streaming es escalable?
Explica la relación entre Lexer y Parser
```

### Modo Code Review
Solicita una revisión completa:
```
Realiza un code review completo de esta rama
```

El agente detecta automáticamente el modo según tu mensaje.

### Formato de hallazgos

Cada hallazgo del code review incluye:
```
SEVERITY:      CRITICAL | HIGH | MEDIUM | LOW | INFO
CATEGORY:      Security | Bug | Performance | Style | Architecture | Testing
FILE:          ruta/del/archivo.go
LINES:         45-67
ISSUE:         Descripción del problema
JUSTIFICATION: Por qué es un problema técnico
SUGGESTION:    Cómo arreglarlo
PATCH:         Ejemplo de código con el fix
```

---

## Estructura del proyecto
```
├── backend/
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── github_tools.py   # Integración con GitHub API
│   │   ├── graph.py          # Construcción del grafo LangGraph
│   │   ├── nodes.py          # Nodos del agente (router, qa, review)
│   │   └── state.py          # Estado compartido del grafo
│   ├── main.py               # FastAPI app + endpoints
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/       # Sidebar, MessageBubble, Spinner
│   │   ├── hooks/            # useChat (lógica de streaming)
│   │   ├── types.ts          # Interfaces TypeScript
│   │   ├── constants.ts      # Prompts y labels
│   │   └── App.tsx           # Componente principal
│   └── package.json
├── DECISIONS.md              # Decisiones técnicas
└── README.md
```

---

## Decisiones técnicas

Ver [DECISIONS.md](./DECISIONS.md) para la justificación de la arquitectura, trade-offs considerados y problemas encontrados durante el desarrollo.