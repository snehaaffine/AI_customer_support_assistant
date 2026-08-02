# AI Customer Support Assistant

An AI-powered customer support chatbot for e-commerce and retail, built with React 19, Express, PostgreSQL (pgvector), and the Claude API.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript 5, Vite, Tailwind CSS 4 |
| Backend | Node.js, Express, Prisma, PostgreSQL + pgvector |
| AI | Anthropic Claude API (Haiku-tier) |
| Email | Resend |

## Prerequisites

- Node.js 20+ (24 recommended)
- Docker & Docker Compose (for PostgreSQL)
- Anthropic API key
- Resend API key (needed from Phase 6 onward)

## Quick Start

### 1. Start the database

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
npm run install:all
npm install   # root (concurrently for dev script)
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your API keys when ready:

- `ANTHROPIC_API_KEY` — required from Phase 5
- `RESEND_API_KEY` — required from Phase 6

### 4. Run development servers

```bash
npm run dev
```

### Database setup (after Docker is running)

```bash
npm run db:migrate   # apply migrations
npm run db:seed      # seed admin, categories, mock data
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Health check: http://localhost:3001/api/health

### API endpoints (Phase 3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/categories` | List chat categories |
| `POST` | `/api/sessions` | Create or resume a session |
| `GET` | `/api/sessions/:id` | Get session details |
| `PATCH` | `/api/sessions/:id/category` | Set session category |
| `GET` | `/api/chat/:id/messages` | Paginated message history |
| `POST` | `/api/chat/:id/messages` | Send message (SSE stream) |

## Project Structure

```
├── backend/          # Express API server
│   ├── prisma/       # Database schema & migrations
│   └── src/          # Application source
├── frontend/         # React chat UI
├── docker-compose.yml
└── Customer Support Assistant PRD.md
```

## Development Phases

This project is built incrementally. Each phase is a separate commit/PR:

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Project scaffolding | ✅ Complete |
| 2 | Database schema & Prisma | ✅ Complete |
| 3 | Backend core APIs | ✅ Complete |
| 4 | Frontend chat UI | ✅ Complete |
| 5 | Claude integration & semantic cache | Pending |
| 6 | Escalation flow & Resend email | Pending |
| 7 | Order lookup & inventory integration | Pending |
| 8 | Admin interface | Pending |

## License

Internal project — not for public distribution.
