import './styles/playerStatusStyle.css'
import '../Schedule/styles/scheduleStyle.css'

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { EventDetails } from "../types/baseTypes";
import { logLivePerf } from "../../utils/livePerf";

type Props = {
    eventDetails: EventDetails,
    gameIndex: number
}

export function GameDetails({ eventDetails, gameIndex }: Props) {
    useEffect(() => {
        logLivePerf('game_selector_rendered', {
            gameCount: eventDetails.match.games.length,
            gameIndex,
            matchId: eventDetails.id,
        });
    }, [eventDetails.id, eventDetails.match.games.length, gameIndex]);

    return (
        (eventDetails.match.games.length > 1) ? (
            <div className='game-selector'>
                {eventDetails.match.games.map((game) => {
                    return <Link className={`game-selector-item ${game.state} ${gameIndex === game.number ? `selected` : ``}`} to={`/live/${eventDetails.id}/game-index/${game.number}`} key={`game-selector-${game.id}`}>
                        <span className={`#/live/${game.state}`}>Game {game.number} - {capitalizeFirstLetter(game.state)}</span>
                    </Link>
                })}

            </div>) : null
    )
}

function capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
}
