// [Phase: MVP v1] Prisma Seed Script: 16 Teams, 1 Registration Tournament, 1 In-Progress Tournament with Partially Played Bracket (Section 16)
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  advanceMatchResult,
  generateSingleEliminationBracket,
} from '../src/modules/brackets/engine';
import { DEFAULT_RATING_FORMULA_CONFIG } from '../src/modules/ratings/engine';
import { hashPassword } from '../src/server/crypto';

const prisma = new PrismaClient();

async function ensureDemoLobbies() {
  const existingLobbies = await prisma.customLobby.count().catch(() => 0);
  if (existingLobbies > 0) return;

  const users = await prisma.user.findMany({ take: 8, orderBy: { createdAt: 'asc' } });
  if (users.length === 0 || !users[0]) return;

  const host = users[0];

  // 1. Open 5v5 All Pick Lobby (Свободный вход)
  const openLobby = await prisma.customLobby.create({
    data: {
      name: 'Вечерний открытый лобак 5x5 (All Pick)',
      description:
        'Свободный вход без пароля! Заходите на любые свободные позиции за Силы Света или Силы Тьмы.',
      hostId: host.id,
      status: 'waiting',
      gameMode: 'all_pick',
      region: 'EEU',
      serverLocation: 'Stockholm (EU North)',
      maxPlayers: 10,
      passwordHash: null,
      dotaLobbyName: 'Dota turnir — Open 5x5 #1',
      dotaLobbyPassword: 'dt777',
    },
  });

  // Add a few players into the open lobby leaving slots free for the user to join
  const sampleSides: Array<{ side: 'radiant' | 'dire'; slot: number }> = [
    { side: 'radiant', slot: 1 },
    { side: 'radiant', slot: 2 },
    { side: 'dire', slot: 1 },
    { side: 'dire', slot: 2 },
  ];
  for (let i = 0; i < Math.min(users.length, sampleSides.length); i++) {
    await prisma.lobbyParticipant.create({
      data: {
        lobbyId: openLobby.id,
        userId: users[i]!.id,
        side: sampleSides[i]!.side,
        slot: sampleSides[i]!.slot,
        isReady: true,
      },
    });
  }

  // 2. Password-Protected 5v5 Captains Mode Lobby (По паролю: "dota")
  const secondHost = users[1] ?? host;
  const privateLobby = await prisma.customLobby.create({
    data: {
      name: 'Закрытый КВ / Пракк 5x5 (Пароль: dota)',
      description:
        'Тренировочное лобби Captains Mode по паролю (тестовый пароль для входа: dota).',
      hostId: secondHost.id,
      status: 'waiting',
      gameMode: 'captains_mode',
      region: 'WEU',
      serverLocation: 'Luxembourg (EU West)',
      maxPlayers: 10,
      passwordHash: hashPassword('dota'),
      dotaLobbyName: 'Dota turnir — Scrim CM #2',
      dotaLobbyPassword: 'dota',
    },
  });

  await prisma.lobbyParticipant.create({
    data: {
      lobbyId: privateLobby.id,
      userId: secondHost.id,
      side: 'radiant',
      slot: 1,
      isReady: true,
    },
  });
}

const SEED_TEAMS = [
  { name: 'Team Spirit', tag: 'TS', country: 'RU', region: 'EEU', rating: 1850 },
  { name: 'BetBoom Team', tag: 'BB', country: 'RU', region: 'EEU', rating: 1720 },
  { name: 'Team Liquid', tag: 'TL', country: 'SE', region: 'WEU', rating: 1690 },
  { name: 'Gaimin Gladiators', tag: 'GG', country: 'DE', region: 'WEU', rating: 1640 },
  { name: 'Team Falcons', tag: 'FLCN', country: 'INT', region: 'MENA', rating: 1600 },
  { name: 'Tundra Esports', tag: 'TUND', country: 'DE', region: 'WEU', rating: 1520 },
  { name: 'Xtreme Gaming', tag: 'XG', country: 'CN', region: 'CN', rating: 1480 },
  { name: 'Natus Vincere', tag: 'NAVI', country: 'UA', region: 'EEU', rating: 1410 },
  { name: 'Virtus.pro', tag: 'VP', country: 'RU', region: 'EEU', rating: 1350 },
  { name: 'OG Esports', tag: 'OG', country: 'INT', region: 'WEU', rating: 1290 },
  { name: 'Shopify Rebellion', tag: 'SR', country: 'US', region: 'NA', rating: 1220 },
  { name: 'HEROIC', tag: 'HERO', country: 'BR', region: 'SA', rating: 1180 },
  { name: 'Aurora Gaming', tag: 'AUR', country: 'PH', region: 'SEA', rating: 1120 },
  { name: 'PARIVISION', tag: 'PV', country: 'KZ', region: 'EEU', rating: 1080 },
  { name: '1win Team', tag: '1WIN', country: 'BY', region: 'EEU', rating: 1020 },
  { name: 'Nigma Galaxy', tag: 'NGX', country: 'INT', region: 'MENA', rating: 960 },
];

