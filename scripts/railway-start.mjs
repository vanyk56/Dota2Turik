// [Phase: MVP v1] Smart Railway Startup Script:
// 1. If DATABASE_URL is configured, runs `prisma db push` and auto-seeds 16 teams + 2 tournaments if DB is empty.
// 2. If DATABASE_URL is not yet added in Railway Variables, logs a clear hint and still starts Next.js so healthchecks pass.
import { spawnSync, spawn } from 'node:child_process';

const port = process.env.PORT || '3000';
const dbUrl = process.env.DATABASE_URL?.trim();

if (dbUrl) {
  console.log('🔗 DATABASE_URL detected. Pushing Prisma schema to PostgreSQL...');
  const pushResult = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
    stdio: 'inherit',
    shell: true,
  });

  if (pushResult.status === 0 && process.env.SKIP_AUTO_SEED !== 'true') {
    console.log('🌱 Ensuring initial seed data (16 teams & 2 tournaments)...');
    spawnSync('npx', ['tsx', 'prisma/seed.ts'], {
      stdio: 'inherit',
      shell: true,
    });
  }
} else {
  console.warn(
    '⚠️ [RAILWAY NOTICE] DATABASE_URL is not set in service Variables yet! Add a PostgreSQL service in Railway and set DATABASE_URL=${{Postgres.DATABASE_URL}}.',
  );
}

console.log(`🚀 Starting Next.js server on 0.0.0.0:${port}...`);
const child = spawn('npx', ['next', 'start', '-H', '0.0.0.0', '-p', port], {
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
