import { Team, WindowFrame } from "../types/baseTypes";

const DRAGON_FIRST_SPAWN_SECONDS = 5 * 60;
const DRAGON_RESPAWN_SECONDS = 5 * 60;
const BARON_FIRST_SPAWN_SECONDS = 20 * 60;
const BARON_RESPAWN_SECONDS = 6 * 60;
const BARON_BUFF_SECONDS = 3 * 60;
const ELDER_SPAWN_SECONDS = 6 * 60;
const ELDER_RESPAWN_SECONDS = 6 * 60;
const ELDER_BUFF_SECONDS = 150;

type BuffKind = "baron" | "elder";
type BuffCertainty = "certain" | "estimated";
type TeamSide = "blue" | "red";

export type ObjectiveTimeline = {
    baronRespawnAtMs?: number;
    blueBaronBuffCertainty?: BuffCertainty;
    blueBaronBuffExpiresAtMs?: number;
    blueElderBuffCertainty?: BuffCertainty;
    blueElderBuffExpiresAtMs?: number;
    dragonRespawnAtMs?: number;
    elderRespawnAtMs?: number;
    elderSpawnAtMs?: number;
    playerBuffs?: PlayerBuffState[];
    redBaronBuffCertainty?: BuffCertainty;
    redBaronBuffExpiresAtMs?: number;
    redElderBuffCertainty?: BuffCertainty;
    redElderBuffExpiresAtMs?: number;
}

export type ObjectiveTimerNote = {
    icon: "baron" | "dragon" | "elder";
    isAlive?: boolean;
    key: string;
    label: string;
    status: string;
}

export type TeamBuffTimerNote = {
    certainty: BuffCertainty;
    icon: "baron" | "elder";
    key: string;
    label: string;
    side: TeamSide;
    status: string;
}

export type PlayerBuffIndicator = {
    certainty: BuffCertainty;
    expiresAtMs?: number;
    icon: "baron" | "elder";
    participantId: number;
}

type PlayerBuffState = PlayerBuffIndicator & {
    expiresAtMs: number;
    side: TeamSide;
}

export function buildObjectiveTimelineFromFrames(frames: WindowFrame[]) {
    const orderedFrames = getOrderedUniqueFrames(frames);
    let previousFrame: WindowFrame | null = null;
    let timeline: ObjectiveTimeline = {};

    orderedFrames.forEach(frame => {
        timeline = advanceObjectiveTimeline(previousFrame, frame, timeline);
        previousFrame = frame;
    });

    return {
        lastFrame: previousFrame,
        timeline,
    };
}

