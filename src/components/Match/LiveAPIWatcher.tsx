import './styles/playerStatusStyle.css'

import { GameMetadata, Team, WindowFrame, WindowParticipant } from "../types/baseTypes";

import { useEffect, useState } from "react";
import { ToastContainer, toast } from 'react-toastify';
import useSound from "use-sound";
import { logLivePerf } from "../../utils/livePerf";

const firstblood = require("../../assets/audios/first_blood.ogg");
const kill = require("../../assets/audios/champion_slain.ogg");
const tower_blue = require("../../assets/audios/blue_turret_destroyed.ogg");
const tower_red = require("../../assets/audios/red_turret_destroyed.ogg");
const dragon_blue = require("../../assets/audios/blue_dragon_slain.ogg");
const dragon_red = require("../../assets/audios/red_dragon_slain.ogg");
const baron_blue = require("../../assets/audios/blue_baron_slain.ogg");
const baron_red = require("../../assets/audios/red_baron_slain.ogg");
const inib_blue = require("../../assets/audios/blue_inhibitor_destroyed.ogg");
const inib_red = require("../../assets/audios/red_inhibitor_destroyed.ogg");

type Props = {
    lastWindowFrame: WindowFrame,
    gameIndex: number,
    gameMetadata: GameMetadata,
    championsUrlWithPatchVersion: string,
    blueTeam: Team,
    redTeam: Team,
}

type StatusWatcher = {
    inhibitors: {
        blue: number,
        red: number
    }
    dragons: {
        blue: number,
        red: number
    }
    towers: {
        blue: number,
        red: number
    }
    barons: {
        blue: number,
        red: number
    }
    participants: {
        blue: WindowParticipant[]
        red: WindowParticipant[]
    }
    gameIndex: number
}

type KillDelta = {
    count: number;
    participantId: number;
}

type KillToast = {
    diff: number;
    image: string;
    message: string;
}

const NOTIFICATION_PLAYBACK_RATE = 1.25;