async function main() {
  const existingTeamsCount = await prisma.team.count().catch(() => 0);
  if (existingTeamsCount > 0 && process.env.FORCE_SEED !== 'true') {
    console.log(
      `ℹ️ Database already contains ${existingTeamsCount} teams. Updating Dota turnir tournament covers & branding...`,
    );
    await prisma.tournament
      .updateMany({
        where: { slug: 'aegis-open-qualifier-s1' },
        data: {
          name: 'Dota turnir Open Qualifier — Season 1',
          coverUrl: '/covers/qualifier-cover.jpg',
        },
      })
      .catch(() => null);
    await prisma.tournament
      .updateMany({
        where: { slug: 'aegis-champions-cup-s1' },
        data: {
          name: 'Dota turnir Champions Cup — Major S1',
          coverUrl: '/covers/major-cover.jpg',
        },
      })
      .catch(() => null);
    await ensureDemoLobbies().catch(() => null);
    return;
  }

  console.log('🌱 Starting Dota turnir Platform seed...');

  // 1. Active Rating Formula v1
  await prisma.ratingFormula.upsert({
    where: { version: 1 },
    update: { isActive: true },
    create: {
      version: 1,
      config: DEFAULT_RATING_FORMULA_CONFIG as unknown as Prisma.InputJsonValue,
      isActive: true,
    },
  });

  // 2. Create Admin / Organizer User
  const adminUser = await prisma.user.upsert({
    where: { steamId64: '76561198000000001' },
    update: { role: 'admin', nickname: 'AEGIS_ChiefAdmin' },
    create: {
      steamId64: '76561198000000001',
      nickname: 'AEGIS_ChiefAdmin',
      role: 'admin',
      profileUrl: 'https://steamcommunity.com/profiles/76561198000000001',
    },
  });

  // 3. Create 16 Teams with 5 Active Main Players each
  const createdTeams: Array<{ id: string; tag: string; ratingPoints: number }> = [];

  for (let i = 0; i < SEED_TEAMS.length; i++) {
    const tDef = SEED_TEAMS[i]!;
    const team = await prisma.team.upsert({
      where: { tag: tDef.tag },
      update: {
        name: tDef.name,
        country: tDef.country,
        region: tDef.region,
        ratingPoints: tDef.rating,
        status: 'active',
      },
      create: {
        name: tDef.name,
        tag: tDef.tag,
        country: tDef.country,
        region: tDef.region,
        ratingPoints: tDef.rating,
        status: 'active',
        description: `Официальный турнирный состав ${tDef.name} ([${tDef.tag}]) в регионе ${tDef.region}.`,
      },
    });

    const roles: Array<'captain' | 'co_captain' | 'player'> = [
      'captain',
      'co_captain',
      'player',
      'player',
      'player',
    ];

    for (let p = 0; p < 5; p++) {
      const steamId64 = `76561198${String(100000000 + i * 10 + p)}`;
      const playerUser = await prisma.user.upsert({
        where: { steamId64 },
        update: {},
        create: {
          steamId64,
          nickname: `${tDef.tag}_Pos${p + 1}`,
          role: 'user',
          profileUrl: `https://steamcommunity.com/profiles/${steamId64}`,
        },
      });

      const existingMember = await prisma.teamMembership.findFirst({
        where: { teamId: team.id, userId: playerUser.id, isActive: true },
      });

      if (!existingMember) {
        await prisma.teamMembership.create({
          data: {
            teamId: team.id,
            userId: playerUser.id,
            role: roles[p]!,
            isActive: true,
          },
        });
      }
    }

    createdTeams.push({
      id: team.id,
      tag: team.tag,
      ratingPoints: team.ratingPoints,
    });
  }

  // 4. Create Tournament #1 in `registration` status
  const regTournament = await prisma.tournament.upsert({
    where: { slug: 'aegis-open-qualifier-s1' },
    update: {
      name: 'Dota turnir Open Qualifier — Season 1',
      coverUrl: '/covers/qualifier-cover.jpg',
      status: 'registration',
    },
    create: {
      slug: 'aegis-open-qualifier-s1',
      name: 'Dota turnir Open Qualifier — Season 1',
      coverUrl: '/covers/qualifier-cover.jpg',
      description:
        'Открытая квалификация Dota turnir для команд Восточной и Западной Европы в формате Single Elimination BO3.',
      format: 'single_elimination',
      status: 'registration',
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      region: 'EEU',
      prizePool: '500 000 ₽ + Слот в Main Event',
      rules:
        '1. Режим игры: Captains Mode.\n2. Обязательно наличие 5 игроков основного состава.\n3. Подтверждение результатов обеими командами.',
      maxTeams: 16,
      levelWeight: 'tier_b',
      organizerId: adminUser.id,
      settings: {
        seedingMode: 'rating',
        defaultBestOf: 3,
      },
    },
  });

  for (let i = 0; i < 8; i++) {
    const team = createdTeams[i]!;
    await prisma.registration.upsert({
      where: {
        tournamentId_teamId: {
          tournamentId: regTournament.id,
          teamId: team.id,
        },
      },
      update: {},
      create: {
        tournamentId: regTournament.id,
        teamId: team.id,
        status: i < 6 ? 'approved' : 'pending',
        seed: i + 1,
      },
    });
  }

  // 5. Create Tournament #2 in `in_progress` status with 16 Teams & Partially Played Bracket
  const liveTournament = await prisma.tournament.upsert({
    where: { slug: 'aegis-champions-cup-s1' },
    update: {
      name: 'Dota turnir Champions Cup — Major S1',
      coverUrl: '/covers/major-cover.jpg',
      status: 'in_progress',
    },
    create: {
      slug: 'aegis-champions-cup-s1',
      name: 'Dota turnir Champions Cup — Major S1',
      coverUrl: '/covers/major-cover.jpg',
      description:
        'Главный турнир сезона Dota turnir на 16 команд с интерактивной сеткой на холсте React Flow.',
      format: 'single_elimination',
      status: 'in_progress',
      startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      region: 'WEU',
      prizePool: '$50,000 + 2000 Rating Pts',
      rules:
        '1. Все матчи BO3, Гранд-финал BO5.\n2. Спорные результаты рассматриваются судьями в панели управления.',
      maxTeams: 16,
      levelWeight: 'tier_s',
      organizerId: adminUser.id,
      settings: {
        seedingMode: 'rating',
        defaultBestOf: 3,
      },
    },
  });

  for (let i = 0; i < createdTeams.length; i++) {
    const team = createdTeams[i]!;
    await prisma.registration.upsert({
      where: {
        tournamentId_teamId: {
          tournamentId: liveTournament.id,
          teamId: team.id,
        },
      },
      update: { status: 'approved', seed: i + 1 },
      create: {
        tournamentId: liveTournament.id,
        teamId: team.id,
        status: 'approved',
        seed: i + 1,
      },
    });
  }

  // Generate 16-team Single Elimination bracket and advance Round 1 + half of Round 2
  await prisma.match.deleteMany({ where: { tournamentId: liveTournament.id } });
  await prisma.bracket.deleteMany({ where: { tournamentId: liveTournament.id } });

  let engineMatches = generateSingleEliminationBracket(
    createdTeams.map((t, idx) => ({
      teamId: t.id,
      seed: idx + 1,
      ratingPoints: t.ratingPoints,
    })),
    { seedingMode: 'rating', defaultBestOf: 3 },
    'seed_se',
  );

  // Advance all 8 Round 1 matches
  const round1Ids = engineMatches
    .filter((m) => m.round === 1)
    .map((m) => m.id);
  for (let idx = 0; idx < round1Ids.length; idx++) {
    engineMatches = advanceMatchResult(
      engineMatches,
      round1Ids[idx]!,
      2,
      idx % 2 === 0 ? 0 : 1,
    );
  }

  // Advance first 2 Round 2 quarterfinal matches
  const round2Ids = engineMatches
    .filter((m) => m.round === 2)
    .map((m) => m.id);
  engineMatches = advanceMatchResult(engineMatches, round2Ids[0]!, 2, 1);
  engineMatches = advanceMatchResult(engineMatches, round2Ids[1]!, 2, 0);

  // Set Round 2 Match #3 to 'live'
  const r2m3 = engineMatches.find((m) => m.id === round2Ids[2]);
  if (r2m3) {
    r2m3.status = 'live';
    r2m3.scoreA = 1;
    r2m3.scoreB = 1;
  }

  const createdBracket = await prisma.bracket.create({
    data: {
      tournamentId: liveTournament.id,
      format: 'single_elimination',
      stage: 'main',
      layout: {},
    },
  });

  const engineIdToDbId = new Map<string, string>();
  for (const em of engineMatches) {
    const dbMatch = await prisma.match.create({
      data: {
        tournamentId: liveTournament.id,
        bracketId: createdBracket.id,
        round: em.round,
        position: em.position,
        stage: em.stage,
        teamAId: em.teamAId,
        teamBId: em.teamBId,
        scoreA: em.scoreA,
        scoreB: em.scoreB,
        status: em.status,
        winnerId: em.winnerId,
        bestOf: em.bestOf,
        isBye: em.isBye,
      },
    });
    engineIdToDbId.set(em.id, dbMatch.id);
  }

  for (const em of engineMatches) {
    if (em.nextMatchId) {
      const dbMatchId = engineIdToDbId.get(em.id);
      const dbNextId = engineIdToDbId.get(em.nextMatchId);
      if (dbMatchId && dbNextId) {
        await prisma.match.update({
          where: { id: dbMatchId },
          data: { nextMatchId: dbNextId },
        });
      }
    }
  }

  await ensureDemoLobbies().catch(() => null);

  console.log(
    '✅ Seed completed: 16 teams, 1 registration tournament, 1 in_progress tournament with partially played bracket, and 2 demo lobbies.',
  );
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
