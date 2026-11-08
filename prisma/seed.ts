// [Phase: MVP v1] Database Initialization & Cleanup Script: Ensures Active Rating Formula & Removes Any Demo/Fake Data
import { PrismaClient, type Prisma } from '@prisma/client';
import { DEFAULT_RATING_FORMULA_CONFIG } from '../src/modules/ratings/engine';

const prisma = new PrismaClient();

const DEMO_TEAM_TAGS = [
  'TS',
  'BB',
  'TL',
  'GG',
  'FLCN',
  'TUND',
  'XG',
  'NAVI',
  'VP',
  'OG',
  'SR',
  'HERO',
  'AUR',
  'PV',
  '1WIN',
  'NGX',
];

const DEMO_TOURNAMENT_SLUGS = [
  'aegis-open-qualifier-s1',
  'aegis-champions-cup-s1',
];

async function main() {
  console.log('🔧 Initializing Dota turnir database & removing demo data...');

  // 1. Ensure Active Rating Formula v1 exists
  await prisma.ratingFormula.upsert({
    where: { version: 1 },
    update: { isActive: true },
    create: {
      version: 1,
      config: DEFAULT_RATING_FORMULA_CONFIG as unknown as Prisma.InputJsonValue,
      isActive: true,
    },
  });

  // 2. Remove seeded demo tournaments
  await prisma.tournament
    .deleteMany({
      where: {
        slug: { in: DEMO_TOURNAMENT_SLUGS },
      },
    })
    .catch(() => null);

  // 3. Remove seeded demo lobbies
  await prisma.customLobby
    .deleteMany({
      where: {
        dotaLobbyName: {
          in: ['Dota turnir — Open 5x5 #1', 'Dota turnir — Scrim CM #2'],
        },
      },
    })
    .catch(() => null);

  // 4. Remove seeded demo teams (only those whose members are fake 76561198100000* users)
  await prisma.team
    .deleteMany({
      where: {
        tag: { in: DEMO_TEAM_TAGS },
        memberships: {
          some: {
            user: {
              steamId64: { startsWith: '76561198100000' },
            },
          },
        },
      },
    })
    .catch(() => null);

  // 5. Remove seeded fake users
  await prisma.user
    .deleteMany({
      where: {
        OR: [
          { steamId64: { startsWith: '76561198100000' } },
          { steamId64: '76561198000000001' },
        ],
      },
    })
    .catch(() => null);

  // 5b. Ensure the first real Steam user (platform owner, e.g. garry) has 'admin' role
  const adminCount = await prisma.user
    .count({ where: { role: 'admin' } })
    .catch(() => 0);
  if (adminCount === 0) {
    const firstRealUser = await prisma.user
      .findFirst({ orderBy: { createdAt: 'asc' } })
      .catch(() => null);
    if (firstRealUser) {
      await prisma.user
        .update({
          where: { id: firstRealUser.id },
          data: { role: 'admin' },
        })
        .catch(() => null);
      console.log(`👑 Promoted platform owner ${firstRealUser.nickname} to admin.`);
    }
  }

  // 6. Normalize legacy region codes (EEU/WEU -> EU, NA -> US, SEA -> ASIA) on real teams & tournaments
  await prisma.team
    .updateMany({
      where: { region: { in: ['EEU', 'WEU', 'MENA'] } },
      data: { region: 'EU' },
    })
    .catch(() => null);
  await prisma.team
    .updateMany({
      where: { region: 'NA' },
      data: { region: 'US' },
    })
    .catch(() => null);
  await prisma.team
    .updateMany({
      where: { region: 'SEA' },
      data: { region: 'ASIA' },
    })
    .catch(() => null);

  // 7. Clear broken legacy /uploads/ paths so teams show clean fallback or newly uploaded Data URI logos
  await prisma.team
    .updateMany({
      where: { logoUrl: { startsWith: '/uploads/' } },
      data: { logoUrl: null },
    })
    .catch(() => null);

  console.log('✅ Database initialized cleanly (only real users, teams, lobbies, and tournaments remain).');
}

main()
  .catch((e) => {
    console.error('❌ Database init error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
