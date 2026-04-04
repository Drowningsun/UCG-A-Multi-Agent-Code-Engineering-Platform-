<p align="center">
  <img src="docs/banner.png" alt="UCG Banner" width="100%" />
</p>

<h1 align="center">⚡ UCG — Multi-Agent Code Engineering Platform</h1>

<p align="center">
  <em>Transform natural language into production-ready code — generated, validated, tested, and secured by 5 autonomous AI agents in real time.</em>
</p>

<p align="center">
  <a href="https://ucg-a-multi-agent-code-engineering.vercel.app"><img src="https://img.shields.io/badge/🌐_Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel" alt="Live Demo" /></a>
  <a href="https://ucg-api-0jfv.onrender.com/api/health"><img src="https://img.shields.io/badge/🔗_API-Render-46E3B7?style=for-the-badge&logo=render" alt="API Status" /></a>
  <img src="https://img.shields.io/badge/Python-3.11-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/AI_Model-LLaMA_3.3_70B-FF6F00?style=flat-square" alt="AI Model" />
  <img src="https://img.shields.io/badge/Agents-5_Specialized-8B5CF6?style=flat-square" alt="Agents" />
  <img src="https://img.shields.io/badge/API_Keys-25_Pool-10B981?style=flat-square" alt="API Keys" />
  <img src="https://img.shields.io/badge/Streaming-SSE-EF4444?style=flat-square" alt="Streaming" />
</p>

---

## 🎯 What is UCG?

UCG is not just another AI code generator. It's a **full-stack, production-deployed platform** where **5 specialized AI agents** work as a team to deliver code that's not only functional — but **validated, tested, and security-hardened** before it ever reaches you.

```
You type:  "Build a React todo app with dark mode and local storage"

UCG does:  🧠 Plans → ⚡ Generates → ✅ Validates → 🧪 Tests → 🛡️ Secures

You get:   15 production-ready files, setup guide, and a downloadable ZIP
           — all streamed to your screen in real time.
```

### ✨ Key Highlights

- 🏗️ **Multi-File Projects** — Generates complete project structures (React, Python, Node.js, etc.)
- 🔄 **Real-Time Streaming** — Watch your code being written, fixed, and secured live via SSE
- 🤖 **5 AI Agents** — Each with a specialized role in the code quality pipeline
- 🎨 **Generative UI** — Agents dynamically render rich UI components (fix cards, diffs, stats)
- 🔐 **Google OAuth** — Secure authentication with session persistence
- 📦 **One-Click Download** — Download entire projects as ZIP files
- 🌙 **Dark/Light Themes** — Premium UI with 3D animations and glassmorphism

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                        │
│  React 18 • React Router v6 • Framer Motion • Canvas Animations │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ Landing  │  │  Login   │  │Dashboard │  │  GenUI Chat V2   ││
│  │  Page    │  │  Page    │  │  Page    │  │  (Main Interface)││
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘│
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS + SSE Stream
┌───────────────────────────▼─────────────────────────────────────┐
│                      BACKEND API (Render)                        │
│  FastAPI • Gunicorn + Uvicorn • Pydantic v2 • JWT Auth           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    ORCHESTRATOR                              │ │
│  │  ┌────────┐  ┌──────────┐  ┌─────────┐  ┌────────┐  ┌───┐ │ │
│  │  │Planner │→ │Code Gen  │→ │Validator│→ │Testing │→ │Sec│ │ │
│  │  │  🧠    │  │  ⚡      │  │  ✅     │  │  🧪    │  │🛡️│ │ │
│  │  └────────┘  └──────────┘  └─────────┘  └────────┘  └───┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌──────────────┐  ┌──────────┐  ┌──────────────────────────┐   │
│  │ AG-UI Proto  │  │ Auth     │  │ Groq Key Pool (25 keys)  │   │
│  │ (Gen UI)     │  │ (OAuth)  │  │ Thread-safe round-robin  │   │
│  └──────────────┘  └──────────┘  └──────────────────────────┘   │
└──────────┬──────────────────┬───────────────────────────────────┘
           │                  │
    ┌──────▼──────┐    ┌──────▼──────┐
    │  MongoDB    │    │  Groq API   │
    │  Atlas (M0) │    │  LLaMA 3.3  │
    │  3 Collections   │  70B Model  │
    └─────────────┘    └─────────────┘