export function advanceObjectiveTimeline(previousFrame: WindowFrame | null, currentFrame: WindowFrame, currentTimeline: ObjectiveTimeline) {
    const currentFrameMs = Date.parse(currentFrame.rfc460Timestamp);
    if (Number.isNaN(currentFrameMs)) {
        return currentTimeline;
    }

    const nextTimeline = pruneExpiredObjectiveTimers(currentTimeline, currentFrameMs);
    if (!previousFrame) {
        return nextTimeline;
    }

    const previousElementalDragons = getElementalDragonCount(previousFrame);
    const currentElementalDragons = getElementalDragonCount(currentFrame);
    const currentSoulOwner = getSoulOwner(currentFrame);

    if (currentElementalDragons > previousElementalDragons) {
        if (currentSoulOwner) {
            nextTimeline.dragonRespawnAtMs = undefined;
            nextTimeline.elderRespawnAtMs = undefined;
            nextTimeline.elderSpawnAtMs = currentFrameMs + (ELDER_SPAWN_SECONDS * 1000);
        } else {
            nextTimeline.dragonRespawnAtMs = currentFrameMs + (DRAGON_RESPAWN_SECONDS * 1000);
            nextTimeline.elderSpawnAtMs = undefined;
            nextTimeline.elderRespawnAtMs = undefined;
        }
    }

    const previousBlueElders = countDragonType(previousFrame.blueTeam.dragons, 'elder');
    const currentBlueElders = countDragonType(currentFrame.blueTeam.dragons, 'elder');
    const previousRedElders = countDragonType(previousFrame.redTeam.dragons, 'elder');
    const currentRedElders = countDragonType(currentFrame.redTeam.dragons, 'elder');

    if (currentBlueElders > previousBlueElders) {
        nextTimeline.elderSpawnAtMs = undefined;
        nextTimeline.elderRespawnAtMs = currentFrameMs + (ELDER_RESPAWN_SECONDS * 1000);
        nextTimeline.blueElderBuffExpiresAtMs = currentFrameMs + (ELDER_BUFF_SECONDS * 1000);
        nextTimeline.blueElderBuffCertainty = "certain";
        nextTimeline.redElderBuffExpiresAtMs = undefined;
        nextTimeline.redElderBuffCertainty = undefined;
        nextTimeline.playerBuffs = updateObjectivePlayerBuffs(
            nextTimeline.playerBuffs,
            currentFrame.blueTeam.participants,
            "blue",
            "elder",
            currentFrameMs + (ELDER_BUFF_SECONDS * 1000),
        );
    }

    if (currentRedElders > previousRedElders) {
        nextTimeline.elderSpawnAtMs = undefined;
        nextTimeline.elderRespawnAtMs = currentFrameMs + (ELDER_RESPAWN_SECONDS * 1000);
        nextTimeline.redElderBuffExpiresAtMs = currentFrameMs + (ELDER_BUFF_SECONDS * 1000);
        nextTimeline.redElderBuffCertainty = "certain";
        nextTimeline.blueElderBuffExpiresAtMs = undefined;
        nextTimeline.blueElderBuffCertainty = undefined;
        nextTimeline.playerBuffs = updateObjectivePlayerBuffs(
            nextTimeline.playerBuffs,
            currentFrame.redTeam.participants,
            "red",
            "elder",
            currentFrameMs + (ELDER_BUFF_SECONDS * 1000),
        );
    }

    if (currentFrame.blueTeam.barons > previousFrame.blueTeam.barons) {
        nextTimeline.baronRespawnAtMs = currentFrameMs + (BARON_RESPAWN_SECONDS * 1000);
        nextTimeline.blueBaronBuffExpiresAtMs = currentFrameMs + (BARON_BUFF_SECONDS * 1000);
        nextTimeline.blueBaronBuffCertainty = "certain";
        nextTimeline.redBaronBuffExpiresAtMs = undefined;
        nextTimeline.redBaronBuffCertainty = undefined;
        nextTimeline.playerBuffs = updateObjectivePlayerBuffs(
            nextTimeline.playerBuffs,
            currentFrame.blueTeam.participants,
            "blue",
            "baron",
            currentFrameMs + (BARON_BUFF_SECONDS * 1000),
        );
    }

    if (currentFrame.redTeam.barons > previousFrame.redTeam.barons) {
        nextTimeline.baronRespawnAtMs = currentFrameMs + (BARON_RESPAWN_SECONDS * 1000);
        nextTimeline.redBaronBuffExpiresAtMs = currentFrameMs + (BARON_BUFF_SECONDS * 1000);
        nextTimeline.redBaronBuffCertainty = "certain";
        nextTimeline.blueBaronBuffExpiresAtMs = undefined;
        nextTimeline.blueBaronBuffCertainty = undefined;
        nextTimeline.playerBuffs = updateObjectivePlayerBuffs(
            nextTimeline.playerBuffs,
            currentFrame.redTeam.participants,
            "red",
            "baron",
            currentFrameMs + (BARON_BUFF_SECONDS * 1000),
        );
    }

    nextTimeline.playerBuffs = removeLostPlayerBuffs(
        nextTimeline.playerBuffs,
        previousFrame.blueTeam.participants,
        currentFrame.blueTeam.participants,
        "blue",
        currentFrameMs,
    );
    nextTimeline.playerBuffs = removeLostPlayerBuffs(
        nextTimeline.playerBuffs,
        previousFrame.redTeam.participants,
        currentFrame.redTeam.participants,
        "red",
        currentFrameMs,
    );

    return nextTimeline;
}

