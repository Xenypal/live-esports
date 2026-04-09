import './styles/playerStatusStyle.css'
import '../Schedule/styles/scheduleStyle.css'

import { GameDetails } from "./GameDetails"
import { MiniHealthBar } from "./MiniHealthBar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from 'react-toastify';
import { DetailsFrame, EventDetails, GameMetadata, ItemDictionary, Outcome, Participant, Record, Result, TeamStats, WindowFrame, WindowParticipant, Rune, SlottedRune } from "../types/baseTypes";

import { ReactComponent as TowerSVG } from '../../assets/images/tower.svg';
import { ReactComponent as BaronSVG } from '../../assets/images/baron.svg';
import { ReactComponent as KillSVG } from '../../assets/images/kill.svg';
import { ReactComponent as GoldSVG } from '../../assets/images/gold.svg';
import { ReactComponent as InhibitorSVG } from '../../assets/images/inhibitor.svg';
import { ReactComponent as TeamTBDSVG } from '../../assets/images/team-tbd.svg';

import { ReactComponent as OceanDragonSVG } from '../../assets/images/dragon-ocean.svg';
import { ReactComponent as ChemtechDragonSVG } from '../../assets/images/dragon-chemtech.svg';
import { ReactComponent as HextechDragonSVG } from '../../assets/images/dragon-hextech.svg';
import { ReactComponent as InfernalDragonSVG } from '../../assets/images/dragon-infernal.svg';
import { ReactComponent as CloudDragonSVG } from '../../assets/images/dragon-cloud.svg';
import { ReactComponent as MountainDragonSVG } from '../../assets/images/dragon-mountain.svg';
import { ReactComponent as ElderDragonSVG } from '../../assets/images/dragon-elder.svg';
import { ItemsDisplay } from "./ItemsDisplay";

import { LiveAPIWatcher } from "./LiveAPIWatcher";
import { CHAMPIONS_URL, getFormattedPatchVersion } from '../../utils/LoLEsportsAPI';
import { getFrameFreshnessContext, logLivePerf } from "../../utils/livePerf";
import { advanceObjectiveTimeline, getObjectiveTimerNotes, getPlayerBuffIndicators, getTeamBuffTimerNotes, ObjectiveTimeline, PlayerBuffIndicator } from "./objectiveTimers";

type Props = {
    firstWindowFrame: WindowFrame,
    lastWindowFrame: WindowFrame,
    lastDetailsFrame?: DetailsFrame,
    finishedWinner?: {
        teamName: string,
        teamSide: 'blue' | 'red',
    },
    gameIndex: number,
    gameMetadata: GameMetadata,
    eventDetails: EventDetails,
    outcome: Array<Outcome>,
    records?: Record[],
    results?: Result[],
    items?: ItemDictionary,
    runes?: Rune[]
}

enum GameState {
    in_game = "in game",
    paused = "game paused",
    finished = "game ended"
}

