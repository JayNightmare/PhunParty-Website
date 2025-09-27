## PhunParty AI Agent Instructions

Concise, project-specific guidance for coding agents working on this repository. Focus on concrete existing patterns—avoid inventing new architecture without user request.

### 1. Big Picture

-   Monorepo style: React/Vite/Tailwind frontend (TypeScript) at root `src/`; FastAPI backend under `backend/phunparty-backend/app`.
-   Frontend talks to backend exclusively via REST + optional WebSockets. REST abstraction is centralized in `src/lib/api.ts`; do NOT sprinkle `fetch` calls elsewhere—extend this module.
-   Real-time layer: WebSocket endpoint `/ws/session/{session_code}` (see `backend/.../websockets/routes.py`) for game state + player events. Frontend wraps it with hooks: low-level `useWebSocket.ts`, higher-level game domain hook `useGameWebSocket` (not shown here) and orchestration/fallback hook `useGameUpdates.ts` (adds HTTP polling when WS fails).
-   Authentication model: API key (`x-api-key` header, lowercase in frontend). Some endpoints (login) intentionally omit API key; preserve current behavior.

### 2. Dev & Build Workflow

-   Install deps: `npm i` (frontend) + `pip install -r backend/phunparty-backend/requirements.txt` (backend) if modifying server.
-   Frontend dev: `npm run dev` (Vite). Proxy rules: `/api/*` -> `VITE_API_URL` (default https://api.phun.party) and `/ws/*` -> WebSocket target (env `VITE_WS_URL` or `ws://localhost:8000`). Don’t hardcode API origins—use the existing `API_BASE_URL` logic.
-   Tests: `npm run test` (Vitest, JSDOM, setup at `src/setupTests.ts`). Add new tests under `src/__tests__` or colocated; keep imports via alias `@` (configured in `vite.config.ts`).
-   Type checking: `npm run typecheck`.
-   Production build: `npm run build` outputs `dist/` (static). Keep relative asset paths.

### 3. Environment Variables (Frontend)

Defined at build time:

-   `VITE_API_URL` (REST base; dev proxy uses `/api` instead).
-   `VITE_API_KEY` (optional locally, required for protected routes—code gracefully handles missing key in diagnostics).
-   `VITE_WS_URL` (for proxy target; fallback defaults in code). When adding new runtime config, extend documentation (`README.md`) and keep `import.meta.env` guarded.

### 4. REST API Integration Pattern

-   All outbound requests flow through `apiFetch` in `src/lib/api.ts` (adds API key + JSON handling, detailed logging). Extend by:
    1. Defining backend response interfaces (raw + mapped) if shape differs from domain types.
    2. Adding mapper functions (see `mapQuestion`, `mapGameStatus`).
    3. Exporting a typed function that wraps `apiFetch` and returns _mapped_ types.
-   Error handling: thrown `Error` with parsed text snippet. Preserve JSON validation (content-type guard + parse). Don’t silently swallow parse issues.
-   Maintain header casing: frontend uses `x-api-key` (backend expects case-insensitive; docs highlight canonical `X-API-Key`). Avoid duplicate header names.

### 5. WebSocket Usage Pattern

-   URL constructed via `getWebSocketUrl(sessionCode, params)`; query params include `client_type` and for mobile: `player_id`, optional `player_name`, `player_photo`.
-   Connection lifecycle & reconnection handled inside hooks. When adding message types:
    1. Add to `WebSocketMessageType` union in `useWebSocket.ts`.
    2. Handle side-effects in higher-level hook (`useGameWebSocket` / `useGameUpdates.ts`) translating raw messages into domain state.
    3. Server: add logic in `backend/.../websockets/routes.py` or appropriate handler & broadcast via `manager.broadcast_to_session` or filtered broadcast helpers.
-   Fallback: If WS not connected or disabled, `useGameUpdates` starts polling `getSessionStatus` every 3s. Preserve this resilience; never block UI solely on WS success.

### 6. Backend Structure (FastAPI)

-   Entry: `app/main.py` registering routers (`game`, `players`, `scores`, `questions`, `game_logic`, `auth`, `password-reset`, `photos`, `websockets`).
-   Real-time layer: `app/websockets/manager.py` (connection registry, broadcast helpers); `routes.py` (WebSocket endpoint & message dispatch). New server push events should use consistent `type` fields matching frontend union.
-   Database CRUD accessed via functions in `app/database/dbCRUD.py` (not fully shown). When needing new query results for WS initial payload, extend DB layer then include inside `send_initial_session_state`.
-   Avoid adding API key requirement to WebSocket handshake (cannot send headers). Use query params only if absolutely necessary; current implementation trusts session + optional player validation.

### 7. Domain State & Types

-   Game status normalization happens in `mapGameStatus` producing `GameStatusResponse` consumed by hooks/components. Add any new backend fields by first extending raw interface (`BackendGameStatus`), then mapper, then UI types.
-   Player/session persistence for host: localStorage key `user_sessions`. Reuse helper `addUserSession` instead of writing directly to localStorage.

### 8. UI / Components Conventions

-   Components live in `src/components`; pages in `src/pages`; hooks in `src/hooks`; shared logic & API in `src/lib`; contexts in `src/contexts`.
-   Use absolute imports with alias `@` (e.g. `import useGameUpdates from '@/hooks/useGameUpdates';`). Keep path hygiene; do not introduce relative `../../` where alias fits.
-   State derived from hooks; avoid duplicating API calls inside components if hook already supplies data (e.g., reuse `useGameUpdates` for session status + players list).

### 9. Adding New Features (Example Flow)

Example: Add “pause game” WebSocket command.

1. Backend: implement handler branch in `handle_websocket_message` for `pause_game`; broadcast `{ type: 'game_paused', data: {...}}`.
2. Frontend: extend `WebSocketMessageType` with `'game_paused'` & hook logic to update `gameState`.
3. Optionally add REST fallback endpoint; if so, add typed function in `api.ts` (mapper if needed) and call inside fallback path when WS unavailable.
4. Write a Vitest test validating mapper or hook side-effect (mock message dispatch).

### 10. Testing Patterns

-   Unit tests live in `src/__tests__`. Use Vitest + Testing Library for React; prefer testing observable UI / hook outcomes over implementation details.
-   For API utilities: mock `global.fetch` and assert mapper outputs and error branches.
-   Keep snapshots minimal; prefer explicit assertions on key fields (e.g., `game_state`, `current_question_index`).

### 11. Common Pitfalls to Avoid

-   Do not bypass `apiFetch` (loses logging & consistent error shaping).
-   Don’t add blocking awaits inside WebSocket `onmessage`—delegate heavy logic outside event loop if needed.
-   Avoid storing secrets or API keys in committed code; rely on `import.meta.env`.
-   When adding new environment vars, prefix with `VITE_` and document in `README.md` and this file if core.

### 12. Quick Reference

-   REST base: `API_BASE_URL` (dev proxy `/api`).
-   WebSocket: `getWebSocketUrl(sessionCode)`; message shape `{ type, data?, timestamp? }`.
-   Poll fallback interval: 3000ms (adjust carefully; keep ≥2000ms to reduce load).
-   Broadcast helpers backend: `broadcast_to_session`, `broadcast_to_mobile_players`, `broadcast_to_web_clients`.

### 13. When Unsure

Prefer reading mapper + hook patterns before implementing similar logic. Replicate existing naming (camelCase functions, PascalCase interfaces). Ask user before introducing new frameworks, state managers, or architectural shifts.

---

Provide feedback if additional backend modules, game logic handlers, or deployment nuances should be documented.