export function getObjectiveTimerNotes(
    firstWindowFrame: WindowFrame,
    lastWindowFrame: WindowFrame,
    objectiveTimeline: ObjectiveTimeline,
    blueTeam: Team,
    redTeam: Team,
    currentDisplayFrameMs?: number,
) {
    const fallbackFrameMs = Date.parse(lastWindowFrame.rfc460Timestamp);
    const currentFrameMs = currentDisplayFrameMs ?? fallbackFrameMs;
    const firstFrameMs = Date.parse(firstWindowFrame.rfc460Timestamp);
    if (Number.isNaN(currentFrameMs) || Number.isNaN(firstFrameMs)) {
        return [];
    }

    const inGameSeconds = Math.max(0, Math.floor((currentFrameMs - firstFrameMs) / 1000));
    const soulOwner = getSoulOwner(lastWindowFrame);
    const notes: ObjectiveTimerNote[] = [];

    if (lastWindowFrame.gameState !== 'finished') {
        if (!soulOwner) {
            if (inGameSeconds < DRAGON_FIRST_SPAWN_SECONDS) {
                notes.push({
                    icon: 'dragon',
                    key: 'dragon',
                    label: 'Dragon',
                    status: formatRemainingTime(DRAGON_FIRST_SPAWN_SECONDS - inGameSeconds),
                });
            } else if (objectiveTimeline.dragonRespawnAtMs && objectiveTimeline.dragonRespawnAtMs > currentFrameMs) {
                notes.push({
                    icon: 'dragon',
                    key: 'dragon',
                    label: 'Dragon',
                    status: formatRemainingTime(Math.ceil((objectiveTimeline.dragonRespawnAtMs - currentFrameMs) / 1000)),
                });
            } else {
                notes.push({
                    icon: 'dragon',
                    isAlive: true,
                    key: 'dragon',
                    label: 'Dragon',
                    status: 'ALIVE',
                });
            }
        } else {
            const elderTimerTargetMs = getCurrentElderTimerTargetMs(
                firstFrameMs,
                lastWindowFrame,
                objectiveTimeline,
                currentFrameMs,
            );

            if (elderTimerTargetMs) {
                notes.push({
                    icon: 'elder',
                    key: 'elder',
                    label: 'Elder',
                    status: formatRemainingTime(Math.ceil((elderTimerTargetMs - currentFrameMs) / 1000)),
                });
            } else {
                notes.push({
                    icon: 'elder',
                    isAlive: true,
                    key: 'elder',
                    label: 'Elder',
                    status: 'ALIVE',
                });
            }
        }

        if (inGameSeconds < BARON_FIRST_SPAWN_SECONDS) {
            notes.push({
                icon: 'baron',
                key: 'baron',
                label: 'Baron',
                status: formatRemainingTime(BARON_FIRST_SPAWN_SECONDS - inGameSeconds),
            });
        } else if (objectiveTimeline.baronRespawnAtMs && objectiveTimeline.baronRespawnAtMs > currentFrameMs) {
            notes.push({
                icon: 'baron',
                key: 'baron',
                label: 'Baron',
                status: formatRemainingTime(Math.ceil((objectiveTimeline.baronRespawnAtMs - currentFrameMs) / 1000)),
            });
        } else {
            notes.push({
                icon: 'baron',
                isAlive: true,
                key: 'baron',
                label: 'Baron',
                status: 'ALIVE',
            });
        }
    }

    return notes;
}

