import './styles/playerStatusStyle.css'

import {
    getEventDetailsResponse,
    getISODateMultiplyOf10,
    getGameDetailsResponse,
    getWindowResponse,
    getScheduleResponse,
    getStandingsResponse,
    getDataDragonResponse,
    getFormattedPatchVersion,
    ITEMS_JSON_URL,
    RUNES_JSON_URL
} from "../../utils/LoLEsportsAPI";
import { useEffect, useRef, useState } from "react";
import { getFrameFreshnessContext, logLivePerf, resetLivePerfLog } from "../../utils/livePerf";
import Loading from '../../assets/images/loading.svg'
import { ReactComponent as TeamTBDSVG } from '../../assets/images/team-tbd.svg';
import { MatchDetails } from "./MatchDetails"
import { Game } from "./Game";
import { EventDetails, DetailsFrame, GameMetadata, ItemDictionary, Outcome, Record, Result, ScheduleEvent, Standing, WindowFrame, Rune } from "../types/baseTypes"
import { GameDetails } from './GameDetails';
import { DisabledGame } from './DisabledGame';

type FinishedWinner = {
    teamName: string;
    teamSide: 'blue' | 'red';
}

export function Match({ match }: any) {
    const LIVE_POLL_INTERVAL_MS = 100;
    const [eventDetails, setEventDetails] = useState<EventDetails>();
    const [firstWindowFrame, setFirstWindowFrame] = useState<WindowFrame>();
    const [lastDetailsFrame, setLastDetailsFrame] = useState<DetailsFrame>();
    const [lastWindowFrame, setLastWindowFrame] = useState<WindowFrame>();
    const [windowHistoryFrames, setWindowHistoryFrames] = useState<WindowFrame[]>([]);
    const [metadata, setMetadata] = useState<GameMetadata>();
    const [records, setRecords] = useState<Record[]>();
    const [results, setResults] = useState<Result[]>();
    const [currentGameOutcome, setCurrentGameOutcome] = useState<Array<Outcome>>();
    const [finishedWinner, setFinishedWinner] = useState<FinishedWinner>();
    const [scheduleEvent, setScheduleEvent] = useState<ScheduleEvent>();
    const [gameIndex, setGameIndex] = useState<number>();
    const [items, setItems] = useState<ItemDictionary>();
    const [runes, setRunes] = useState<Rune[]>();
    const didLogCoreReady = useRef(false);
    const didLogReady = useRef(false);
    const firstFrameTimestampRef = useRef<string | Date>();
    const latestWindowTimestampRef = useRef<string | Date>();
    const latestDetailsTimestampRef = useRef<string | Date>();
    const windowHistoryFramesRef = useRef<WindowFrame[]>([]);
    const finishedWinnerRefreshGameIdRef = useRef<string>();
    const detectedFinishedFrameRef = useRef<string>();

    const matchId = match.params.gameid;
    let matchEventDetails = eventDetails
    let currentGameIndex = 1
    let lastFrameSuccess = false
    let currentTimestamp = ``
    let firstWindowReceived = false
    useEffect(() => {
        let isActive = true;
        resetLivePerfLog();
        didLogCoreReady.current = false;
        didLogReady.current = false;
        firstFrameTimestampRef.current = undefined;
        latestWindowTimestampRef.current = undefined;
        latestDetailsTimestampRef.current = undefined;
        windowHistoryFramesRef.current = [];
        finishedWinnerRefreshGameIdRef.current = undefined;
        detectedFinishedFrameRef.current = undefined;
        setFinishedWinner(undefined);
        setWindowHistoryFrames([]);
        logLivePerf('match_mount', { matchId });
        getEventDetails(getInitialGameIndex());
        logLivePerf('polling_loop_started', {
            intervalMs: LIVE_POLL_INTERVAL_MS,
            matchId,
        });

        const windowIntervalID = setInterval(() => {
            if (!matchEventDetails) return
            let newGameIndex = getGameIndex(matchEventDetails)
            let gameId = matchEventDetails.match.games[newGameIndex - 1].id
            logLivePerf('poll_tick', {
                currentGameIndex,
                currentTimestamp,
                firstWindowReceived,
                gameId,
                nextGameIndex: newGameIndex,
            });
            if (currentGameIndex !== newGameIndex || !firstWindowReceived) {
                currentTimestamp = ``
                finishedWinnerRefreshGameIdRef.current = undefined;
                detectedFinishedFrameRef.current = undefined;
                setFinishedWinner(undefined);
                logLivePerf('poll_reset_for_game', {
                    gameId,
                    nextGameIndex: newGameIndex,
                });
                getFirstWindow(gameId)
                setGameIndex(newGameIndex)
                currentGameIndex = newGameIndex
            }
            getLiveWindow(gameId);
            getLastDetailsFrame(gameId);
        }, LIVE_POLL_INTERVAL_MS);

        return () => {
            clearInterval(windowIntervalID);
            isActive = false;
            logLivePerf('polling_loop_stopped', { matchId });
        }

        function getEventDetails(gameIndex: number) {
            getEventDetailsResponse(matchId).then(response => {
                if (!isActive) return;
                let eventDetails: EventDetails = response.data.data.event;
                if (eventDetails === undefined) return undefined;
                let newGameIndex = getGameIndex(eventDetails)
                let gameId = eventDetails.match.games[newGameIndex - 1].id
                setEventDetails(eventDetails)
                setGameIndex(gameIndex)
                currentGameIndex = newGameIndex
                matchEventDetails = eventDetails
                getFirstWindow(gameId)
                getScheduleEvent(eventDetails)
                getResults(eventDetails)
                logLivePerf('event_details_state_update', {
                    gameId,
                    gameIndex,
                    matchId: eventDetails.id,
                });
            })
        }

        function getInitialGameIndex(): number {
            let gameIndexMatch = window.location.href.match(/game-index\/(\d+)/)
            let initialGameIndex = gameIndexMatch ? parseInt(gameIndexMatch[1]) : 0
            if (isActive) {
                setGameIndex(initialGameIndex)
            }
            logLivePerf('initial_game_index', {
                initialGameIndex,
            });
            return initialGameIndex
        }

        function getGameIndex(eventDetails: EventDetails): number {
            let gameIndexMatch = window.location.href.match(/game-index\/(\d+)/)
            let newGameIndex = gameIndexMatch ? parseInt(gameIndexMatch[1]) : getNextUnstartedGameIndex(eventDetails)
            if (isActive) {
                setGameIndex(newGameIndex)
            }
            logLivePerf('active_game_index_selected', {
                newGameIndex,
            });
            return newGameIndex
        }

        function getScheduleEvent(eventDetails: EventDetails) {
            getScheduleResponse().then(response => {
                if (!isActive) return;
                let scheduleEvents: ScheduleEvent[] = response.data.data.schedule.events
                let scheduleEvent = scheduleEvents.find((scheduleEvent: ScheduleEvent) => {
                    return scheduleEvent.match ? (scheduleEvent.match.id === matchId) : false
                })
                if (scheduleEvent === undefined) return
                let records = scheduleEvent.match.teams[0].record && scheduleEvent.match.teams[1].record ? [scheduleEvent.match.teams[0].record, scheduleEvent.match.teams[1].record] : undefined
                if (records === undefined) return

                setRecords(records)
                setScheduleEvent(scheduleEvent);
                logLivePerf('schedule_state_update', {
                    eventState: scheduleEvent.state,
                    matchId,
                });
            }).catch(() => undefined)
        }

        function getFirstWindow(gameId: string) {
            getWindowResponse(gameId).then(async response => {
                if (!isActive) return;
                if (response === undefined) return
                let frames: WindowFrame[] = response.data.frames;
                if (frames === undefined) return;
                frames = await hydrateWindowHistory(gameId, frames);
                if (!isActive || frames.length === 0) return;

                const firstFrame = frames[0]
                const latestFrame = frames[frames.length - 1]

                firstWindowReceived = true
                currentTimestamp = latestFrame.rfc460Timestamp
                firstFrameTimestampRef.current = firstFrame.rfc460Timestamp
                latestWindowTimestampRef.current = latestFrame.rfc460Timestamp
                windowHistoryFramesRef.current = frames
                setMetadata(response.data.gameMetadata)
                setFirstWindowFrame(firstFrame)
                setLastWindowFrame(latestFrame)
                setWindowHistoryFrames(frames)
                if (matchEventDetails !== undefined) {
                    const outcome = getOutcomeForGame(matchEventDetails, currentGameIndex, latestFrame)
                    setCurrentGameOutcome(outcome)
                    setFinishedWinner(latestFrame.gameState === 'finished'
                        ? getFinishedWinner(matchEventDetails, currentGameIndex, outcome)
                        : undefined)
                }
                getItems(response.data.gameMetadata)
                getRunes(response.data.gameMetadata)
                getLiveWindow(gameId)
                getLastDetailsFrame(gameId)
                logLivePerf('first_window_state_update', {
                    frameTimestamp: latestFrame.rfc460Timestamp,
                    gameId,
                    patchVersion: response.data.gameMetadata.patchVersion,
                    ...getFrameFreshnessContext({
                        firstFrameTimestamp: firstFrameTimestampRef.current,
                        windowFrameTimestamp: latestFrame.rfc460Timestamp,
                    }),
                });
            });
        }

        function getLiveWindow(gameId: string) {
            let date = getISODateMultiplyOf10();
            getWindowResponse(gameId, date).then(response => {
                if (!isActive) return;
                if (response === undefined) return
                let frames: WindowFrame[] = response.data.frames;
                if (frames === undefined) return
                const lastWindowFrame = frames[frames.length - 1]
                if (currentTimestamp > lastWindowFrame.rfc460Timestamp) {
                    logLivePerf('live_window_stale_skipped', {
                        currentTimestamp,
                        frameTimestamp: lastWindowFrame.rfc460Timestamp,
                        gameId,
                    });
                    return;
                }
                currentTimestamp = lastWindowFrame.rfc460Timestamp
                latestWindowTimestampRef.current = lastWindowFrame.rfc460Timestamp
                setWindowHistoryFrames(currentFrames => {
                    const nextFrames = mergeWindowFrameHistory(currentFrames, frames);
                    windowHistoryFramesRef.current = nextFrames;
                    return nextFrames;
                });

                setLastWindowFrame(lastWindowFrame)
                setMetadata(response.data.gameMetadata)
                logLivePerf('live_window_state_update', {
                    frameTimestamp: lastWindowFrame.rfc460Timestamp,
                    gameId,
                    totalGoldBlue: lastWindowFrame.blueTeam.totalGold,
                    totalGoldRed: lastWindowFrame.redTeam.totalGold,
                    ...getFrameFreshnessContext({
                        detailsFrameTimestamp: latestDetailsTimestampRef.current,
                        firstFrameTimestamp: firstFrameTimestampRef.current,
                        windowFrameTimestamp: lastWindowFrame.rfc460Timestamp,
                    }),
                });

                if (matchEventDetails === undefined) return
                const outcome = getOutcomeForGame(matchEventDetails, currentGameIndex, lastWindowFrame)
                setCurrentGameOutcome(outcome)
                logLivePerf('outcome_state_update', {
                    frameTimestamp: lastWindowFrame.rfc460Timestamp,
                    gameId,
                });

                const resolvedWinner = getFinishedWinner(matchEventDetails, currentGameIndex, outcome)
                if (lastWindowFrame.gameState === 'finished') {
                    const finishedFrameKey = `${gameId}_${lastWindowFrame.rfc460Timestamp}`;
                    if (detectedFinishedFrameRef.current !== finishedFrameKey) {
                        detectedFinishedFrameRef.current = finishedFrameKey;
                        logLivePerf('game_end_detected', {
                            frameTimestamp: lastWindowFrame.rfc460Timestamp,
                            gameId,
                        });
                    }

                    setFinishedWinner(resolvedWinner);

                    if (finishedWinnerRefreshGameIdRef.current !== gameId) {
                        refreshFinishedWinner(gameId, lastWindowFrame);
                    }
                } else {
                    finishedWinnerRefreshGameIdRef.current = undefined;
                    detectedFinishedFrameRef.current = undefined;
                    setFinishedWinner(undefined);
                }
            });
        }

        async function hydrateWindowHistory(gameId: string, initialFrames: WindowFrame[]) {
            let nextFrames = mergeWindowFrameHistory([], initialFrames);
            const latestFrame = nextFrames[nextFrames.length - 1];
            if (latestFrame === undefined || latestFrame.gameState !== 'in_game' || nextFrames.length > 1) {
                return nextFrames;
            }

            const backfillStart = getWindowHistoryBackfillStart(latestFrame.rfc460Timestamp);
            if (backfillStart === undefined) {
                return nextFrames;
            }

            logLivePerf('window_history_backfill_start', {
                backfillStart,
                gameId,
                latestFrameTimestamp: latestFrame.rfc460Timestamp,
            });
            const backfillResponse = await getWindowResponse(gameId, backfillStart);
            if (!isActive || backfillResponse === undefined) {
                return nextFrames;
            }

            const backfillFrames: WindowFrame[] = backfillResponse.data.frames;
            if (backfillFrames === undefined || backfillFrames.length === 0) {
                return nextFrames;
            }

            nextFrames = mergeWindowFrameHistory(nextFrames, backfillFrames);
            logLivePerf('window_history_backfill_complete', {
                backfillFrameCount: backfillFrames.length,
                gameId,
                historyFrameCount: nextFrames.length,
            });
            return nextFrames;
        }

        function getLastDetailsFrame(gameId: string) {
            let date = getISODateMultiplyOf10();
            getGameDetailsResponse(gameId, date, lastFrameSuccess).then(response => {
                if (!isActive) return;
                lastFrameSuccess = false
                if (response === undefined) return
                let frames: DetailsFrame[] = response.data.frames;
                if (frames === undefined) return;
                lastFrameSuccess = true
                latestDetailsTimestampRef.current = frames[frames.length - 1].rfc460Timestamp
                setLastDetailsFrame(frames[frames.length - 1])
                logLivePerf('details_state_update', {
                    frameTimestamp: frames[frames.length - 1].rfc460Timestamp,
                    gameId,
                    ...getFrameFreshnessContext({
                        detailsFrameTimestamp: frames[frames.length - 1].rfc460Timestamp,
                        firstFrameTimestamp: firstFrameTimestampRef.current,
                        windowFrameTimestamp: latestWindowTimestampRef.current,
                    }),
                });
            });
        }

        function getResults(eventDetails: EventDetails) {
            if (eventDetails === undefined) return;
            getStandingsResponse(eventDetails.tournament.id).then(response => {
                if (!isActive) return;
                let standings: Standing[] = response.data.data.standings
                let stage = standings[0].stages.find((stage) => {
                    let stageSection = stage.sections.find((section) => {
                        return section.matches.find((match) => match.id === matchId)
                    })
                    return stageSection
                })
                if (stage === undefined) return;
                let section = stage.sections.find((section) => {
                    return section.matches.find((match) => match.id === matchId)
                })
                if (section === undefined) return;
                let match = section.matches.find((match) => match.id === matchId)
                if (match === undefined) return;
                let teams = match.teams
                let results = teams.map((team) => team.result)
                setResults(results)
                logLivePerf('results_state_update', {
                    resultCount: results.length,
                });
            });
        }

        function refreshFinishedWinner(gameId: string, resolvedWindowFrame: WindowFrame) {
            finishedWinnerRefreshGameIdRef.current = gameId;
            logLivePerf('game_end_winner_refresh_started', {
                frameTimestamp: resolvedWindowFrame.rfc460Timestamp,
                gameId,
            });

            getEventDetailsResponse(matchId).then(response => {
                if (!isActive) return;
                const refreshedEventDetails: EventDetails = response.data.data.event;
                if (refreshedEventDetails === undefined) {
                    logLivePerf('game_end_winner_unavailable', {
                        frameTimestamp: resolvedWindowFrame.rfc460Timestamp,
                        gameId,
                    });
                    return;
                }

                matchEventDetails = refreshedEventDetails;
                setEventDetails(refreshedEventDetails);
                setResults(refreshedEventDetails.match.teams.map(team => team.result));

                const refreshedGameIndex = getGameIndex(refreshedEventDetails);
                currentGameIndex = refreshedGameIndex;
                const refreshedOutcome = getOutcomeForGame(refreshedEventDetails, refreshedGameIndex, resolvedWindowFrame);
                setCurrentGameOutcome(refreshedOutcome);

                const winner = getFinishedWinner(refreshedEventDetails, refreshedGameIndex, refreshedOutcome);
                setFinishedWinner(winner);

                if (winner) {
                    logLivePerf('game_end_winner_resolved', {
                        frameTimestamp: resolvedWindowFrame.rfc460Timestamp,
                        gameId,
                        teamName: winner.teamName,
                        teamSide: winner.teamSide,
                    });
                    return;
                }

                logLivePerf('game_end_winner_unavailable', {
                    frameTimestamp: resolvedWindowFrame.rfc460Timestamp,
                    gameId,
                });
            }).catch(() => {
                if (!isActive) return;
                logLivePerf('game_end_winner_unavailable', {
                    frameTimestamp: resolvedWindowFrame.rfc460Timestamp,
                    gameId,
                });
            });
        }

        function getItems(metadata: GameMetadata) {
            const formattedPatchVersion = getFormattedPatchVersion(metadata.patchVersion)
            getDataDragonResponse(ITEMS_JSON_URL, formattedPatchVersion).then(response => {
                if (!isActive) return;
                setItems(response.data.data)
                logLivePerf('items_state_update', {
                    itemCount: Object.keys(response.data.data || {}).length,
                    patchVersion: formattedPatchVersion,
                });
            })
        }
        function getRunes(metadata: GameMetadata) {
            const formattedPatchVersion = getFormattedPatchVersion(metadata.patchVersion)
            getDataDragonResponse(RUNES_JSON_URL, formattedPatchVersion).then(response => {
                if (!isActive) return;
                setRunes(response.data)
                logLivePerf('runes_state_update', {
                    patchVersion: formattedPatchVersion,
                    runeCount: response.data?.length || 0,
                });
            })
        }

    }, [matchId]);

    useEffect(() => {
        if (
            !didLogCoreReady.current &&
            firstWindowFrame !== undefined &&
            lastWindowFrame !== undefined &&
            metadata !== undefined &&
            eventDetails !== undefined &&
            currentGameOutcome !== undefined &&
            gameIndex !== undefined
        ) {
            didLogCoreReady.current = true
            logLivePerf('match_core_ready', {
                frameTimestamp: lastWindowFrame.rfc460Timestamp,
                gameIndex,
                matchId,
                ...getFrameFreshnessContext({
                    detailsFrameTimestamp: latestDetailsTimestampRef.current,
                    firstFrameTimestamp: firstFrameTimestampRef.current,
                    windowFrameTimestamp: latestWindowTimestampRef.current || lastWindowFrame.rfc460Timestamp,
                }),
            });
        }
    }, [currentGameOutcome, eventDetails, firstWindowFrame, gameIndex, lastWindowFrame, matchId, metadata]);

    useEffect(() => {
        if (
            !didLogReady.current &&
            firstWindowFrame !== undefined &&
            lastWindowFrame !== undefined &&
            lastDetailsFrame !== undefined &&
            metadata !== undefined &&
            eventDetails !== undefined &&
            currentGameOutcome !== undefined &&
            scheduleEvent !== undefined &&
            gameIndex !== undefined &&
            items !== undefined &&
            runes !== undefined
        ) {
            didLogReady.current = true
            logLivePerf('match_ready', {
                frameTimestamp: lastWindowFrame.rfc460Timestamp,
                gameIndex,
                matchId,
                ...getFrameFreshnessContext({
                    detailsFrameTimestamp: latestDetailsTimestampRef.current,
                    firstFrameTimestamp: firstFrameTimestampRef.current,
                    windowFrameTimestamp: latestWindowTimestampRef.current || lastWindowFrame.rfc460Timestamp,
                }),
            });
        }
    }, [currentGameOutcome, eventDetails, firstWindowFrame, gameIndex, items, lastDetailsFrame, lastWindowFrame, matchId, metadata, runes, scheduleEvent]);

    const copyChampionNames = () => {
        if (!metadata) return
        let championNames: Array<String> = []
        metadata.blueTeamMetadata.participantMetadata.forEach(participant => {
            championNames.push(participant.championId)
        })

        metadata.redTeamMetadata.participantMetadata.forEach(participant => {
            championNames.push(participant.championId)
        })
        navigator.clipboard.writeText(championNames.join("\t"));
    }

    if (firstWindowFrame !== undefined && lastWindowFrame !== undefined && metadata !== undefined && eventDetails !== undefined && currentGameOutcome !== undefined && gameIndex !== undefined) {
        return (
            <div className='match-container'>
                {scheduleEvent !== undefined ? (
                    <MatchDetails eventDetails={eventDetails} gameMetadata={metadata} matchState={formatMatchState(eventDetails, lastWindowFrame, scheduleEvent)} records={records} results={results} scheduleEvent={scheduleEvent} />
                ) : null}
                <Game eventDetails={eventDetails} finishedWinner={finishedWinner} gameIndex={gameIndex} gameMetadata={metadata} firstWindowFrame={firstWindowFrame} windowHistoryFrames={windowHistoryFrames} lastDetailsFrame={lastDetailsFrame} lastWindowFrame={lastWindowFrame} outcome={currentGameOutcome} records={records} results={results} items={items || {}} runes={runes || []} />
            </div>
        );
    } else if (firstWindowFrame !== undefined && metadata !== undefined && eventDetails !== undefined && scheduleEvent !== undefined && gameIndex !== undefined) {
        return (
            <div className='match-container'>
                <MatchDetails eventDetails={eventDetails} gameMetadata={metadata} matchState={formatMatchState(eventDetails, firstWindowFrame, scheduleEvent)} records={records} results={results} scheduleEvent={scheduleEvent} />
                <DisabledGame eventDetails={eventDetails} gameIndex={gameIndex} gameMetadata={metadata} firstWindowFrame={firstWindowFrame} records={records} />
            </div>
        );
    } else if (eventDetails !== undefined) {
        document.title = `🟡 ${eventDetails.league.name} - ${eventDetails?.match.teams[0].name} vs. ${eventDetails?.match.teams[1].name}`;
        return (
            <div>
                <div className="loading-game-container">
                    <div>
                        {eventDetails ? (<h3>{eventDetails?.league.name}</h3>) : null}
                        <div className="live-game-card-content">
                            <div className="live-game-card-team">
                                {eventDetails.match.teams[0].code === "TBD" ? (<TeamTBDSVG className="live-game-card-team-image" />) : (<img className="live-game-card-team-image" src={eventDetails.match.teams[0].image} alt={eventDetails.match.teams[0].name} />)}
                                <span className="live-game-card-title">
                                    <span>
                                        <h4>
                                            {eventDetails?.match.teams[0].name}
                                        </h4>
                                    </span>
                                    {currentGameOutcome ?
                                        (<span className="outcome">
                                            <p className={currentGameOutcome[0].outcome}>
                                                {currentGameOutcome[0].outcome}
                                            </p>
                                        </span>)
                                        : null}
                                    {records ?
                                        (<span>
                                            <p>
                                                {records[0].wins} - {records[0].losses}
                                            </p>
                                        </span>)
                                        : null}
                                </span>
                            </div>
                            <div className="game-card-versus">
                                <span>BEST OF {eventDetails.match.strategy.count}</span>
                                {eventDetails.match.teams[0].result && eventDetails.match.teams[1].result ?
                                    (<span>
                                        <p>
                                            {eventDetails.match.teams[0].result.gameWins} - {eventDetails.match.teams[1].result.gameWins}
                                        </p>
                                    </span>)
                                    : null}
                                <h1>VS</h1>
                            </div>
                            <div className="live-game-card-team">
                                {eventDetails.match.teams[1].code === "TBD" ? (<TeamTBDSVG className="live-game-card-team-image" />) : (<img className="live-game-card-team-image" src={eventDetails.match.teams[1].image} alt={eventDetails.match.teams[1].name} />)}
                                <span className="live-game-card-title">
                                    <span>
                                        <h4>
                                            {eventDetails?.match.teams[1].name}
                                        </h4>
                                    </span>
                                    {currentGameOutcome ?
                                        (<span className="outcome">
                                            <p className={currentGameOutcome[1].outcome}>
                                                {currentGameOutcome[1].outcome}
                                            </p>
                                        </span>)
                                        : null}
                                    {records ?
                                        (<span>
                                            <p>
                                                {records[1].wins} - {records[1].losses}
                                            </p>
                                        </span>)
                                        : null}
                                </span>
                            </div>
                        </div>
                        {scheduleEvent && eventDetails ?
                            (<h3>Game {getNextUnstartedGameIndex(eventDetails)} out of {eventDetails.match.strategy.count} will start at {new Date(scheduleEvent.startTime).toLocaleTimeString([], { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</h3>)
                            : null
                        }

                        <img className="loading-game-image" alt="game loading" src={Loading} />
                    </div>
                </div>
                <div className="status-live-game-card">
                    <GameDetails eventDetails={eventDetails} gameIndex={gameIndex || 0} />
                    <div className="status-live-game-card-content">
                        {metadata ? (
                            <div>
                                <span className="footer-notes">
                                    <a target="_blank" href={`https://www.leagueoflegends.com/en-us/news/game-updates/patch-25-${metadata.patchVersion.split(`.`)[1].length > 1 ? metadata.patchVersion.split(`.`)[1] : "" + metadata.patchVersion.split(`.`)[1]}-notes/`}>Patch Version: {metadata.patchVersion}</a>
                                </span>
                                <button type="button" className="footer-notes copy-champion-names" onClick={copyChampionNames}>
                                    Copy Champion Names
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        )
    } else {
        return (
            <div className="loading-game-container">
                <div>
                    <img className="loading-game-image" alt="game loading" src={Loading} />
                </div>
            </div>
        )
    }
}

function getTeamsForGame(eventDetails: EventDetails, gameIndex: number) {
    const homeTeam = eventDetails.match.teams[0]
    const awayTeam = eventDetails.match.teams[1]
    const selectedGame = eventDetails.match.games[gameIndex - 1]

    if (!selectedGame) {
        return undefined
    }

    const blueTeam = selectedGame.teams[0].id === homeTeam.id ? homeTeam : awayTeam
    const redTeam = selectedGame.teams[1].id === homeTeam.id ? homeTeam : awayTeam

    return {
        blueTeam,
        redTeam,
        selectedGame,
    }
}

function getOutcomeForGame(eventDetails: EventDetails, gameIndex: number, lastWindowFrame: WindowFrame): Array<Outcome> {
    const teamsForGame = getTeamsForGame(eventDetails, gameIndex)
    if (!teamsForGame) {
        return [
            { outcome: undefined },
            { outcome: undefined },
        ]
    }

    const { blueTeam, redTeam, selectedGame } = teamsForGame
    const cleanSweep = selectedGame.state === `completed` && (eventDetails.match.teams[0].result.gameWins === 0 || eventDetails.match.teams[1].result.gameWins === 0)
    const completedGames = eventDetails.match.games.filter(game => game.state === "completed").length
    const blueTeamWonMatch = eventDetails.match.games.every(game => game.state === `completed` || game.state === `unneeded`) && blueTeam.result.gameWins > redTeam.result.gameWins
    const redTeamWonMatch = eventDetails.match.games.every(game => game.state === `completed` || game.state === `unneeded`) && redTeam.result.gameWins > blueTeam.result.gameWins

    const blueTeamWonOnInhibitors = lastWindowFrame.blueTeam.inhibitors > 0 && lastWindowFrame.redTeam.inhibitors === 0
    const redTeamWonOnInhibitors = lastWindowFrame.redTeam.inhibitors > 0 && lastWindowFrame.blueTeam.inhibitors === 0
    const blueTeamWon = selectedGame.state === `completed` && (blueTeam.result.outcome === `win` || (cleanSweep && blueTeam.result.gameWins > 0) || blueTeamWonOnInhibitors || (blueTeamWonMatch && (gameIndex - 1) === completedGames))
    const redTeamWon = selectedGame.state === `completed` && (redTeam.result.outcome === `win` || (cleanSweep && redTeam.result.gameWins > 0) || redTeamWonOnInhibitors || (redTeamWonMatch && (gameIndex - 1) === completedGames))

    return [
        {
            outcome: blueTeamWon ? `win` : redTeamWon ? `loss` : undefined,
        },
        {
            outcome: redTeamWon ? `win` : blueTeamWon ? `loss` : undefined
        }
    ]
}

function getFinishedWinner(eventDetails: EventDetails, gameIndex: number, outcome: Array<Outcome>): FinishedWinner | undefined {
    const teamsForGame = getTeamsForGame(eventDetails, gameIndex)
    if (!teamsForGame) {
        return undefined
    }

    if (outcome[0]?.outcome === 'win') {
        return {
            teamName: teamsForGame.blueTeam.name,
            teamSide: 'blue',
        }
    }

    if (outcome[1]?.outcome === 'win') {
        return {
            teamName: teamsForGame.redTeam.name,
            teamSide: 'red',
        }
    }

    return undefined
}

function getNextUnstartedGameIndex(eventDetails: EventDetails) {
    let lastCompletedGame = eventDetails.match.games.slice().reverse().find(game => game.state === "completed")
    let nextUnstartedGame = eventDetails.match.games.find(game => game.state === "unstarted" || game.state === "inProgress")
    return nextUnstartedGame ? nextUnstartedGame.number : (lastCompletedGame ? lastCompletedGame.number : eventDetails.match.games.length)
}

function formatMatchState(eventDetails: EventDetails, lastWindowFrame: WindowFrame, scheduleEvent: ScheduleEvent): string {
    let gameStates = {
        "in_game": "In Progress",
        "paused": "Paused",
        "finished": "Finished",
        "completed": "Finished",
        "unstarted": "Unstarted",
        "inProgress": "In Progress"
    }

    if (eventDetails.match.games.length === 1) return gameStates[lastWindowFrame.gameState]
    let gamesFinished = eventDetails.match.games.filter(game => game.state === `completed` || game.state === `unneeded`)
    return gameStates[gamesFinished.length >= eventDetails.match.games.length ? `completed` : scheduleEvent.state]
}

function mergeWindowFrameHistory(existingFrames: WindowFrame[], nextFrames: WindowFrame[]) {
    const framesByTimestamp = new Map<string, WindowFrame>();

    [...existingFrames, ...nextFrames].forEach(frame => {
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
    })
}

function getWindowHistoryBackfillStart(frameTimestamp: string) {
    const frameMs = Date.parse(frameTimestamp);
    if (Number.isNaN(frameMs)) {
        return undefined;
    }

    return new Date(frameMs - (60 * 60 * 1000)).toISOString();
}
