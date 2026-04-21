import { WindowFrame } from "../types/baseTypes";

const BASE_RESPAWN_WAIT_BY_LEVEL = [
    0,
    10,
    10,
    12,
    12,
    14,
    16,
    20,
    25,
    28,
    32.5,
    35,
    37.5,
    40,
    42.5,
    45,
    47.5,
    50,
    52.5,
];

export type PlayerDeathTimeline = Record<number, PlayerDeathState>;

export type PlayerDeathTimerIndicator = {
    participantId: number;
    respawnAtMs: number;
    status: string;
}

export type PlayerDeathState = {
    lastHandledDeaths: number;
    participantId: number;
    respawnAtMs?: number;
}

export function advancePlayerDeathTimeline(
    firstWindowFrame: WindowFrame,
    previousFrame: WindowFrame | null,
    currentFrame: WindowFrame,
    currentTimeline: PlayerDeathTimeline,
) {
    const currentFrameMs = Date.parse(currentFrame.rfc460Timestamp);
    const firstFrameMs = Date.parse(firstWindowFrame.rfc460Timestamp);
    if (Number.isNaN(currentFrameMs) || Number.isNaN(firstFrameMs)) {
        return currentTimeline;
    }

    let nextTimeline = pruneExpiredDeathTimers(currentTimeline, currentFrameMs);
    if (!previousFrame && Object.keys(currentTimeline).length === 0) {
        return seedDeathTimelineFromFrame(currentFrame);
    }

    const currentParticipants = getParticipantsById(currentFrame);
    const firstParticipants = getParticipantsById(firstWindowFrame);

    currentParticipants.forEach(participant => {
        const firstParticipant = firstParticipants.get(participant.participantId);
        const existingState = nextTimeline[participant.participantId] || {
            lastHandledDeaths: firstParticipant?.deaths ?? participant.deaths,
            participantId: participant.participantId,
        };

        if (!nextTimeline[participant.participantId]) {
            nextTimeline[participant.participantId] = {
                lastHandledDeaths: existingState.lastHandledDeaths,
                participantId: participant.participantId,
            };
        }

        if (participant.deaths < existingState.lastHandledDeaths) {
            nextTimeline[participant.participantId] = {
                lastHandledDeaths: participant.deaths,
                participantId: participant.participantId,
            };
            return;
        }

        if (participant.deaths > existingState.lastHandledDeaths) {
            nextTimeline[participant.participantId] = {
                lastHandledDeaths: participant.deaths,
                participantId: participant.participantId,
                respawnAtMs: currentFrameMs + (getDisplayDeathTimerSeconds(participant.level, currentFrameMs - firstFrameMs) * 1000),
            };
        }
    });

    return nextTimeline;
}

function seedDeathTimelineFromFrame(frame: WindowFrame) {
    const nextTimeline: PlayerDeathTimeline = {};
    getParticipantsById(frame).forEach(participant => {
        nextTimeline[participant.participantId] = {
            lastHandledDeaths: participant.deaths,
            participantId: participant.participantId,
        };
    });

    return nextTimeline;
}

export function getPlayerDeathTimerIndicators(
    lastWindowFrame: WindowFrame,
    playerDeathTimeline: PlayerDeathTimeline,
    currentDisplayFrameMs?: number,
) {
    if (lastWindowFrame.gameState === "finished") {
        return {} as Record<number, PlayerDeathTimerIndicator>;
    }

    const fallbackFrameMs = Date.parse(lastWindowFrame.rfc460Timestamp);
    const currentFrameMs = currentDisplayFrameMs ?? fallbackFrameMs;
    if (Number.isNaN(currentFrameMs)) {
        return {} as Record<number, PlayerDeathTimerIndicator>;
    }

    const playerDeathTimers: Record<number, PlayerDeathTimerIndicator> = {};
    getParticipantsById(lastWindowFrame).forEach(participant => {
        const deathState = playerDeathTimeline[participant.participantId];
        if (!deathState?.respawnAtMs || deathState.respawnAtMs <= currentFrameMs) {
            return;
        }

        playerDeathTimers[participant.participantId] = {
            participantId: participant.participantId,
            respawnAtMs: deathState.respawnAtMs,
            status: `\u2620 ${formatRemainingTime(Math.ceil((deathState.respawnAtMs - currentFrameMs) / 1000))}`,
        };
    });

    return playerDeathTimers;
}

function pruneExpiredDeathTimers(timeline: PlayerDeathTimeline, currentFrameMs: number) {
    const nextTimeline = { ...timeline };
    Object.values(nextTimeline).forEach(playerDeathState => {
        if (playerDeathState.respawnAtMs && playerDeathState.respawnAtMs <= currentFrameMs) {
            nextTimeline[playerDeathState.participantId] = {
                lastHandledDeaths: playerDeathState.lastHandledDeaths,
                participantId: playerDeathState.participantId,
            };
        }
    });

    return nextTimeline;
}

function getDisplayDeathTimerSeconds(level: number, elapsedGameMs: number) {
    const clampedLevel = Math.max(1, Math.min(18, level));
    const baseRespawnWait = BASE_RESPAWN_WAIT_BY_LEVEL[clampedLevel];
    const totalMinutes = Math.max(0, elapsedGameMs) / 60000;

    let timeIncreaseFactor = 0;
    if (totalMinutes >= 15 && totalMinutes < 30) {
        timeIncreaseFactor = Math.ceil(2 * (totalMinutes - 15)) * 0.00425;
    } else if (totalMinutes >= 30 && totalMinutes < 45) {
        timeIncreaseFactor = 0.1275 + (Math.ceil(2 * (totalMinutes - 30)) * 0.0030);
    } else if (totalMinutes >= 45) {
        timeIncreaseFactor = 0.2175 + (Math.ceil(2 * (totalMinutes - 45)) * 0.0145);
    }

    return Math.ceil(baseRespawnWait * (1 + Math.min(timeIncreaseFactor, 0.5)));
}

function formatRemainingTime(totalSeconds: number) {
    const safeSeconds = Math.max(0, totalSeconds);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getParticipantsById(frame: WindowFrame) {
    return new Map(
        [...frame.blueTeam.participants, ...frame.redTeam.participants].map(participant => [participant.participantId, participant]),
    );
}