export function getTeamBuffTimerNotes(
    firstWindowFrame: WindowFrame,
    lastWindowFrame: WindowFrame,
    objectiveTimeline: ObjectiveTimeline,
    blueTeam: Team,
    redTeam: Team,
    currentDisplayFrameMs?: number,
) {
    if (lastWindowFrame.gameState === "finished") {
        return { blue: [], red: [] } as Record<TeamSide, TeamBuffTimerNote[]>;
    }

    const fallbackFrameMs = Date.parse(lastWindowFrame.rfc460Timestamp);
    const currentFrameMs = currentDisplayFrameMs ?? fallbackFrameMs;
    const firstFrameMs = Date.parse(firstWindowFrame.rfc460Timestamp);
    if (Number.isNaN(currentFrameMs) || Number.isNaN(firstFrameMs)) {
        return { blue: [], red: [] } as Record<TeamSide, TeamBuffTimerNote[]>;
    }

    const inGameSeconds = Math.max(0, Math.floor((currentFrameMs - firstFrameMs) / 1000));
    const soulClinchElementalDragonCount = getSoulClinchElementalDragonCount(lastWindowFrame);
    const blueNotes = [
        getObservedTeamBuffTimerNote("blue", "baron", blueTeam, objectiveTimeline.blueBaronBuffExpiresAtMs, objectiveTimeline.blueBaronBuffCertainty, currentFrameMs),
        getObservedTeamBuffTimerNote("blue", "elder", blueTeam, objectiveTimeline.blueElderBuffExpiresAtMs, objectiveTimeline.blueElderBuffCertainty, currentFrameMs),
    ].filter(Boolean) as TeamBuffTimerNote[];
    const redNotes = [
        getObservedTeamBuffTimerNote("red", "baron", redTeam, objectiveTimeline.redBaronBuffExpiresAtMs, objectiveTimeline.redBaronBuffCertainty, currentFrameMs),
        getObservedTeamBuffTimerNote("red", "elder", redTeam, objectiveTimeline.redElderBuffExpiresAtMs, objectiveTimeline.redElderBuffCertainty, currentFrameMs),
    ].filter(Boolean) as TeamBuffTimerNote[];

    if (!blueNotes.some(note => note.icon === "baron")) {
        const estimatedBlueBaron = getEstimatedTeamBuffTimerNote("blue", "baron", blueTeam, lastWindowFrame.blueTeam.barons, inGameSeconds);
        if (estimatedBlueBaron) {
            blueNotes.push(estimatedBlueBaron);
        }
    }

    if (!redNotes.some(note => note.icon === "baron")) {
        const estimatedRedBaron = getEstimatedTeamBuffTimerNote("red", "baron", redTeam, lastWindowFrame.redTeam.barons, inGameSeconds);
        if (estimatedRedBaron) {
            redNotes.push(estimatedRedBaron);
        }
    }

    const blueElderCount = countDragonType(lastWindowFrame.blueTeam.dragons, "elder");
    const redElderCount = countDragonType(lastWindowFrame.redTeam.dragons, "elder");
    if (!blueNotes.some(note => note.icon === "elder")) {
        const estimatedBlueElder = getEstimatedTeamBuffTimerNote("blue", "elder", blueTeam, blueElderCount, inGameSeconds, soulClinchElementalDragonCount);
        if (estimatedBlueElder) {
            blueNotes.push(estimatedBlueElder);
        }
    }

    if (!redNotes.some(note => note.icon === "elder")) {
        const estimatedRedElder = getEstimatedTeamBuffTimerNote("red", "elder", redTeam, redElderCount, inGameSeconds, soulClinchElementalDragonCount);
        if (estimatedRedElder) {
            redNotes.push(estimatedRedElder);
        }
    }

    return {
        blue: blueNotes,
        red: redNotes,
    };
}

