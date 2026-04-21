import axios from "axios";
import { getFrameFreshnessContext, logLivePerf } from "./livePerf";

//export const ITEMS_URL = "https://ddragon.leagueoflegends.com/cdn/14.3.1/img/item/"
// export const CHAMPIONS_URL = "https://ddragon.bangingheads.net/cdn/14.3.1/img/champion/"
// const ITEMS_JSON_URL = `https://ddragon.leagueoflegends.com/cdn/14.3.1/data/en_US/item.json`
export const ITEMS_URL = "https://ddragon.leagueoflegends.com/cdn/PATCH_VERSION/img/item/"
export const CHAMPIONS_URL = "https://ddragon.leagueoflegends.com/cdn/PATCH_VERSION/img/champion/"
export const RUNES_JSON_URL = "https://ddragon.leagueoflegends.com/cdn/PATCH_VERSION/data/en_US/runesReforged.json"
export const ITEMS_JSON_URL = `https://ddragon.leagueoflegends.com/cdn/PATCH_VERSION/data/en_US/item.json`

const API_URL_PERSISTED = "https://esports-api.lolesports.com/persisted/gw"
const API_URL_LIVE = "https://feed.lolesports.com/livestats/v1"
const API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z"

let secondDelay = 60
let count = 0
let failureCount = 0

export function getScheduleResponse() {
    const startedAt = performance.now();
    logLivePerf('schedule_request_start');
    return axios.get(`${API_URL_PERSISTED}/getSchedule?hl=en-US`, {
        headers: {
            "x-api-key": API_KEY,
        },
    }).then(response => {
        logLivePerf('schedule_request_success', {
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
        });
        return response;
    }).catch(error => {
        logLivePerf('schedule_request_error', {
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
            message: error?.message,
        });
        throw error;
    })
}

export function getWindowResponse(gameId: string, date?: string) {
    const startedAt = performance.now();
    logLivePerf('window_request_start', {
        gameId,
        secondDelay,
        startingTime: date,
        type: date ? 'live' : 'initial',
    });
    return axios.get(`${API_URL_LIVE}/window/${gameId}`, {
        params: {
            "startingTime": date,
        },
        headers: {
        },
    }).then(response => {
        const frameTimestamp = response.data?.frames?.[response.data.frames.length - 1]?.rfc460Timestamp;
        logLivePerf('window_request_success', {
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
            frameTimestamp,
            gameId,
            secondDelay,
            startingTime: date,
            type: date ? 'live' : 'initial',
            ...getFrameFreshnessContext({
                windowFrameTimestamp: frameTimestamp,
            }),
        });
        return response;
    }).catch(function (error) {
        logLivePerf('window_request_error', {
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
            gameId,
            message: error?.response?.data?.message || error?.message,
            secondDelay,
            startingTime: date,
            type: date ? 'live' : 'initial',
        });
        return undefined;
    })
}

export function getGameDetailsResponse(gameId: string, date: string, lastFrameSuccess: boolean) {
    const startedAt = performance.now();
    if (count++ % 10 === 0) {
        failureCount = 0
        secondDelay -= 10
    }
    if (lastFrameSuccess) {
        failureCount = 0
    } else {
        failureCount++
    }
    logLivePerf('details_request_start', {
        count,
        failureCount,
        gameId,
        lastFrameSuccess,
        secondDelay,
        startingTime: date,
    });
    return axios.get(`${API_URL_LIVE}/details/${gameId}`, {
        params: {
            "startingTime": date,
        },
        headers: {
        },
    }).then(response => {
        const frameTimestamp = response.data?.frames?.[response.data.frames.length - 1]?.rfc460Timestamp;
        logLivePerf('details_request_success', {
            count,
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
            failureCount,
            frameTimestamp,
            gameId,
            secondDelay,
            startingTime: date,
            ...getFrameFreshnessContext({
                detailsFrameTimestamp: frameTimestamp,
            }),
        });
        return response;
    }).catch(function (error) {
        if (error.response) {
            if (!error.response.data.message.includes(`window with end time less than`) || failureCount < 6) {
                logLivePerf('details_request_error', {
                    count,
                    durationMs: Number((performance.now() - startedAt).toFixed(3)),
                    failureCount,
                    gameId,
                    message: error.response.data.message,
                    secondDelay,
                    startingTime: date,
                });
                return
            }
            count = 1
            failureCount = 0
            secondDelay += 10
            logLivePerf('details_delay_adjusted', {
                gameId,
                nextSecondDelay: secondDelay,
                reason: error.response.data.message,
            });
        }

        return undefined;
    })
}

export function getEventDetailsResponse(gameId: string) {
    const startedAt = performance.now();
    logLivePerf('event_details_request_start', { gameId });
    return axios.get(`${API_URL_PERSISTED}/getEventDetails`, {
        params: {
            "hl": "en-US",
            "id": gameId,
        },
        headers: {
            "x-api-key": API_KEY,
        },
    }).then(response => {
        logLivePerf('event_details_request_success', {
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
            gameId,
        });
        return response;
    }).catch(error => {
        logLivePerf('event_details_request_error', {
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
            gameId,
            message: error?.message,
        });
        throw error;
    })
}

export function getStandingsResponse(tournamentId: string) {
    const startedAt = performance.now();
    logLivePerf('standings_request_start', { tournamentId });
    return axios.get(`${API_URL_PERSISTED}/getStandings`, {
        params: {
            "hl": "en-US",
            "tournamentId": tournamentId,
        },
        headers: {
            "x-api-key": API_KEY,
        },
    }).then(response => {
        logLivePerf('standings_request_success', {
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
            tournamentId,
        });
        return response;
    }).catch(error => {
        logLivePerf('standings_request_error', {
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
            message: error?.message,
            tournamentId,
        });
        throw error;
    })
}

export function getDataDragonResponse(JSON_URL: string, formattedPatchVersion: string) {
    const startedAt = performance.now();
    const url = JSON_URL.replace(`PATCH_VERSION`, formattedPatchVersion);
    logLivePerf('datadragon_request_start', {
        formattedPatchVersion,
        url,
    });
    return axios.get(url).then(response => {
        logLivePerf('datadragon_request_success', {
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
            formattedPatchVersion,
            url,
        });
        return response;
    }).catch(error => {
        logLivePerf('datadragon_request_error', {
            durationMs: Number((performance.now() - startedAt).toFixed(3)),
            formattedPatchVersion,
            message: error?.message,
            url,
        });
        throw error;
    })
}


export function getISODateMultiplyOf10() {
    const date = new Date();
    date.setMilliseconds(0);

    if (date.getSeconds() % 10 !== 0) {
        date.setSeconds(date.getSeconds() - (date.getSeconds() % 10));
    }

    date.setSeconds(date.getSeconds() - secondDelay);

    return date.toISOString();
}

export function getFormattedPatchVersion(patchVersion: string) {
    return patchVersion.split(`.`).slice(0, 2).join(`.`) + `.1`
}