export function LiveAPIWatcher({ lastWindowFrame, gameIndex, gameMetadata, championsUrlWithPatchVersion, blueTeam, redTeam }: Props) {
    let trueBlueTeam = blueTeam
    let trueRedTeam = redTeam
    let swapTeams = blueTeam.id !== gameMetadata.blueTeamMetadata.esportsTeamId
    if (swapTeams) {
        trueBlueTeam = redTeam
        trueRedTeam = blueTeam
    }

    const [status, setStatus] = useState<StatusWatcher>({
        dragons: { blue: lastWindowFrame.blueTeam.dragons.length, red: lastWindowFrame.redTeam.dragons.length },
        gameIndex: gameIndex,
        inhibitors: { blue: lastWindowFrame.blueTeam.inhibitors, red: lastWindowFrame.redTeam.inhibitors },
        towers: { blue: lastWindowFrame.blueTeam.towers, red: lastWindowFrame.redTeam.towers },
        barons: { blue: lastWindowFrame.blueTeam.barons, red: lastWindowFrame.redTeam.barons },
        participants: { blue: lastWindowFrame.blueTeam.participants, red: lastWindowFrame.redTeam.participants }
    })

    const [firstBloodPlay] = useSound(firstblood);
    // const [initialized, setInitialized] = useState<Boolean>(false);

    useEffect(() => {
        logLivePerf('notification_scan', {
            frameTimestamp: lastWindowFrame.rfc460Timestamp,
            gameIndex,
        });
        const soundData = localStorage.getItem("sound");
        let isMuted = false;
        if (soundData) {
            if (soundData === "mute") {
                isMuted = true;
            } else if (soundData === "unmute") {
                isMuted = false;
            }
        }

        // Topo = prioridade para o som
        let isPlaying = isMuted;
        let toastArray = []

        if (status.gameIndex === gameIndex) {
            if (status.inhibitors.blue !== lastWindowFrame.blueTeam.inhibitors) {
                toastArray.push(() => { createToast(true, isPlaying, inib_red.default, "Destroyed an inhibitor", trueBlueTeam.image, trueBlueTeam.name) })
                isPlaying = true
            }

            if (status.inhibitors.red !== lastWindowFrame.redTeam.inhibitors) {
                toastArray.push(() => { createToast(false, isPlaying, inib_blue.default, "Destroyed an inhibitor", trueRedTeam.image, trueRedTeam.name) })
                isPlaying = true
            }

            if (status.barons.blue !== lastWindowFrame.blueTeam.barons) {
                toastArray.push(() => { createToast(true, isPlaying, baron_blue.default, "Defeated the baron", trueBlueTeam.image, trueBlueTeam.name) })
                isPlaying = true
            }

            if (status.barons.red !== lastWindowFrame.redTeam.barons) {
                toastArray.push(() => { createToast(false, isPlaying, baron_red.default, "Defeated the baron", trueRedTeam.image, trueRedTeam.name) })
                isPlaying = true
            }

            const blueDragonMessage = getDragonMessage(status.dragons.blue, lastWindowFrame.blueTeam.dragons)
            if (blueDragonMessage) {
                toastArray.push(() => { createToast(true, isPlaying, dragon_blue.default, blueDragonMessage, trueBlueTeam.image, trueBlueTeam.name) })
                isPlaying = true
            }

            const redDragonMessage = getDragonMessage(status.dragons.red, lastWindowFrame.redTeam.dragons)
            if (redDragonMessage) {
                toastArray.push(() => { createToast(false, isPlaying, dragon_red.default, redDragonMessage, trueRedTeam.image, trueRedTeam.name) })
                isPlaying = true
            }

            if (status.towers.blue !== lastWindowFrame.blueTeam.towers) {
                toastArray.push(() => { createToast(true, isPlaying, tower_red.default, "Destroyed a turret", trueBlueTeam.image, trueBlueTeam.name) })
                isPlaying = true
            }

            if (status.towers.red !== lastWindowFrame.redTeam.towers) {
                toastArray.push(() => { createToast(false, isPlaying, tower_blue.default, "Destroyed a turret", trueRedTeam.image, trueRedTeam.name) })
                isPlaying = true
            }

            const blueKillToasts = getKillToasts(
                status.participants.blue,
                lastWindowFrame.blueTeam.participants,
                status.participants.red,
                lastWindowFrame.redTeam.participants,
                gameMetadata.blueTeamMetadata.participantMetadata,
                gameMetadata.redTeamMetadata.participantMetadata,
                championsUrlWithPatchVersion,
                trueBlueTeam.image,
                true,
            );
            blueKillToasts.forEach(killToast => {
                toastArray.push(() => { createToast(true, isPlaying, kill.default, killToast.message, killToast.image, trueBlueTeam.name, killToast.diff) })
                isPlaying = true
            })

            const redKillToasts = getKillToasts(
                status.participants.red,
                lastWindowFrame.redTeam.participants,
                status.participants.blue,
                lastWindowFrame.blueTeam.participants,
                gameMetadata.redTeamMetadata.participantMetadata,
                gameMetadata.blueTeamMetadata.participantMetadata,
                championsUrlWithPatchVersion,
                trueRedTeam.image,
                false,
            );
            redKillToasts.forEach(killToast => {
                toastArray.push(() => { createToast(false, isPlaying, kill.default, killToast.message, killToast.image, trueRedTeam.name, killToast.diff) })
                isPlaying = true
            })
        }

        setStatus({
            dragons: { blue: lastWindowFrame.blueTeam.dragons.length, red: lastWindowFrame.redTeam.dragons.length },
            gameIndex: gameIndex,
            inhibitors: { blue: lastWindowFrame.blueTeam.inhibitors, red: lastWindowFrame.redTeam.inhibitors },
            towers: { blue: lastWindowFrame.blueTeam.towers, red: lastWindowFrame.redTeam.towers },
            barons: { blue: lastWindowFrame.blueTeam.barons, red: lastWindowFrame.redTeam.barons },
            participants: { blue: lastWindowFrame.blueTeam.participants, red: lastWindowFrame.redTeam.participants },
        })

        toastArray.forEach(toastFunction => toastFunction())

    }, [lastWindowFrame.blueTeam.totalKills, lastWindowFrame.blueTeam.dragons.length, lastWindowFrame.blueTeam.inhibitors, lastWindowFrame.redTeam.totalKills, lastWindowFrame.redTeam.dragons.length, lastWindowFrame.redTeam.inhibitors, firstBloodPlay, status.dragons.blue, status.dragons.red, status.barons.blue, status.barons.red, status.inhibitors.blue, status.inhibitors.red, status.towers.blue, status.towers.red, status.participants.blue, status.participants.red, lastWindowFrame.blueTeam.barons, lastWindowFrame.blueTeam.towers, lastWindowFrame.blueTeam.participants, lastWindowFrame.redTeam.barons, lastWindowFrame.redTeam.towers, lastWindowFrame.redTeam.participants, gameMetadata.blueTeamMetadata.participantMetadata, gameMetadata.redTeamMetadata.participantMetadata, trueBlueTeam.image, trueBlueTeam.name, trueRedTeam.image, trueRedTeam.name]);

    return (
        <ToastContainer limit={10}/>
    );
}