export function getPlayerBuffIndicators(
    firstWindowFrame: WindowFrame,
    lastWindowFrame: WindowFrame,
    objectiveTimeline: ObjectiveTimeline,
    currentDisplayFrameMs?: number,
) {
    if (lastWindowFrame.gameState === "finished") {
        return {} as Record<number, PlayerBuffIndicator[]>;
    }

    const fallbackFrameMs = Date.parse(lastWindowFrame.rfc460Timestamp);
    const currentFrameMs = currentDisplayFrameMs ?? fallbackFrameMs;
    const firstFrameMs = Date.parse(firstWindowFrame.rfc460Timestamp);
    if (Number.isNaN(currentFrameMs) || Number.isNaN(firstFrameMs)) {
        return {} as Record<number, PlayerBuffIndicator[]>;
    }

    const inGameSeconds = Math.max(0, Math.floor((currentFrameMs - firstFrameMs) / 1000));
    const soulClinchElementalDragonCount = getSoulClinchElementalDragonCount(lastWindowFrame);
    const playerBuffs: Record<number, PlayerBuffIndicator[]> = {};

    (objectiveTimeline.playerBuffs || []).forEach(buff => {
        if (buff.expiresAtMs > currentFrameMs) {
            playerBuffs[buff.participantId] = [...(playerBuffs[buff.participantId] || []), {
                certainty: buff.certainty,
                expiresAtMs: buff.expiresAtMs,
                icon: buff.icon,
                participantId: buff.participantId,
            }];
        }
    });

    addEstimatedPlayerBuffs(
        playerBuffs,
        lastWindowFrame.blueTeam.participants,
        "baron",
        objectiveTimeline.blueBaronBuffExpiresAtMs,
        lastWindowFrame.blueTeam.barons,
        inGameSeconds,
    );
    addEstimatedPlayerBuffs(
        playerBuffs,
        lastWindowFrame.redTeam.participants,
        "baron",
        objectiveTimeline.redBaronBuffExpiresAtMs,
        lastWindowFrame.redTeam.barons,
        inGameSeconds,
    );
    addEstimatedPlayerBuffs(
        playerBuffs,
        lastWindowFrame.blueTeam.participants,
        "elder",
        objectiveTimeline.blueElderBuffExpiresAtMs,
        countDragonType(lastWindowFrame.blueTeam.dragons, "elder"),
        inGameSeconds,
        soulClinchElementalDragonCount,
    );
    addEstimatedPlayerBuffs(
        playerBuffs,
        lastWindowFrame.redTeam.participants,
        "elder",
        objectiveTimeline.redElderBuffExpiresAtMs,
        countDragonType(lastWindowFrame.redTeam.dragons, "elder"),
        inGameSeconds,
        soulClinchElementalDragonCount,
    );

    return playerBuffs;
}

function pruneExpiredObjectiveTimers(timeline: ObjectiveTimeline, currentFrameMs: number) {
    const nextTimeline = { ...timeline };

    (Object.keys(nextTimeline) as Array<keyof ObjectiveTimeline>).forEach(key => {
        const value = nextTimeline[key];
        if (typeof value === "number" && value <= currentFrameMs) {
            nextTimeline[key] = undefined;
        }
    });

    nextTimeline.playerBuffs = (nextTimeline.playerBuffs || []).filter(playerBuff => playerBuff.expiresAtMs > currentFrameMs);

    return nextTimeline;
}

function getElementalDragonCount(frame: WindowFrame) {
    return getElementalDragonCountForSide(frame, "blue")
        + getElementalDragonCountForSide(frame, "red");
}

function getElementalDragonCountForSide(frame: WindowFrame, side: TeamSide) {
    const dragons = side === "blue" ? frame.blueTeam.dragons : frame.redTeam.dragons;
    return dragons.filter(dragon => dragon !== 'elder').length;
}

function getSoulOwner(frame: WindowFrame) {
    if (getElementalDragonCountForSide(frame, "blue") >= 4) {
        return "blue" as const;
    }

    if (getElementalDragonCountForSide(frame, "red") >= 4) {
        return "red" as const;
    }

    return undefined;
}

