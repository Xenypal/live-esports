import type { Page } from '@playwright/test';
import type { WindowFrame } from '../../../src/components/types/baseTypes';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  'base64',
);

const teamImage = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#1b365d"/></svg>`,
)}`;

function createWindowParticipants(offset: number) {
  return Array.from({ length: 5 }, (_, index) => ({
    participantId: offset + index + 1,
    totalGold: 5000 + index * 350,
    level: 10 + index,
    kills: index,
    deaths: 0,
    assists: 3 + index,
    creepScore: 110 + index * 10,
    currentHealth: 1200 + index * 50,
    maxHealth: 1500 + index * 50,
  }));
}

function createParticipantMetadata(side: 'blue' | 'red') {
  return Array.from({ length: 5 }, (_, index) => ({
    participantId: side === 'blue' ? index + 1 : index + 6,
    esportsPlayerId: `${side}-player-${index + 1}`,
    summonerName: `${side.toUpperCase()} Player ${index + 1}`,
    championId: ['Aatrox', 'Sejuani', 'Ahri', 'Jinx', 'Rell'][index],
    role: ['top', 'jungle', 'mid', 'bottom', 'support'][index],
  }));
}

function createDetailParticipants() {
  return Array.from({ length: 10 }, (_, index) => ({
    participantId: index + 1,
    level: 10 + (index % 5),
    kills: index % 4,
    deaths: index % 3,
    assists: 5 + (index % 5),
    totalGoldEarned: 6000 + index * 250,
    creepScore: 120 + index * 9,
    killParticipation: 0.45,
    championDamageShare: 0.2,
    wardsPlaced: 6,
    wardsDestroyed: 2,
    attackDamage: 120,
    abilityPower: 0,
    criticalChance: 0,
    attackSpeed: 1.1,
    lifeSteal: 5,
    armor: 50,
    magicResistance: 40,
    tenacity: 0,
    items: [1055, 3340],
    perkMetadata: {
      styleId: 8000,
      subStyleId: 8100,
      perks: [],
    },
    abilities: ['Q', 'W', 'E', 'R'],
  }));
}

function createLiveWindowFrame(): WindowFrame {
  return {
    blueTeam: {
      totalGold: 32100,
      inhibitors: 1,
      towers: 9,
      barons: 1,
      totalKills: 14,
      dragons: ['ocean', 'hextech'],
      participants: createWindowParticipants(0),
    },
    gameState: 'finished',
    rfc460Timestamp: '2026-04-03T08:30:00.000Z',
    redTeam: {
      totalGold: 28750,
      inhibitors: 0,
      towers: 3,
      barons: 0,
      totalKills: 7,
      dragons: ['cloud'],
      participants: createWindowParticipants(5),
    },
  };
}

export function createGameEndedWindowFrames(): WindowFrame[] {
  const finishedFrame = createLiveWindowFrame();

  return [
    {
      ...finishedFrame,
      gameState: 'in_game',
      rfc460Timestamp: '2026-04-03T08:29:40.000Z',
      blueTeam: {
        ...finishedFrame.blueTeam,
        inhibitors: 0,
        totalGold: 31600,
        totalKills: 13,
        towers: 8,
      },
      redTeam: {
        ...finishedFrame.redTeam,
        totalGold: 28600,
        totalKills: 7,
        towers: 3,
      },
    },
    finishedFrame,
  ];
}

export function createBlueKillWindowFrames(): WindowFrame[] {
  const baselineWindowFrame = createLiveWindowFrame();

  return [
    baselineWindowFrame,
    {
      ...baselineWindowFrame,
      rfc460Timestamp: '2026-04-03T08:30:10.000Z',
      blueTeam: {
        ...baselineWindowFrame.blueTeam,
        totalKills: baselineWindowFrame.blueTeam.totalKills + 1,
        participants: baselineWindowFrame.blueTeam.participants.map((participant, index) =>
          index === 0 ? { ...participant, kills: participant.kills + 1 } : participant,
        ),
      },
      redTeam: {
        ...baselineWindowFrame.redTeam,
        totalKills: baselineWindowFrame.redTeam.totalKills,
        participants: baselineWindowFrame.redTeam.participants.map((participant, index) =>
          index === 2 ? { ...participant, deaths: participant.deaths + 1, currentHealth: 0 } : participant,
        ),
      },
    },
  ];
}

export function createAmbiguousBlueKillWindowFrames(): WindowFrame[] {
  const baselineWindowFrame = createLiveWindowFrame();

  return [
    baselineWindowFrame,
    {
      ...baselineWindowFrame,
      rfc460Timestamp: '2026-04-03T08:30:10.000Z',
      blueTeam: {
        ...baselineWindowFrame.blueTeam,
        totalKills: baselineWindowFrame.blueTeam.totalKills + 2,
        participants: baselineWindowFrame.blueTeam.participants.map((participant, index) => {
          if (index === 0 || index === 1) {
            return { ...participant, kills: participant.kills + 1 };
          }

          return participant;
        }),
      },
      redTeam: {
        ...baselineWindowFrame.redTeam,
        participants: baselineWindowFrame.redTeam.participants.map((participant, index) => {
          if (index === 2 || index === 3) {
            return { ...participant, deaths: participant.deaths + 1, currentHealth: 0 };
          }

          return participant;
        }),
      },
    },
  ];
}

export function createBlueDragonWindowFrames(): WindowFrame[] {
  const baselineWindowFrame = createLiveWindowFrame();

  return [
    baselineWindowFrame,
    {
      ...baselineWindowFrame,
      rfc460Timestamp: '2026-04-03T08:30:10.000Z',
      blueTeam: {
        ...baselineWindowFrame.blueTeam,
        dragons: [...baselineWindowFrame.blueTeam.dragons, 'elder'],
      },
    },
  ];
}

export function createObjectiveTimerWindowFrames(): WindowFrame[] {
  const gameStartFrame = createObjectiveTimerInitialWindowFrame();

  return [
    gameStartFrame,
    {
      ...gameStartFrame,
      rfc460Timestamp: '2026-04-03T08:04:30.000Z',
      blueTeam: {
        ...gameStartFrame.blueTeam,
        totalGold: 6200,
      },
      redTeam: {
        ...gameStartFrame.redTeam,
        totalGold: 5900,
      },
    },
    {
      ...gameStartFrame,
      rfc460Timestamp: '2026-04-03T08:26:10.000Z',
      blueTeam: {
        ...gameStartFrame.blueTeam,
        barons: 1,
        dragons: ['ocean', 'hextech', 'infernal', 'mountain'],
        totalGold: 55000,
        totalKills: 15,
        towers: 8,
      },
      redTeam: {
        ...gameStartFrame.redTeam,
        totalGold: 47000,
        totalKills: 8,
        towers: 3,
      },
    },
    {
      ...gameStartFrame,
      rfc460Timestamp: '2026-04-03T08:32:10.000Z',
      blueTeam: {
        ...gameStartFrame.blueTeam,
        barons: 1,
        dragons: ['ocean', 'hextech', 'infernal', 'mountain', 'elder'],
        totalGold: 61200,
        totalKills: 20,
        towers: 10,
      },
      redTeam: {
        ...gameStartFrame.redTeam,
        totalGold: 50000,
        totalKills: 9,
        towers: 3,
      },
    },
  ];
}

export function createObjectiveTimerInitialWindowFrame(): WindowFrame {
  const baselineWindowFrame = createLiveWindowFrame();

  return {
    ...baselineWindowFrame,
    gameState: 'in_game',
    rfc460Timestamp: '2026-04-03T08:00:00.000Z',
    blueTeam: {
      ...baselineWindowFrame.blueTeam,
      barons: 0,
      dragons: [],
      inhibitors: 0,
      totalGold: 500,
      totalKills: 0,
      towers: 0,
    },
    redTeam: {
      ...baselineWindowFrame.redTeam,
      barons: 0,
      dragons: [],
      inhibitors: 0,
      totalGold: 500,
      totalKills: 0,
      towers: 0,
    },
  };
}

export function createSplitDragonObjectiveWindowFrames(): WindowFrame[] {
  const gameStartFrame = createObjectiveTimerInitialWindowFrame();

  return [
    {
      ...gameStartFrame,
      rfc460Timestamp: '2026-04-03T08:25:10.000Z',
      blueTeam: {
        ...gameStartFrame.blueTeam,
        dragons: ['ocean', 'hextech', 'infernal'],
        totalGold: 51750,
        totalKills: 14,
        towers: 6,
      },
      redTeam: {
        ...gameStartFrame.redTeam,
        dragons: ['cloud', 'mountain'],
        totalGold: 48900,
        totalKills: 11,
        towers: 4,
      },
    },
  ];
}

export function createSoulClinchObjectiveWindowFrames(): WindowFrame[] {
  const gameStartFrame = createObjectiveTimerInitialWindowFrame();

  return [
    {
      ...gameStartFrame,
      rfc460Timestamp: '2026-04-03T08:25:10.000Z',
      blueTeam: {
        ...gameStartFrame.blueTeam,
        dragons: ['ocean', 'hextech', 'infernal'],
        totalGold: 51750,
        totalKills: 14,
        towers: 6,
      },
      redTeam: {
        ...gameStartFrame.redTeam,
        dragons: ['cloud', 'mountain'],
        totalGold: 48900,
        totalKills: 11,
        towers: 4,
      },
    },
    {
      ...gameStartFrame,
      rfc460Timestamp: '2026-04-03T08:30:10.000Z',
      blueTeam: {
        ...gameStartFrame.blueTeam,
        dragons: ['ocean', 'hextech', 'infernal', 'chemtech'],
        totalGold: 55600,
        totalKills: 17,
        towers: 8,
      },
      redTeam: {
        ...gameStartFrame.redTeam,
        dragons: ['cloud', 'mountain'],
        totalGold: 50300,
        totalKills: 12,
        towers: 4,
      },
    },
  ];
}

export function createPreSpawnObjectiveWindowFrames(): WindowFrame[] {
  const baselineWindowFrame = createLiveWindowFrame();
  const gameStartFrame: WindowFrame = {
    ...baselineWindowFrame,
    gameState: 'in_game',
    rfc460Timestamp: '2026-04-03T08:00:00.000Z',
    blueTeam: {
      ...baselineWindowFrame.blueTeam,
      barons: 0,
      dragons: [],
      inhibitors: 0,
      totalGold: 500,
      totalKills: 0,
      towers: 0,
    },
    redTeam: {
      ...baselineWindowFrame.redTeam,
      barons: 0,
      dragons: [],
      inhibitors: 0,
      totalGold: 500,
      totalKills: 0,
      towers: 0,
    },
  };

  return [
    gameStartFrame,
    {
      ...gameStartFrame,
      rfc460Timestamp: '2026-04-03T08:04:30.000Z',
      blueTeam: {
        ...gameStartFrame.blueTeam,
        totalGold: 6200,
        totalKills: 2,
        towers: 1,
      },
      redTeam: {
        ...gameStartFrame.redTeam,
        totalGold: 5900,
        totalKills: 1,
        towers: 0,
      },
    },
  ];
}

export function createAliveObjectiveWindowFrames(): WindowFrame[] {
  const baselineWindowFrame = createLiveWindowFrame();
  const gameStartFrame: WindowFrame = {
    ...baselineWindowFrame,
    gameState: 'in_game',
    rfc460Timestamp: '2026-04-03T08:00:00.000Z',
    blueTeam: {
      ...baselineWindowFrame.blueTeam,
      barons: 0,
      dragons: [],
      inhibitors: 0,
      totalGold: 500,
      totalKills: 0,
      towers: 0,
    },
    redTeam: {
      ...baselineWindowFrame.redTeam,
      barons: 0,
      dragons: [],
      inhibitors: 0,
      totalGold: 500,
      totalKills: 0,
      towers: 0,
    },
  };

  return [
    gameStartFrame,
    {
      ...gameStartFrame,
      rfc460Timestamp: '2026-04-03T08:21:00.000Z',
      blueTeam: {
        ...gameStartFrame.blueTeam,
        totalGold: 36200,
        totalKills: 12,
        towers: 5,
      },
      redTeam: {
        ...gameStartFrame.redTeam,
        totalGold: 33150,
        totalKills: 8,
        towers: 3,
      },
    },
  ];
}

export function createObservedBaronBuffWindowFrames(): WindowFrame[] {
  const baselineWindowFrame = createLiveWindowFrame();
  const gameStartFrame: WindowFrame = {
    ...baselineWindowFrame,
    gameState: 'in_game',
    rfc460Timestamp: '2026-04-03T08:00:00.000Z',
    blueTeam: {
      ...baselineWindowFrame.blueTeam,
      barons: 0,
      dragons: [],
      inhibitors: 0,
      totalGold: 500,
      totalKills: 0,
      towers: 0,
    },
    redTeam: {
      ...baselineWindowFrame.redTeam,
      barons: 0,
      dragons: [],
      inhibitors: 0,
      totalGold: 500,
      totalKills: 0,
      towers: 0,
    },
  };

  const baronTakeFrame: WindowFrame = {
    ...gameStartFrame,
    rfc460Timestamp: '2026-04-03T08:26:10.000Z',
    blueTeam: {
      ...gameStartFrame.blueTeam,
      barons: 1,
      totalGold: 55000,
      totalKills: 15,
      towers: 8,
      participants: gameStartFrame.blueTeam.participants.map(participant => ({
        ...participant,
        currentHealth: participant.maxHealth,
      })),
    },
    redTeam: {
      ...gameStartFrame.redTeam,
      totalGold: 47000,
      totalKills: 8,
      towers: 3,
    },
  };

  const baronDeathFrame: WindowFrame = {
    ...baronTakeFrame,
    rfc460Timestamp: '2026-04-03T08:26:30.000Z',
    blueTeam: {
      ...baronTakeFrame.blueTeam,
      participants: baronTakeFrame.blueTeam.participants.map((participant, index) =>
        index === 1 ? { ...participant, deaths: participant.deaths + 1, currentHealth: 0 } : participant,
      ),
    },
  };

  return [
    gameStartFrame,
    baronTakeFrame,
    baronDeathFrame,
    {
      ...baronDeathFrame,
      rfc460Timestamp: '2026-04-03T08:26:50.000Z',
      blueTeam: {
        ...baronDeathFrame.blueTeam,
        participants: baronDeathFrame.blueTeam.participants.map((participant, index) =>
          index === 1 ? { ...participant, currentHealth: participant.maxHealth } : participant,
        ),
      },
    },
  ];
}

export function createEstimatedBaronBuffWindowFrames(): WindowFrame[] {
  const baselineWindowFrame = createLiveWindowFrame();
  return [
    {
      ...baselineWindowFrame,
      gameState: 'in_game',
      rfc460Timestamp: '2026-04-03T08:21:30.000Z',
      blueTeam: {
        ...baselineWindowFrame.blueTeam,
        barons: 1,
        dragons: ['ocean', 'hextech'],
        participants: baselineWindowFrame.blueTeam.participants.map(participant => ({
          ...participant,
          currentHealth: participant.maxHealth,
        })),
      },
      redTeam: {
        ...baselineWindowFrame.redTeam,
        barons: 0,
      },
    },
  ];
}

export function createEstimatedBaronInitialWindowFrame(): WindowFrame {
  const baselineWindowFrame = createLiveWindowFrame();
  return {
    ...baselineWindowFrame,
    gameState: 'in_game',
    rfc460Timestamp: '2026-04-03T08:00:00.000Z',
    blueTeam: {
      ...baselineWindowFrame.blueTeam,
      barons: 0,
      dragons: [],
      inhibitors: 0,
      totalGold: 500,
      totalKills: 0,
      towers: 0,
    },
    redTeam: {
      ...baselineWindowFrame.redTeam,
      barons: 0,
      dragons: [],
      inhibitors: 0,
      totalGold: 500,
      totalKills: 0,
      towers: 0,
    },
  };
}

type MockLiveMatchApisOptions = {
  detailsDelayMs?: number;
  eventDetailsResponses?: any[];
  itemsDelayMs?: number;
  initialWindowFrame?: WindowFrame;
  liveWindowFrames?: WindowFrame[];
};

export async function mockLiveMatchApis(page: Page, options?: MockLiveMatchApisOptions) {
  const completedEventDetails = createCompletedEventDetails();
  const scheduleEvent = {
    league: {
      name: 'LCS',
      slug: 'lcs',
    },
    match: {
      id: 'match-1',
      strategy: {
        count: 1,
        type: 'bestOf',
      },
      teams: [
        {
          code: 'FLY',
          image: teamImage,
          name: 'FlyQuest',
          record: {
            wins: 10,
            losses: 2,
          },
          result: {
            gameWins: 1,
            outcome: 'win',
          },
        },
        {
          code: 'TL',
          image: teamImage,
          name: 'Team Liquid',
          record: {
            wins: 8,
            losses: 4,
          },
          result: {
            gameWins: 0,
            outcome: 'loss',
          },
        },
      ],
    },
    startTime: '2026-04-03T08:00:00.000Z',
    state: 'completed',
    type: 'match',
  };

  const liveWindowFrames = options?.liveWindowFrames?.length ? options.liveWindowFrames : [createLiveWindowFrame()];
  const initialWindowFrame = options?.initialWindowFrame || liveWindowFrames[0];
  const detailsDelayMs = options?.detailsDelayMs || 0;
  const eventDetailsResponses = options?.eventDetailsResponses?.length ? options.eventDetailsResponses : [completedEventDetails];
  const itemsDelayMs = options?.itemsDelayMs || 0;
  let eventDetailsCallCount = 0;
  let liveWindowCallCount = 0;

  const initialWindowResponse = {
    gameMetadata: {
      patchVersion: '14.3.1',
      blueTeamMetadata: {
        esportsTeamId: 'team-1',
        participantMetadata: createParticipantMetadata('blue'),
      },
      redTeamMetadata: {
        esportsTeamId: 'team-2',
        participantMetadata: createParticipantMetadata('red'),
      },
    },
    frames: [initialWindowFrame],
  };

  const detailsResponse = {
    frames: [
      {
        rfc460Timestamp: '2026-04-03T08:30:00.000Z',
        participants: createDetailParticipants(),
      },
    ],
  };

  await page.route(/\/persisted\/gw\/getEventDetails\b/, async route => {
    const responseIndex = Math.min(eventDetailsCallCount, eventDetailsResponses.length - 1);
    const eventDetails = eventDetailsResponses[responseIndex];
    eventDetailsCallCount += 1;

    await route.fulfill({ json: { data: { event: eventDetails } } });
  });

  await page.route(/\/persisted\/gw\/getSchedule\b/, async route => {
    await route.fulfill({
      json: {
        data: {
          schedule: {
            events: [scheduleEvent],
            pages: {
              newer: '',
              older: '',
            },
            updated: '2026-04-03T08:30:00.000Z',
          },
        },
      },
    });
  });

  await page.route(/\/persisted\/gw\/getStandings\b/, async route => {
    await route.fulfill({
      json: {
        data: {
          standings: [
            {
              stages: [
                {
                  name: 'Regular Season',
                  slug: 'regular-season',
                  type: 'groups',
                  sections: [
                    {
                      name: 'Main',
                      rankings: [],
                      matches: [
                        {
                          events: [],
                          id: 'match-1',
                          pages: {
                            newer: '',
                            older: '',
                          },
                          state: 'completed',
                          teams: [
                            {
                              code: 'FLY',
                              id: 'team-1',
                              image: teamImage,
                              name: 'FlyQuest',
                              result: {
                                gameWins: 1,
                                outcome: 'win',
                              },
                              slug: 'flyquest',
                            },
                            {
                              code: 'TL',
                              id: 'team-2',
                              image: teamImage,
                              name: 'Team Liquid',
                              result: {
                                gameWins: 0,
                                outcome: 'loss',
                              },
                              slug: 'team-liquid',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
  });

  await page.route(/\/livestats\/v1\/window\//, async route => {
    const requestUrl = new URL(route.request().url());
    const isLivePollingRequest = requestUrl.searchParams.has('startingTime');
    const liveFrameIndex = Math.min(liveWindowCallCount, liveWindowFrames.length - 1);
    const responseFrame = isLivePollingRequest ? liveWindowFrames[liveFrameIndex] : initialWindowFrame;

    if (isLivePollingRequest) {
      liveWindowCallCount += 1;
    }

    await route.fulfill({
      json: {
        ...initialWindowResponse,
        frames: [responseFrame],
      },
    });
  });

  await page.route(/\/livestats\/v1\/details\//, async route => {
    if (detailsDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, detailsDelayMs));
    }
    await route.fulfill({ json: detailsResponse });
  });

  await page.route(/\/cdn\/14\.3\.1\/data\/en_US\/item\.json$/, async route => {
    if (itemsDelayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, itemsDelayMs));
    }
    await route.fulfill({
      json: {
        data: {
          1055: {
            name: "Doran's Blade",
            description: '<mainText><stats>Starter item</stats></mainText>',
            colloq: '',
            plaintext: 'Starter item',
            into: [],
            gold: {
              base: '450',
              purchaseable: true,
              total: '450',
              sell: '180',
            },
          },
          3340: {
            name: 'Stealth Ward',
            description: '<mainText><stats>Vision trinket</stats></mainText>',
            colloq: '',
            plaintext: 'Vision trinket',
            into: [],
            gold: {
              base: '0',
              purchaseable: false,
              total: '0',
              sell: '0',
            },
          },
        },
      },
    });
  });

  await page.route(/\/cdn\/14\.3\.1\/data\/en_US\/runesReforged\.json$/, async route => {
    await route.fulfill({ json: [] });
  });

  await page.route(/\/cdn\/14\.3\.1\/img\//, async route => {
    await route.fulfill({
      body: onePixelPng,
      contentType: 'image/png',
    });
  });
}

export function createCompletedEventDetails() {
  return {
    id: 'match-1',
    league: {
      id: 'league-1',
      image: teamImage,
      name: 'LCS',
      slug: 'lcs',
    },
    tournament: {
      id: 'tournament-1',
    },
    type: 'match',
    match: {
      strategy: {
        count: 1,
      },
      teams: [
        {
          code: 'FLY',
          id: 'team-1',
          image: teamImage,
          name: 'FlyQuest',
          result: {
            gameWins: 1,
            outcome: 'win',
          },
        },
        {
          code: 'TL',
          id: 'team-2',
          image: teamImage,
          name: 'Team Liquid',
          result: {
            gameWins: 0,
            outcome: 'loss',
          },
        },
      ],
      games: [
        {
          id: 'game-1',
          number: 1,
          state: 'completed',
          teams: [
            { id: 'team-1', side: 'blue' },
            { id: 'team-2', side: 'red' },
          ],
        },
      ],
    },
  };
}

export function createInProgressEventDetails() {
  const completedEventDetails = createCompletedEventDetails();

  return {
    ...completedEventDetails,
    match: {
      ...completedEventDetails.match,
      teams: completedEventDetails.match.teams.map(team => ({
        ...team,
        result: {
          gameWins: 0,
        },
      })),
      games: completedEventDetails.match.games.map(game => ({
        ...game,
        state: 'inProgress',
      })),
    },
  };
}
