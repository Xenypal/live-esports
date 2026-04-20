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

export type PlayerDeathTimerIndicator = {
    participantId: number;
    respawnAtMs: number;
    status: string;
}

type PlayerDeathState = {
    isDead: boolean;
    isUnresolved: boolean;
    participantId: number;
    respawnAtMs?: number;
}

export function buildPlayerDeathTimelineFromFrames(frames: WindowFrame[]) {
    const orderedFrames = getOrderedUniqueFrames(frames);
    const firstFrame = orderedFrames[0];
    if (!firstFrame) {
        return {} as Record<number, PlayerDeathState>;
    }

    const firstFrameMs = Date.parse(firstFrame.rfc460Timestamp);
    if (Number.isNaN(firstFrameMs)) {
        return {} as Record<number, PlayerDeathState>;
    }

    let previousFrame: WindowFrame | null = null;
    let playerStates: Record<number, PlayerDeathState> = {};

    orderedFrames.forEach(frame => {
        const currentFrameMs = Date.parse(frame.rfc460Timestamp);
        if (Number.isNaN(currentFrameMs)) {
            return;
        }

        const currentParticipants = getParticipantsById(frame);
        if (!previousFrame) {
            currentParticipants.forEach(participant => {
                playerStates[participant.participantId] = {
                    isDead: participant.currentHealth <= 0,
                    isUnresolved: participant.currentHealth <= 0,
                    participantId: participant.participantId,
                };
            });
            previousFrame = frame;
            return;
        }

        const previousParticipants = getParticipantsById(previousFrame);

        currentParticipants.forEach(participant => {
            const previousParticipant = previousParticipants.get(participant.participantId);
            const existingState = playerStates[participant.participantId];
            const isCurrentlyDead = participant.currentHealth <= 0;

            if (!previousParticipant) {
                playerStates[participant.participantId] = {
                    isDead: isCurrentlyDead,
                    isUnresolved: isCurrentlyDead,
                    participantId: participant.participantId,
                };
                return;
            }

            const deathsDelta = participant.deaths - previousParticipant.deaths;
            if (deathsDelta === 1) {
                if (!isCurrentlyDead) {
                    playerStates[participant.participantId] = {
                        isDead: false,
                        isUnresolved: false,
                        participantId: participant.participantId,
                    };
                    return;
                }

                playerStates[participant.participantId] = {
                    isDead: true,
                    isUnresolved: false,
                    participantId: participant.participantId,
                    respawnAtMs: currentFrameMs + (getDisplayDeathTimerSeconds(participant.level, currentFrameMs - firstFrameMs) * 1000),
                };
                return;
            }

            if (deathsDelta > 1 || deathsDelta < 0) {
                playerStates[participant.participantId] = {
                    isDead: isCurrentlyDead,
                    isUnresolved: isCurrentlyDead,
                    participantId: participant.participantId,
                };
                return;
            }

            if (!isCurrentlyDead) {
                playerStates[participant.participantId] = {
                    isDead: false,
                    isUnresolved: false,
                    participantId: participant.participantId,
                };
                return;
            }

            playerStates[participant.participantId] = {
                isDead: true,
                isUnresolved: existingState?.isDead ? existingState.isUnresolved : true,
                participantId: participant.participantId,
                respawnAtMs: existingState?.isDead && !existingState.isUnresolved
                    ? existingState.respawnAtMs
                    : undefined,
            };
        });

        previousFrame = frame;
    });

    return playerStates;
}

export function getPlayerDeathTimerIndicators(
    lastWindowFrame: WindowFrame,
    playerDeathTimeline: Record<number, PlayerDeathState>,
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
        if (participant.currentHealth > 0) {
            return;
        }

        const deathState = playerDeathTimeline[participant.participantId];
        if (!deathState?.isDead || deathState.isUnresolved || !deathState.respawnAtMs) {
            return;
        }

        playerDeathTimers[participant.participantId] = {
            participantId: participant.participantId,
            respawnAtMs: deathState.respawnAtMs,
            status: `\u2620 ${formatRemainingTime(Math.max(0, Math.ceil((deathState.respawnAtMs - currentFrameMs) / 1000)))}`,
        };
    });

    return playerDeathTimers;
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

function getOrderedUniqueFrames(frames: WindowFrame[]) {
    const framesByTimestamp = new Map<string, WindowFrame>();
    frames.forEach(frame => {
        framesByTimestamp.set(frame.rfc460Timestamp, frame);
    });

    return Array.from(framesByTimestamp.values()).sort((leftFrame, rightFrame) => {
        const leftFrameMs = Date.parse(leftFrame.rfc460Timestamp);
        const rightFrameMs = Date.parse(rightFrame.rfc460Timestamp);

        if (Number.isNaN(leftFrameMs) && Number.isNaN(rightFrameMs)) {
            return 0;
        }

        if (Number.isNaN(leftFrameMs)) {
            return 1;
        }

        if (Number.isNaN(rightFrameMs)) {
            return -1;
        }

        return leftFrameMs - rightFrameMs;
    });
}