function getSoulClinchElementalDragonCount(frame: WindowFrame) {
    if (!getSoulOwner(frame)) {
        return undefined;
    }

    return getElementalDragonCount(frame);
}

function countDragonType(dragons: string[], dragonType: string) {
    return dragons.filter(dragon => dragon === dragonType).length;
}

function getCurrentElderTimerTargetMs(
    firstFrameMs: number,
    lastWindowFrame: WindowFrame,
    objectiveTimeline: ObjectiveTimeline,
    currentFrameMs: number,
) {
    if (objectiveTimeline.elderSpawnAtMs && objectiveTimeline.elderSpawnAtMs > currentFrameMs) {
        return objectiveTimeline.elderSpawnAtMs;
    }

    if (objectiveTimeline.elderRespawnAtMs && objectiveTimeline.elderRespawnAtMs > currentFrameMs) {
        return objectiveTimeline.elderRespawnAtMs;
    }

    const derivedElderTargetSeconds = getDerivedElderTargetSeconds(lastWindowFrame);
    if (derivedElderTargetSeconds === undefined) {
        return undefined;
    }

    const derivedElderTargetMs = firstFrameMs + (derivedElderTargetSeconds * 1000);
    return derivedElderTargetMs > currentFrameMs ? derivedElderTargetMs : undefined;
}

function getDerivedElderTargetSeconds(frame: WindowFrame) {
    const soulClinchElementalDragonCount = getSoulClinchElementalDragonCount(frame);
    if (!soulClinchElementalDragonCount) {
        return undefined;
    }

    const elderObjectiveCount = countDragonType(frame.blueTeam.dragons, "elder") + countDragonType(frame.redTeam.dragons, "elder");
    return getFirstElderSpawnSeconds(soulClinchElementalDragonCount) + (elderObjectiveCount * ELDER_RESPAWN_SECONDS);
}

function updateObjectivePlayerBuffs(
    playerBuffs: PlayerBuffState[] | undefined,
    participants: WindowFrame["blueTeam"]["participants"],
    side: TeamSide,
    kind: BuffKind,
    expiresAtMs: number,
) {
    const remainingBuffs = (playerBuffs || []).filter(playerBuff => !(playerBuff.side === side && playerBuff.icon === kind));
    const nextBuffs = participants
        .filter(participant => participant.currentHealth > 0)
        .map(participant => ({
            certainty: "certain" as const,
            expiresAtMs,
            icon: kind,
            participantId: participant.participantId,
            side,
        }));

    return [...remainingBuffs, ...nextBuffs];
}

function removeLostPlayerBuffs(
    playerBuffs: PlayerBuffState[] | undefined,
    previousParticipants: WindowFrame["blueTeam"]["participants"],
    currentParticipants: WindowFrame["blueTeam"]["participants"],
    side: TeamSide,
    currentFrameMs: number,
) {
    if (!playerBuffs?.length) {
        return playerBuffs;
    }

    const nextBuffs = (playerBuffs || []).filter(playerBuff => {
        if (playerBuff.side !== side || playerBuff.expiresAtMs <= currentFrameMs) {
            return playerBuff.expiresAtMs > currentFrameMs;
        }

        const previousParticipant = previousParticipants.find(participant => participant.participantId === playerBuff.participantId);
        const currentParticipant = currentParticipants.find(participant => participant.participantId === playerBuff.participantId);
        if (!currentParticipant) {
            return false;
        }

        const diedThisFrame = previousParticipant
            ? (currentParticipant.deaths > previousParticipant.deaths
                || (previousParticipant.currentHealth > 0 && currentParticipant.currentHealth <= 0))
            : false;

        if (currentParticipant.currentHealth <= 0 || diedThisFrame) {
            return false;
        }

        return true;
    });

    return nextBuffs;
}