```

---

## 🤖 The 5-Agent Pipeline

Each prompt passes through a **sequential pipeline** of specialized AI agents. Every agent can **read, analyze, and rewrite** the code before passing it to the next.

| # | Agent | Role | What It Does |
|---|-------|------|-------------|
| 1 | 🧠 **Planner** | Architect | Classifies prompt (single vs multi-file), expands it into a detailed architect's brief with tech stack, file structure, and design system specs |
| 2 | ⚡ **Code Generator** | Builder | Streams code in real-time via Groq API. Supports single-file snippets and multi-file projects with `<!-- path -->` markers |
| 3 | ✅ **Validator** | Quality Lead | Performs static analysis across Python/JS/HTML/CSS. Auto-fixes style issues, missing imports, and best-practice violations |
| 4 | 🧪 **Testing Agent** | QA Engineer | Checks for error handling, input validation, edge cases. Auto-adds try/catch blocks and null guards. Scores testability 0-100 |
| 5 | 🛡️ **Security Agent** | Security Analyst | Scans for XSS, injection, hardcoded secrets, eval(), insecure patterns. Auto-patches all vulnerabilities found |

### How Fix-Chaining Works

```
Code Generator output (v1)
    │
    ▼ Validator finds 3 issues → patches them → produces v2
    │
    ▼ Testing Agent finds 2 gaps → adds error handling → produces v3
    │
    ▼ Security Agent finds 1 vuln → patches it → produces v4 (final)
    │
    ▼ User receives v4 with a full diff of all changes
```

---

## 🛠️ Tech Stack

<table>
<tr>
<td>

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 | UI Framework |
| React Router v6 | Client Routing |
| Framer Motion | Animations |
| Axios | HTTP Client |
| Canvas API | 3D Particle Effects |
| CSS Custom Properties | Design System |

</td>
<td>

### Backend
| Technology | Purpose |
|-----------|---------|
| FastAPI | API Framework |
| Gunicorn + Uvicorn | ASGI Server |
| Motor (async) | MongoDB Driver |
| Pydantic v2 | Validation |
| python-jose | JWT Auth |
| SSE | Real-time Streaming |

</td>
</tr>
</table>

| Service | Provider | Tier |
|---------|----------|------|
| Backend Hosting | Render | Free |
| Frontend Hosting | Vercel | Free |
| Database | MongoDB Atlas | M0 Free |
| AI Model | Groq (LLaMA 3.3 70B) | Free |
| Keep-Alive | cron-job.org | Free |

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB (local or Atlas)
- Groq API key(s) from [console.groq.com](https://console.groq.com)

### 1. Clone & Setup Backend

```bash
git clone https://github.com/Drowningsun/UCG-A-Multi-Agent-Code-Engineering-Platform-.git
cd UCG-A-Multi-Agent-Code-Engineering-Platform-
```

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file in the root:

```env
# AI (comma-separate multiple keys for pooling)
GROQ_API_KEY=gsk_key1,gsk_key2,gsk_key3

# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
MONGODB_DATABASE=uber_code_generator

# Auth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SECRET_KEY=your-random-secret-key
JWT_SECRET_KEY=your-jwt-secret-key

# Server
PORT=5000
DEBUG=true
```

```bash
# Run the backend
python main.py
```

### 2. Setup Frontend

```bash
cd frontend

# Create .env
echo "REACT_APP_API_URL=http://localhost:5000" > .env

# Install & run
npm install
npm start
```

The app will be available at `http://localhost:3000`.

---

## 📡 API Reference

### Core Endpoints

```http
POST /api/generate/stream     # Primary — full streaming pipeline
POST /api/generate            # Non-streaming generation
POST /api/regenerate/stream   # Edit & regenerate (streaming)
POST /api/edit                # Edit existing code
```

### Session Management

```http
POST   /api/sessions                    # Create session
GET    /api/sessions                    # List user sessions
GET    /api/sessions/:id                # Get session + messages
DELETE /api/sessions/:id                # Delete session
POST   /api/sessions/:id/messages       # Add message
PATCH  /api/sessions/:id/title          # Update title
PATCH  /api/sessions/:id/project-name   # Save project name
POST   /api/sessions/bulk-delete        # Batch delete
POST   /api/sessions/cleanup-empty      # Remove empty sessions
```

### Monitoring

```http
GET /api/health              # Health check
GET /api/key-pool/status     # API key pool status
```

### Authentication

```http
POST /api/auth/google        # Google OAuth sign-in
GET  /api/auth/me            # Get current user
POST /api/auth/logout        # Logout
```

---

## 🔑 Key Features In-Depth

### 🔄 25-Key API Pool

The `GroqKeyPool` is a **thread-safe singleton** that manages 25 API keys with:
- **Round-robin rotation** — distributes load evenly
- **Rate-limit tracking** — blacklists keys for 60s on HTTP 429
- **Auto-recovery** — expired blacklists clear automatically
- **Graceful fallback** — if all keys are limited, uses the soonest-to-expire

### 🎨 AG-UI Protocol (Generative UI)

A custom protocol (724 lines) where backend agents **dynamically generate UI specifications** — not just data:

- `AgentStatusCard` — real-time agent progress with phase animations
- `FixCard` — before/after code diffs with severity badges
- `VulnerabilityCard` — security issue details with fix status
- `WorkflowTimeline` — horizontal pipeline progress tracker
- `StatCard` — key metrics (lines, fixes, duration)

### 📁 Multi-File Project Support