export function Game({ firstWindowFrame, lastWindowFrame, lastDetailsFrame, finishedWinner, gameMetadata, gameIndex, eventDetails, outcome, results, items, runes }: Props) {
    const [gameState, setGameState] = useState<GameState>(GameState[lastWindowFrame.gameState as keyof typeof GameState]);
    const [objectiveTimeline, setObjectiveTimeline] = useState<ObjectiveTimeline>({});
    const [displayFrameClockMs, setDisplayFrameClockMs] = useState(() => Date.parse(lastWindowFrame.rfc460Timestamp));
    const previousObjectiveFrameRef = useRef<WindowFrame | null>(null);
    const frameClockAnchorRef = useRef({
        frameMs: Date.parse(lastWindowFrame.rfc460Timestamp),
        wallClockMs: Date.now(),
    });
    const resolvedDetailsFrame = lastDetailsFrame || createFallbackDetailsFrame(lastWindowFrame);
    const safeItems = items || {};
    const safeRunes = runes || [];

    useEffect(() => {
        let currentGameState: GameState = GameState[lastWindowFrame.gameState as keyof typeof GameState]
        let icon = currentGameState === GameState.finished ? "🔴" : currentGameState === GameState.paused ? "🟠" : "🟢"
        document.title = `${icon} ${eventDetails.league.name} - ${blueTeam.name} vs. ${redTeam.name}`;

        if (currentGameState !== gameState) {
            setGameState(currentGameState);

            if (currentGameState === GameState.in_game) {
                toast.success(`Game Resumed`, {
                    delay: 15000,
                    position: "top-right",
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: false,
                    pauseOnFocusLoss: false,
                    draggable: true,
                    toastId: `gameStatus`,
                })
            } else if (currentGameState === GameState.finished) {
                toast.error(`Game Ended`, {
                    delay: 0,
                    position: "top-right",
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: false,
                    pauseOnFocusLoss: false,
                    draggable: true,
                    toastId: `gameStatus`,
                })
            } else {
                toast.warning(`Game Paused`, {
                    delay: 15000,
                    position: "top-right",
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: false,
                    pauseOnFocusLoss: false,
                    draggable: true,
                    toastId: `gameStatus`,
                })
            }

        }

    }, [lastWindowFrame.gameState, gameState]);

    useEffect(() => {
        logLivePerf('game_component_rendered', {
            detailsTimestamp: resolvedDetailsFrame.rfc460Timestamp,
            frameTimestamp: lastWindowFrame.rfc460Timestamp,
            gameIndex,
            gameState: lastWindowFrame.gameState,
            hasItems: Object.keys(safeItems || {}).length > 0,
            hasRunes: safeRunes.length > 0,
            ...getFrameFreshnessContext({
                detailsFrameTimestamp: resolvedDetailsFrame.rfc460Timestamp,
                firstFrameTimestamp: firstWindowFrame.rfc460Timestamp,
                windowFrameTimestamp: lastWindowFrame.rfc460Timestamp,
            }),
        });
    }, [firstWindowFrame.rfc460Timestamp, gameIndex, lastWindowFrame.gameState, lastWindowFrame.rfc460Timestamp, resolvedDetailsFrame.rfc460Timestamp, safeItems, safeRunes]);

    let blueTeam = eventDetails.match.teams[0];
    let redTeam = eventDetails.match.teams[1];

    const auxBlueTeam = blueTeam

    /*
        As vezes os times continuam errados mesmo apos verificar o ultimo frame,
        em ligas como TCL, por isso fazemos essa verificação pelo nome
    */
    const summonerName = gameMetadata.blueTeamMetadata.participantMetadata[0].summonerName.split(" ");

    if ((summonerName[0] && summonerName[0].startsWith(redTeam.code)) || gameMetadata.blueTeamMetadata.esportsTeamId !== blueTeam.id) { // Temos que verificar apenas os primeiros caracteres pois os times academy usam o A, a mais na tag mas não nos nomes
        blueTeam = redTeam;
        redTeam = auxBlueTeam;
    }

    useEffect(() => {
        setObjectiveTimeline(currentTimeline => advanceObjectiveTimeline(previousObjectiveFrameRef.current, lastWindowFrame, currentTimeline));
        previousObjectiveFrameRef.current = lastWindowFrame;
    }, [
        lastWindowFrame.blueTeam.barons,
        lastWindowFrame.blueTeam.dragons.length,
        lastWindowFrame.redTeam.barons,
        lastWindowFrame.redTeam.dragons.length,
        lastWindowFrame.rfc460Timestamp,
    ]);

    useEffect(() => {
        const parsedFrameMs = Date.parse(lastWindowFrame.rfc460Timestamp);
        if (Number.isNaN(parsedFrameMs)) {
            return;
        }

        frameClockAnchorRef.current = {
            frameMs: parsedFrameMs,
            wallClockMs: Date.now(),
        };
        setDisplayFrameClockMs(parsedFrameMs);

        const timer = window.setInterval(() => {
            const { frameMs, wallClockMs } = frameClockAnchorRef.current;
            setDisplayFrameClockMs(frameMs + (Date.now() - wallClockMs));
        }, 250);

        return () => window.clearInterval(timer);
    }, [lastWindowFrame.rfc460Timestamp]);

    const goldPercentage = getGoldPercentage(lastWindowFrame.blueTeam.totalGold, lastWindowFrame.redTeam.totalGold);
    let inGameTime = getInGameTime(firstWindowFrame.rfc460Timestamp, lastWindowFrame.rfc460Timestamp)
    const formattedPatchVersion = getFormattedPatchVersion(gameMetadata.patchVersion)
    const championsUrlWithPatchVersion = CHAMPIONS_URL.replace(`PATCH_VERSION`, formattedPatchVersion)
    const objectiveTimerNotes = useMemo(() => (
        getObjectiveTimerNotes(firstWindowFrame, lastWindowFrame, objectiveTimeline, blueTeam, redTeam, displayFrameClockMs)
    ), [blueTeam, displayFrameClockMs, firstWindowFrame, lastWindowFrame, objectiveTimeline, redTeam]);
    const teamBuffTimerNotes = useMemo(() => (
        getTeamBuffTimerNotes(firstWindowFrame, lastWindowFrame, objectiveTimeline, blueTeam, redTeam, displayFrameClockMs)
    ), [blueTeam, displayFrameClockMs, firstWindowFrame, lastWindowFrame, objectiveTimeline, redTeam]);
    const playerBuffIndicators = useMemo(() => (
        getPlayerBuffIndicators(firstWindowFrame, lastWindowFrame, objectiveTimeline, displayFrameClockMs)
    ), [displayFrameClockMs, firstWindowFrame, lastWindowFrame, objectiveTimeline]);

    let playerStatsRows = Array.from($('.player-stats-row th'))
    let championStatsRows = Array.from($('.champion-stats-row span'))
    let chevrons = Array.from($('.player-stats-row .chevron-down'))
    playerStatsRows.forEach((playerStatsRow, index) => {
        $(playerStatsRow).prop("onclick", null).off("click");
        $(playerStatsRow).on('click', () => {
            $(championStatsRows[index]).slideToggle()
            $(chevrons[index]).toggleClass('rotated')
        })
    })

    const copyChampionNames = () => {
        let championNames: Array<String> = []
        gameMetadata.blueTeamMetadata.participantMetadata.forEach(participant => {
            championNames.push(participant.championId)
        })

        gameMetadata.redTeamMetadata.participantMetadata.forEach(participant => {
            championNames.push(participant.championId)
        })
        navigator.clipboard.writeText(championNames.join("\t"));
    }

    return (
        <div className="status-live-game-card">
            <GameDetails eventDetails={eventDetails} gameIndex={gameIndex} />
            <div className="status-live-game-card-content">
                {gameState === GameState.finished ? (
                    <div className={`game-ended-banner${finishedWinner ? ` ${finishedWinner.teamSide}` : ''}`} data-testid="game-ended-banner">
                        <div className="game-ended-banner-title">GAME ENDED</div>
                        {finishedWinner ? (
                            <div className="game-ended-banner-winner" data-testid="game-ended-winner">
                                {finishedWinner.teamName} WON
                            </div>
                        ) : null}
                    </div>
                ) : null}
                {/* {eventDetails ? (<h3>{eventDetails?.league.name}</h3>) : null} */}
                <div className="live-game-stats-header">
                    <div className="live-game-stats-header-team-images">
                        <div className="live-game-card-team">
                            {blueTeam.code === "TBD" ? (<TeamTBDSVG className="live-game-card-team-image" />) : (<img className="live-game-card-team-image" src={blueTeam.image} alt={blueTeam.name} />)}
                            <span>
                                <h4>
                                    {blueTeam.name}
                                </h4>
                                {teamBuffTimerNotes.blue.length > 0 ? (
                                    <span className="team-buff-strip" data-testid="blue-team-buff-strip">
                                        {teamBuffTimerNotes.blue.map(teamBuffNote => (
                                            <span
                                                className={`team-buff-pill ${teamBuffNote.certainty}`}
                                                data-testid={`team-buff-note-${teamBuffNote.key}`}
                                                key={teamBuffNote.key}
                                            >
                                                <span className="team-buff-pill-icon" aria-hidden="true">
                                                    {getObjectiveTimerIcon(teamBuffNote.icon)}
                                                </span>
                                                <span className="team-buff-pill-label">{teamBuffNote.label}</span>
                                                <span className="team-buff-pill-status">{teamBuffNote.status}</span>
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                            </span>
                            <span className='outcome'>
                                {outcome ? (<p className={outcome[0].outcome}>
                                    {outcome[0].outcome}
                                </p>) : null}
                            </span>
                        </div>
                        <h1>
                            <div className={`gamestate-bg-${gameState.split(` `).join(`-`)}`}>{gameState.toUpperCase()}</div>
                            <div>{inGameTime}</div>
                        </h1>
                        <div className="live-game-card-team">
                            {redTeam.code === "TBD" ? (<TeamTBDSVG className="live-game-card-team-image" />) : (<img className="live-game-card-team-image" src={redTeam.image} alt={redTeam.name} />)}
                            <span>
                                <h4>
                                    {redTeam.name}
                                </h4>
                                {teamBuffTimerNotes.red.length > 0 ? (
                                    <span className="team-buff-strip" data-testid="red-team-buff-strip">
                                        {teamBuffTimerNotes.red.map(teamBuffNote => (
                                            <span
                                                className={`team-buff-pill ${teamBuffNote.certainty}`}
                                                data-testid={`team-buff-note-${teamBuffNote.key}`}
                                                key={teamBuffNote.key}
                                            >
                                                <span className="team-buff-pill-icon" aria-hidden="true">
                                                    {getObjectiveTimerIcon(teamBuffNote.icon)}
                                                </span>
                                                <span className="team-buff-pill-label">{teamBuffNote.label}</span>
                                                <span className="team-buff-pill-status">{teamBuffNote.status}</span>
                                            </span>
                                        ))}
                                    </span>
                                ) : null}
                            </span>
                            <span className='outcome'>
                                {outcome ? (<p className={outcome[1].outcome}>
                                    {outcome[1].outcome}
                                </p>) : null}
                            </span>
                        </div>
                    </div>
                    <div className="live-game-stats-header-status">
                        {HeaderStats(lastWindowFrame.blueTeam, 'blue-team')}
                        {HeaderStats(lastWindowFrame.redTeam, 'red-team')}
                    </div>
                    <div className="live-game-stats-header-gold">
                        <div className="blue-team" style={{ flex: goldPercentage.goldBluePercentage }} />
                        <div className="red-team" style={{ flex: goldPercentage.goldRedPercentage }} />
                    </div>
                    <div className="live-game-stats-header-dragons">
                        <div className="blue-team">
                            {lastWindowFrame.blueTeam.dragons.map((dragon, i) => (
                                getDragonSVG(dragon, 'blue', i)
                            ))}
                        </div>
                        <div className="red-team">

                            {lastWindowFrame.redTeam.dragons.slice().reverse().map((dragon, i) => (
                                getDragonSVG(dragon, 'red', i)
                            ))}
                        </div>
                    </div>
                </div>
                <div className="status-live-game-card-table-wrapper">
                    <table className="status-live-game-card-table">
                        <thead>
                            <tr key={blueTeam.name.toUpperCase()}>
                                <th className="table-top-row-champion" title="champion/team">
                                    <span>{blueTeam.name.toUpperCase()}</span>
                                </th>
                                <th className="table-top-row-vida" title="life">
                                    <span>Health</span>
                                </th>
                                <th className="table-top-row-items" title="items">
                                    <span>Items</span>
                                </th>
                                <th className="table-top-row" title="creep score">
                                    <span>CS</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>K</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>D</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>A</span>
                                </th>
                                <th className="table-top-row" title="gold">
                                    <span>Gold</span>
                                </th>
                                <th className="table-top-row" title="gold difference">
                                    <span>+/-</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {lastWindowFrame.blueTeam.participants.map((player: WindowParticipant, index) => {
                                let goldDifference = getGoldDifference(player, "blue", gameMetadata, lastWindowFrame);
                                let championDetails = resolvedDetailsFrame.participants[index]
                                return [(
                                    <tr className="player-stats-row" key={`${gameIndex}_${championsUrlWithPatchVersion}${gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].championId}`}>
                                        <th>
                                            <div className="player-champion-info">
                                                <svg className="chevron-down" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 429.3l22.6-22.6 192-192L493.3 192 448 146.7l-22.6 22.6L256 338.7 86.6 169.4 64 146.7 18.7 192l22.6 22.6 192 192L256 429.3z" /></svg>
                                                <div className='player-champion-wrapper'>
                                                    <img src={`${championsUrlWithPatchVersion}${gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].championId}.png`} alt="" className='player-champion' onError={({ currentTarget }) => { currentTarget.style.display = `none` }} />
                                                    <TeamTBDSVG className='player-champion' />
                                                </div>
                                                <span className=" player-champion-info-level">{player.level}</span>
                                                <div className=" player-champion-info-name">
                                                    <span>{gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].championId}</span>
                                                    <span
                                                        className=" player-card-player-name">
                                                        {gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].summonerName}
                                                        <PlayerBuffBadges playerBuffs={playerBuffIndicators[player.participantId]} />
                                                    </span>
                                                </div>
                                            </div>
                                        </th>
                                        <td>
                                            <MiniHealthBar currentHealth={player.currentHealth} maxHealth={player.maxHealth} />
                                        </td>
                                        <td>
                                            <ItemsDisplay participantId={player.participantId - 1} lastFrame={resolvedDetailsFrame} items={safeItems} patchVersion={formattedPatchVersion} />
                                        </td>
                                        <td>
                                            <div className=" player-stats">{player.creepScore}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.kills}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.deaths}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.assists}</div>
                                        </td>
                                        <td>
                                            <div
                                                className=" player-stats">{Number(player.totalGold).toLocaleString('en-us')}</div>
                                        </td>
                                        <td>
                                            <div className={`player-stats player-gold-${goldDifference?.style}`}>{goldDifference.goldDifference}</div>
                                        </td>
                                    </tr>
                                ), (
                                    <tr key={`${gameIndex}_${championsUrlWithPatchVersion}${gameMetadata.blueTeamMetadata.participantMetadata[player.participantId - 1].championId}_stats`} className='champion-stats-row'>
                                        <td colSpan={9}>
                                            <span>
                                                {getFormattedChampionStats(championDetails, safeRunes)}
                                            </span>
                                        </td>
                                    </tr>
                                )]
                            })}
                        </tbody>
                    </table>

                    <table className="status-live-game-card-table">
                        <thead>
                            <tr key={redTeam.name.toUpperCase()}>
                                <th className="table-top-row-champion" title="champion/team">
                                    <span>{redTeam.name.toUpperCase()}</span>
                                </th>
                                <th className="table-top-row-vida" title="life">
                                    <span>Health</span>
                                </th>
                                <th className="table-top-row-items" title="items">
                                    <span>Items</span>
                                </th>
                                <th className="table-top-row" title="creep score">
                                    <span>CS</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>K</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>D</span>
                                </th>
                                <th className="table-top-row player-stats-kda" title="kills">
                                    <span>A</span>
                                </th>
                                <th className="table-top-row" title="gold">
                                    <span>Gold</span>
                                </th>
                                <th className="table-top-row" title="gold difference">
                                    <span>+/-</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {lastWindowFrame.redTeam.participants.map((player: WindowParticipant, index) => {
                                let goldDifference = getGoldDifference(player, "red", gameMetadata, lastWindowFrame);
                                let championDetails = resolvedDetailsFrame.participants[index + 5]

                                return [(
                                    <tr className="player-stats-row" key={`${gameIndex}_${championsUrlWithPatchVersion}${gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].championId}`}>
                                        <th>
                                            <div className="player-champion-info">
                                                <svg className="chevron-down" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 429.3l22.6-22.6 192-192L493.3 192 448 146.7l-22.6 22.6L256 338.7 86.6 169.4 64 146.7 18.7 192l22.6 22.6 192 192L256 429.3z" /></svg>
                                                <div className='player-champion-wrapper'>
                                                    <img src={`${championsUrlWithPatchVersion}${gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].championId}.png`} alt="" className='player-champion' onError={({ currentTarget }) => { currentTarget.style.display = `none` }} />
                                                    <TeamTBDSVG className='player-champion' />
                                                </div>
                                                <span className=" player-champion-info-level">{player.level}</span>
                                                <div className=" player-champion-info-name">
                                                    <span>{gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].championId}</span>
                                                    <span className=" player-card-player-name">
                                                        {gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].summonerName}
                                                        <PlayerBuffBadges playerBuffs={playerBuffIndicators[player.participantId]} />
                                                    </span>
                                                </div>
                                            </div>
                                        </th>
                                        <td>
                                            <MiniHealthBar currentHealth={player.currentHealth} maxHealth={player.maxHealth} />
                                        </td>
                                        <td>
                                            <ItemsDisplay participantId={player.participantId - 1} lastFrame={resolvedDetailsFrame} items={safeItems} patchVersion={formattedPatchVersion} />
                                        </td>
                                        <td>
                                            <div className=" player-stats">{player.creepScore}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.kills}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.deaths}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats player-stats-kda">{player.assists}</div>
                                        </td>
                                        <td>
                                            <div className=" player-stats">{Number(player.totalGold).toLocaleString('en-us')}</div>
                                        </td>
                                        <td>
                                            <div className={`player-stats player-gold-${goldDifference?.style}`}>{goldDifference.goldDifference}</div>
                                        </td>
                                    </tr>
                                ), (
                                    <tr key={`${gameIndex}_${championsUrlWithPatchVersion}${gameMetadata.redTeamMetadata.participantMetadata[player.participantId - 6].championId}_stats`} className='champion-stats-row'>
                                        <td colSpan={9}>
                                            <span>
                                                {getFormattedChampionStats(championDetails, safeRunes)}
                                            </span>
                                        </td>
                                    </tr>
                                )]
                            })}
                        </tbody>
                    </table>
                </div>
                <span className="footer-notes">
                    <a target="_blank" href={`https://www.leagueoflegends.com/en-us/news/game-updates/patch-26-${gameMetadata.patchVersion.split(`.`)[1].length > 1 ? gameMetadata.patchVersion.split(`.`)[1] : "" + gameMetadata.patchVersion.split(`.`)[1]}-notes/`}>Patch Version: {gameMetadata.patchVersion}</a>
                </span>
                <button type="button" className="footer-notes copy-champion-names" onClick={copyChampionNames}>
                    Copy Champion Names
                </button>
                {objectiveTimerNotes.length > 0 ? (
                    <div className="objective-timer-strip" data-testid="objective-timer-strip">
                        {objectiveTimerNotes.map(objectiveTimerNote => (
                            <div className={`objective-timer-pill${objectiveTimerNote.isAlive ? ' alive' : ''}`} data-testid={`objective-note-${objectiveTimerNote.key}`} key={objectiveTimerNote.key}>
                                <span className="objective-timer-icon" aria-hidden="true">
                                    {getObjectiveTimerIcon(objectiveTimerNote.icon)}
                                </span>
                                <span className="objective-timer-label">{objectiveTimerNote.label}</span>
                                <span className="objective-timer-status">{objectiveTimerNote.status}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
            <LiveAPIWatcher gameIndex={gameIndex} gameMetadata={gameMetadata} lastWindowFrame={lastWindowFrame} championsUrlWithPatchVersion={championsUrlWithPatchVersion} blueTeam={eventDetails.match.teams[0]} redTeam={eventDetails.match.teams[1]} />
        </div>
    );
}

function HeaderStats(teamStats: TeamStats, teamColor: string) {
    return (
        <div className={teamColor}>
            <div className="team-stats inhibitors">
                <InhibitorSVG />
                {teamStats.inhibitors}
            </div>
            <div className="team-stats barons">
                <BaronSVG />
                {teamStats.barons}
            </div>
            <div className="team-stats towers">
                <TowerSVG />
                {teamStats.towers}
            </div>
            <div className="team-stats gold">
                <GoldSVG />
                <span>
                    {Number(teamStats.totalGold).toLocaleString('en-us')}
                </span>
            </div>
            <div className="team-stats kills">
                <KillSVG />
                {teamStats.totalKills}
            </div>
        </div>
    )
}

function getFormattedChampionStats(championDetails: Participant, runes: Rune[]) {
    return (
        <div>
            <div className='footer-notes'>Attack Damage: {championDetails.attackDamage}</div>
            <div className='footer-notes'>Ability Power: {championDetails.abilityPower}</div>
            <div className='footer-notes'>Attack Speed: {championDetails.attackSpeed}</div>
            <div className='footer-notes'>Life Steal: {championDetails.lifeSteal}%</div>
            <div className='footer-notes'>Armor: {championDetails.armor}</div>
            <div className='footer-notes'>Magic Resistance: {championDetails.magicResistance}</div>
            <div className='footer-notes'>Wards Destroyed: {championDetails.wardsDestroyed}</div>
            <div className='footer-notes'>Wards Placed: {championDetails.wardsPlaced}</div>
            <div className='footer-notes'>Damage Share: {Math.round(championDetails.championDamageShare * 10000) / 100}%</div>
            <div className='footer-notes'>Kill Participation: {Math.round(championDetails.killParticipation * 10000) / 100}%</div>
            <div className='footer-notes'>Skill Order: {championDetails.abilities.join('->')}</div>
            {getFormattedRunes(championDetails, runes)}
        </div>
    )
}

function getRuneUrlFromIcon(runes: Rune[], icon: string) {
    const perkImageUrl = `https://ddragon.leagueoflegends.com/cdn/img/PERK_ICON`
    return perkImageUrl.replace(`PERK_ICON`, icon)
}

function getSlottedRunes(runes: Rune[]): Array<SlottedRune> {
    const slottedRunes: Array<SlottedRune> = []
    runes.forEach(rune => {
        rune.slots.forEach(slot => {
            slot.runes.forEach(slottedRune => {
                slottedRunes.push(slottedRune)
            })
        })
    })
    return slottedRunes
}

function getRuneHTMLElement(slottedRune: SlottedRune) {
    return <div dangerouslySetInnerHTML={{ __html: slottedRune.longDesc }}></div>
}

function getFormattedRunes(championDetails: Participant, runes: Rune[]) {
    const slottedRunes = getSlottedRunes(runes)
    const mappedRunes = championDetails.perkMetadata.perks.map(perk => {
        return slottedRunes.find(slottedRune => slottedRune.id === perk)
    })
    if (!mappedRunes) return (<div className="StatsMatchupRunes"></div>)

    return (
        <div className="rune-list">
            {mappedRunes.map(mappedRune => {
                return mappedRune ?
                    (
                        <div className="rune" key={mappedRune.id}>
                            <div>
                                <img className="image" src={getRuneUrlFromIcon(runes, mappedRune.icon)} alt="" />
                                <div className="name">{mappedRune.name}</div>
                            </div>
                            <div className="text">
                                <div className="description">{getRuneHTMLElement(mappedRune)}</div>
                            </div>
                        </div>) : null
            })}
        </div>
    )
}

function getInGameTime(startTime: string, currentTime: string) {
    let startDate = new Date(startTime)
    let currentDate = new Date(currentTime)
    let seconds = Math.floor((currentDate.valueOf() - (startDate.valueOf())) / 1000)
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    let days = Math.floor(hours / 24);

    hours = hours - (days * 24);
    minutes = minutes - (days * 24 * 60) - (hours * 60);
    seconds = seconds - (days * 24 * 60 * 60) - (hours * 60 * 60) - (minutes * 60);
    let secondsString = seconds < 10 ? '0' + seconds : seconds

    return hours ? `${hours}:${minutes}:${secondsString}` : `${minutes}:${secondsString}`
}

function getGoldDifference(player: WindowParticipant, side: string, gameMetadata: GameMetadata, frame: WindowFrame) {
    if (6 > player.participantId) { // blue side
        const redPlayer = frame.redTeam.participants[player.participantId - 1];
        const goldResult = player.totalGold - redPlayer.totalGold;

        return {
            style: goldResult > 0 ? "positive" : "negative",
            goldDifference: goldResult > 0 ? "+" + Number(goldResult).toLocaleString("en-us") : Number(goldResult).toLocaleString("en-us")
        };
    } else {
        const bluePlayer = frame.blueTeam.participants[player.participantId - 6];
        const goldResult = player.totalGold - bluePlayer.totalGold;

        return {
            style: goldResult > 0 ? "positive" : "negative",
            goldDifference: goldResult > 0 ? "+" + Number(goldResult).toLocaleString("en-us") : Number(goldResult).toLocaleString("en-us")
        };
    }
}

function getDragonSVG(dragonName: string, teamColor: string, index: number) {
    let key = `${teamColor}_${index}_${dragonName}`
    switch (dragonName) {
        case "ocean": return <OceanDragonSVG className="dragon" key={key} />;
        case "hextech": return <HextechDragonSVG className="dragon" key={key} />;
        case "chemtech": return <ChemtechDragonSVG className="dragon" key={key} />;
        case "infernal": return <InfernalDragonSVG className="dragon" key={key} />
        case "cloud": return <CloudDragonSVG className="dragon" key={key} />
        case "mountain": return <MountainDragonSVG className="dragon" key={key} />
        case "elder": return <ElderDragonSVG className="dragon" key={key} />
    }
}

function getObjectiveTimerIcon(objectiveType: "baron" | "dragon" | "elder") {
    switch (objectiveType) {
        case "baron":
            return <BaronSVG />;
        case "elder":
            return <ElderDragonSVG />;
        default:
            return <InfernalDragonSVG />;
    }
}

function PlayerBuffBadges({ playerBuffs }: { playerBuffs?: PlayerBuffIndicator[] }) {
    if (!playerBuffs?.length) {
        return null;
    }

    return (
        <span className="player-buff-badges">
            {playerBuffs.map(playerBuff => (
                <span
                    className={`player-buff-badge ${playerBuff.icon} ${playerBuff.certainty}`}
                    data-testid={`player-buff-${playerBuff.participantId}-${playerBuff.icon}`}
                    key={`${playerBuff.participantId}-${playerBuff.icon}`}
                    title={`${playerBuff.certainty === "certain" ? "Confirmed" : "Estimated"} ${playerBuff.icon === "baron" ? "Baron" : "Elder"} buff`}
                >
                    {getObjectiveTimerIcon(playerBuff.icon)}
                </span>
            ))}
        </span>
    );
}

function getGoldPercentage(goldBlue: number, goldRed: number) {
    const total = goldBlue + goldRed;
    return {
        goldBluePercentage: ((goldBlue / 100) * total),
        goldRedPercentage: ((goldRed / 100) * total),
    }
}

function createFallbackDetailsFrame(windowFrame: WindowFrame): DetailsFrame {
    return {
        participants: [...windowFrame.blueTeam.participants, ...windowFrame.redTeam.participants].map(player => ({
            participantId: player.participantId,
            level: player.level,
            kills: player.kills,
            deaths: player.deaths,
            assists: player.assists,
            totalGoldEarned: player.totalGold,
            creepScore: player.creepScore,
            killParticipation: 0,
            championDamageShare: 0,
            wardsPlaced: 0,
            wardsDestroyed: 0,
            attackDamage: 0,
            abilityPower: 0,
            criticalChance: 0,
            attackSpeed: 0,
            lifeSteal: 0,
            armor: 0,
            magicResistance: 0,
            tenacity: 0,
            items: [],
            perkMetadata: {
                styleId: 8000,
                subStyleId: 8100,
                perks: [],
            },
            abilities: [],
        })),
        rfc460Timestamp: windowFrame.rfc460Timestamp as unknown as Date,
    }
}