function getObservedTeamBuffTimerNote(
    side: TeamSide,
    kind: BuffKind,
    team: Team,
    expiresAtMs: number | undefined,
    certainty: BuffCertainty | undefined,
    currentFrameMs: number,
) {
    if (!expiresAtMs || expiresAtMs <= currentFrameMs || !certainty) {
        return undefined;
    }

    return {
        certainty,
        icon: kind,
        key: `${side}-${kind}-buff`,
        label: `${getTeamTimerLabel(team)} ${kind === "baron" ? "Baron Buff" : "Elder Buff"}`,
        side,
        status: formatRemainingTime(Math.ceil((expiresAtMs - currentFrameMs) / 1000)),
    };
}

function getEstimatedTeamBuffTimerNote(
    side: TeamSide,
    kind: BuffKind,
    team: Team,
    objectiveCount: number,
    inGameSeconds: number,
    soulClinchElementalDragonCount?: number,
) {
    if (objectiveCount < 1) {
        return undefined;
    }

    const guaranteedExpirySeconds = getGuaranteedBuffExpirySeconds(kind, objectiveCount, soulClinchElementalDragonCount);
    if (!guaranteedExpirySeconds || guaranteedExpirySeconds <= inGameSeconds) {
        return undefined;
    }

    return {
        certainty: "estimated" as const,
        icon: kind,
        key: `${side}-${kind}-buff-estimated`,
        label: `${getTeamTimerLabel(team)} ${kind === "baron" ? "Baron Buff" : "Elder Buff"}`,
        side,
        status: `~${formatRemainingTime(guaranteedExpirySeconds - inGameSeconds)}`,
    };
}

function addEstimatedPlayerBuffs(
    playerBuffs: Record<number, PlayerBuffIndicator[]>,
    participants: WindowFrame["blueTeam"]["participants"],
    kind: BuffKind,
    exactTeamExpiresAtMs: number | undefined,
    objectiveCount: number,
    inGameSeconds: number,
    soulClinchElementalDragonCount?: number,
) {
    if (exactTeamExpiresAtMs || objectiveCount < 1) {
        return;
    }

    const guaranteedExpirySeconds = getGuaranteedBuffExpirySeconds(kind, objectiveCount, soulClinchElementalDragonCount);
    if (!guaranteedExpirySeconds || guaranteedExpirySeconds <= inGameSeconds) {
        return;
    }

    participants.forEach(participant => {
        if (participant.currentHealth <= 0) {
            return;
        }

        const existingBuffKinds = new Set((playerBuffs[participant.participantId] || []).map(playerBuff => playerBuff.icon));
        if (existingBuffKinds.has(kind)) {
            return;
        }

        playerBuffs[participant.participantId] = [
            ...(playerBuffs[participant.participantId] || []),
            {
                certainty: "estimated",
                icon: kind,
                participantId: participant.participantId,
            },
        ];
    });
}

function getGuaranteedBuffExpirySeconds(kind: BuffKind, objectiveCount: number, soulClinchElementalDragonCount?: number) {
    if (kind === "baron") {
        return BARON_FIRST_SPAWN_SECONDS + ((objectiveCount - 1) * BARON_RESPAWN_SECONDS) + BARON_BUFF_SECONDS;
    }

    if (!soulClinchElementalDragonCount) {
        return undefined;
    }

    const firstElderTakeSeconds = getFirstElderSpawnSeconds(soulClinchElementalDragonCount);
    return firstElderTakeSeconds + ((objectiveCount - 1) * ELDER_RESPAWN_SECONDS) + ELDER_BUFF_SECONDS;
}

function getFirstElderSpawnSeconds(soulClinchElementalDragonCount: number) {
    return DRAGON_FIRST_SPAWN_SECONDS + ((soulClinchElementalDragonCount - 1) * DRAGON_RESPAWN_SECONDS) + ELDER_SPAWN_SECONDS;
}

function formatRemainingTime(totalSeconds: number) {
    const safeSeconds = Math.max(0, totalSeconds);
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getTeamTimerLabel(team: Team) {
    return team.code || team.name;
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
