# AEGIS GRID — Платформа турниров по Dota 2 (MVP v1)

Полнофункциональная веб-платформа для организации турниров по Dota 2 с авторизацией через **Steam OpenID 2.0**, каталогом команд, интерактивными турнирными сетками на бесконечном холсте **React Flow (`@xyflow/react`)**, двухсторонним подтверждением результатов матчей, версионируемым рейтингом и статистикой **OpenDota API**.

## 1. Быстрый старт (Облачный PostgreSQL: Neon / Supabase / Railway)

1. Откройте файл `.env` в корне проекта (`C:\Users\vanap\.gemini\antigravity\scratch\dota2-platform\.env`) и укажите ваши переменные:
   ```env
   DATABASE_URL="postgresql://user:password@your-cloud-host.neon.tech/dota2_tournaments?sslmode=require"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   STEAM_API_KEY="ваш_ключ_steam_web_api"
   SESSION_SECRET="d4f8a92c1e7b63059482716354908a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f"
   ```

2. Примените схему Prisma к вашей облачной БД и заполните демонстрационными данными (16 команд, 1 турнир в регистрации, 1 турнир `in_progress` с частично сыгранной сеткой):
   ```bash
   npm run db:push
   npm run db:seed
   ```

3. Запустите сервер разработки:
   ```bash
   npm run dev
   ```
   Откройте `http://localhost:3000`.

## 2. Проверка качества и тесты

- **Проверка типов TypeScript (`strict: true`):**
  ```bash
  npm run typecheck
  ```
- **Линтер ESLint:**
  ```bash
  npm run lint
  ```
- **Юнит-тесты Vitest (движок сеток, формула рейтинга, OpenID 2.0, роли и лимиты, нагрузочный тест 128 команд):**
  ```bash
  npm run test
  ```
- **E2E-тесты Playwright:**
  ```bash
  npm run test:e2e
  ```
