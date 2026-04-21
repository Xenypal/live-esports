type LivePerfContext = Record<string, string | number | boolean | Date | undefined>;

type LivePerfEntry = LivePerfContext & {
  at: string;
  perfNowMs: number;
  phase: string;
  scope: 'client-main';
};

type PerfWindow = Window & {
  __livePerfLog?: LivePerfEntry[];
};

function parseTimestamp(timestamp?: string | Date) {
  if (!timestamp) {
    return undefined;
  }

  const parsed = timestamp instanceof Date ? timestamp.getTime() : Date.parse(timestamp);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function getFrameFreshnessContext(context: {
  detailsFrameTimestamp?: string | Date;
  firstFrameTimestamp?: string | Date;
  windowFrameTimestamp?: string | Date;
}) {
  const now = Date.now();
  const firstFrameMs = parseTimestamp(context.firstFrameTimestamp);
  const windowFrameMs = parseTimestamp(context.windowFrameTimestamp);
  const detailsFrameMs = parseTimestamp(context.detailsFrameTimestamp);

  return {
    detailsFrameAgeMs: detailsFrameMs !== undefined ? now - detailsFrameMs : undefined,
    detailsBehindWindowMs: detailsFrameMs !== undefined && windowFrameMs !== undefined ? windowFrameMs - detailsFrameMs : undefined,
    displayedGameTimeSeconds: firstFrameMs !== undefined && windowFrameMs !== undefined
      ? Math.max(0, Math.round((windowFrameMs - firstFrameMs) / 1000))
      : undefined,
    firstFrameAgeMs: firstFrameMs !== undefined ? now - firstFrameMs : undefined,
    nowEpochMs: now,
    windowFrameAgeMs: windowFrameMs !== undefined ? now - windowFrameMs : undefined,
  };
}

export function isLivePerfEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get('perfLog') === '1') {
    return true;
  }

  const hashQuery = window.location.hash.split('?')[1];
  if (!hashQuery) {
    return false;
  }

  return new URLSearchParams(hashQuery).get('perfLog') === '1';
}

export function logLivePerf(phase: string, context?: LivePerfContext) {
  if (!isLivePerfEnabled() || typeof window === 'undefined') {
    return;
  }

  const entry: LivePerfEntry = {
    ...context,
    at: new Date().toISOString(),
    perfNowMs: Number(performance.now().toFixed(3)),
    phase,
    scope: 'client-main',
  };

  const perfWindow = window as PerfWindow;
  perfWindow.__livePerfLog = perfWindow.__livePerfLog || [];
  perfWindow.__livePerfLog.push(entry);
}

export function resetLivePerfLog() {
  if (!isLivePerfEnabled() || typeof window === 'undefined') {
    return;
  }

  (window as PerfWindow).__livePerfLog = [];
}