function createToast(blueTeam: boolean, soundIsPlaying: boolean, sound: string, message: string, image: string, imageAlt: string, diff?: number) {
    if (!soundIsPlaying) {
        let audio = new Audio(sound);
        audio.load();
        audio.volume = 0.20;
        audio.playbackRate = NOTIFICATION_PLAYBACK_RATE;
        logLivePerf('notification_audio_play', {
            image,
            message,
            playbackRate: NOTIFICATION_PLAYBACK_RATE,
        });
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => undefined);
        }
    }

    let toastId = `${blueTeam}_${image}_${message}_${diff}`;
    logLivePerf('notification_toast_enqueued', {
        blueTeam,
        diff,
        image,
        message,
        toastId,
    });
    if (blueTeam) {
        toast.info(
            <div className="toast-watcher">
                <img className="toast-image" src={image} alt={imageAlt} />
                <h4 className="toast-message">{message}</h4>
            </div>
            , {
                pauseOnHover: false,
                pauseOnFocusLoss: false,
                position: toast.POSITION.TOP_LEFT,
                toastId: toastId,
            }
        )
    } else {
        toast.error(
            <div className="toast-watcher">
                <img className="toast-image" src={image} alt={imageAlt} />
                <h4 className="toast-message">{message}</h4>
            </div>
            , {
                pauseOnHover: false,
                pauseOnFocusLoss: false,
                position: toast.POSITION.TOP_RIGHT,
                toastId: toastId,
            }
        )
    }
}

function getKillToasts(
    previousKillSide: WindowParticipant[],
    nextKillSide: WindowParticipant[],
    previousVictimSide: WindowParticipant[],
    nextVictimSide: WindowParticipant[],
    killerMetadata: GameMetadata["blueTeamMetadata"]["participantMetadata"],
    victimMetadata: GameMetadata["blueTeamMetadata"]["participantMetadata"],
    championsUrlWithPatchVersion: string,
    fallbackImage: string,
    blueTeam: boolean,
): KillToast[] {
    const killers = getIncreasedStatParticipants(previousKillSide, nextKillSide, `kills`);
    const victims = getIncreasedStatParticipants(previousVictimSide, nextVictimSide, `deaths`);

    if (!killers.length) {
        return []
    }

    if (killers.length === 1 && victims.length === 1) {
        return [{
            diff: killers[0].count,
            image: getParticipantImage(killers[0].participantId, killerMetadata, championsUrlWithPatchVersion) || fallbackImage,
            message: `Killed ${getParticipantDisplayName(victims[0].participantId, victimMetadata)}`,
        }]
    }

    if (killers.length === 1 && victims.length > 1) {
        const victimNames = victims.map(victim => getParticipantDisplayName(victim.participantId, victimMetadata));
        if (victimNames.length === 2) {
            return [{
                diff: killers[0].count,
                image: getParticipantImage(killers[0].participantId, killerMetadata, championsUrlWithPatchVersion) || fallbackImage,
                message: `Killed ${victimNames[0]} and ${victimNames[1]}`,
            }]
        }

        return [{
            diff: killers[0].count,
            image: getParticipantImage(killers[0].participantId, killerMetadata, championsUrlWithPatchVersion) || fallbackImage,
            message: `Killed ${victimNames.length} enemies`,
        }]
    }

    const totalVictimDeaths = victims.reduce((sum, victim) => sum + victim.count, 0);
    if (totalVictimDeaths > 1) {
        return [{
            diff: totalVictimDeaths,
            image: fallbackImage,
            message: `${blueTeam ? `Blue` : `Red`} team got ${totalVictimDeaths} kills`,
        }]
    }

    return killers.map(killer => ({
        diff: killer.count,
        image: getParticipantImage(killer.participantId, killerMetadata, championsUrlWithPatchVersion) || fallbackImage,
        message: "Killed an enemy",
    }))
}

function getIncreasedStatParticipants(
    previousParticipants: WindowParticipant[],
    nextParticipants: WindowParticipant[],
    stat: `kills` | `deaths`,
) {
    const deltas: KillDelta[] = [];

    for (let i = 0; i < previousParticipants.length; i++) {
        const previousValue = previousParticipants[i][stat];
        const nextValue = nextParticipants[i][stat];
        if (nextValue > previousValue) {
            deltas.push({
                count: nextValue - previousValue,
                participantId: nextParticipants[i].participantId,
            });
        }
    }

    return deltas
}

function getParticipantDisplayName(
    participantId: number,
    metadata: GameMetadata["blueTeamMetadata"]["participantMetadata"],
) {
    return metadata.find(participant => participant.participantId === participantId)?.championId || `an enemy`
}

function getParticipantImage(
    participantId: number,
    metadata: GameMetadata["blueTeamMetadata"]["participantMetadata"],
    championsUrlWithPatchVersion: string,
) {
    const championId = metadata.find(participant => participant.participantId === participantId)?.championId;
    return championId ? `${championsUrlWithPatchVersion}${championId}.png` : undefined
}

function getDragonMessage(previousDragonCount: number, dragons: string[]) {
    if (dragons.length <= previousDragonCount) {
        return undefined
    }

    const newestDragon = dragons[dragons.length - 1];
    if (!newestDragon) {
        return "Defeated the dragon"
    }

    return `Defeated the ${newestDragon} dragon`
}