When you request a project (e.g., "Build a React dashboard"), the Planner:
1. Classifies the prompt as multi-file using 50+ keyword heuristics
2. Expands it into a 500-word architect's brief
3. Code Generator outputs files with `<!-- path/to/file.ext -->` markers
4. Frontend parses these into a tabbed code viewer with file tree
5. One-click ZIP download bundles the entire project

---

## 📂 Project Structure

```
UCG/
├── main.py                  # FastAPI app — 20+ endpoints, SSE streaming
├── orchestrator.py          # Agent pipeline coordinator
├── config.py                # Settings + GroqKeyPool (25-key manager)
├── database.py              # MongoDB async operations (Motor)
├── auth.py                  # Google OAuth + JWT authentication
├── agui_protocol.py         # AG-UI Protocol — Generative UI specs
├── Procfile                 # Render deployment config
├── requirements.txt         # Python dependencies (version ranges)
├── .python-version          # Python 3.11.11 (pinned for Render)
│
├── agents/
│   ├── base.py              # BaseAgent — API calls, retries, JSON parsing
│   ├── planner.py           # Prompt classification & enhancement
│   ├── code_generator.py    # Streaming code generation
│   ├── validator.py         # Code quality analysis & fixes
│   ├── testing.py           # Error handling & testability
│   └── security.py          # Vulnerability scanning & patching
│
├── frontend/
│   ├── src/
│   │   ├── App.js           # Routes + providers
│   │   ├── pages/
│   │   │   ├── LandingPage.js       # Marketing page (43KB)
│   │   │   ├── GenUIChatPageV2.js   # Main chat UI (78KB)
│   │   │   ├── DashboardPage.js     # Session dashboard
│   │   │   └── LoginPage.js         # Google OAuth login
│   │   ├── components/
│   │   │   ├── AGUIRenderer.js      # Dynamic AG-UI component renderer
│   │   │   ├── AgentPipeline.js     # Visual pipeline progress
│   │   │   ├── TabbedCodeBlock.js   # Multi-file code viewer
│   │   │   ├── FileTree.js          # Project file navigator
│   │   │   ├── GodParticleOrb.js    # 3D canvas animation
│   │   │   ├── Ballpit.js           # Particle physics effect
│   │   │   └── ... (30+ components)
│   │   ├── context/
│   │   │   └── AuthContext.js       # Auth state + guest limits
│   │   ├── utils/
│   │   │   └── parseCodeFiles.js    # Multi-file marker parser
│   │   └── agui/
│   │       └── client.js            # SSE stream consumer
│   └── package.json
│
└── docs/
    └── banner.png
```

---

## 🌐 Deployment

### Backend → Render

| Setting | Value |
|---------|-------|
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 120` |
| **Python Version** | 3.11.11 (via `.python-version`) |
| **Keep-Alive** | cron-job.org → `GET /api/health` every 2 min |

### Frontend → Vercel

| Setting | Value |
|---------|-------|
| **Framework** | Create React App |
| **Root Directory** | `frontend/` |
| **Build Command** | `npm run build` |
| **Env Variables** | `REACT_APP_API_URL`, `CI=false` |

---

## 🔐 Security

- **API keys** stored exclusively in environment variables — never in code or frontend
- **CORS** restricted to `ALLOWED_ORIGINS` in production
- **JWT tokens** (HS256) with 7-day expiry for session management
- **Google OAuth** verified server-side via Google's tokeninfo endpoint
- **Session ownership** enforced on every database operation
- **Pydantic validation** on all API request bodies
- **Generated code** is scanned by the Security Agent before delivery

---

## 📊 By the Numbers

| Metric | Value |
|--------|-------|
| Total Backend Code | ~120 KB across 8 Python files |
| Total Frontend Code | ~400+ KB across 40+ JS files |
| Total CSS | ~140+ KB across 12+ stylesheets |
| API Endpoints | 20+ REST endpoints |
| UI Components | 34 React components |
| AG-UI Component Types | 30+ dynamic types |
| SSE Event Types | 15+ streaming events |
| AI Agent Pipeline Steps | 8 sequential steps |
| API Key Pool Size | 25 keys with auto-rotation |

---

## 🗺️ Roadmap

- [ ] **Graph-based orchestrator** — Branching/iterative workflows with LangGraph
- [ ] **Documentation Agent** — Auto-generate README, JSDoc, docstrings
- [ ] **Framework Specialist Agents** — Dedicated React, Django, Express experts
- [ ] **Code Execution Sandbox** — Run generated code in-browser
- [ ] **Collaborative Sessions** — Multi-user shared generation sessions
- [ ] **Plugin System** — Custom agent pipelines per user

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built with ❤️ by <a href="https://github.com/Drowningsun">Drowningsun</a></strong>
</p>

<p align="center">
  <a href="https://ucg-a-multi-agent-code-engineering.vercel.app">🌐 Live Demo</a> •
  <a href="https://ucg-api-0jfv.onrender.com/api/health">🔗 API Health</a> •
  <a href="https://github.com/Drowningsun/UCG-A-Multi-Agent-Code-Engineering-Platform-/issues">🐛 Report Bug</a>
</p>