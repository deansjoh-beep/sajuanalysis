type TelemetryFeature = 'chat' | 'report';

type TelemetryPhase = 'success' | 'failure' | 'fallback';

interface ModelTelemetryEvent {
  feature: TelemetryFeature;
  phase: TelemetryPhase;
  model: string;
  requestId: string;
  durationMs?: number;
  errorCode?: number | null;
  errorStatus?: string | null;
  timestamp: string;
}

interface ModelTelemetryBucket {
  attempts: number;
  success: number;
  failure: number;
  fallbacks: number;
  totalDurationMs: number;
  avgDurationMs: number;
  successRate: number;
  lastErrorCode: number | null;
  lastErrorStatus: string | null;
  updatedAt: string;
}

interface ModelTelemetryStore {
  events: ModelTelemetryEvent[];
  buckets: Record<string, ModelTelemetryBucket>;
  updatedAt: string;
}

const STORAGE_KEY = 'saju_model_telemetry_v1';
const MAX_EVENTS = 250;
const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const nowIso = () => new Date().toISOString();

const toBucketKey = (feature: TelemetryFeature, model: string) => `${feature}::${model}`;

const round2 = (value: number) => Math.round(value * 100) / 100;

const readStore = (): ModelTelemetryStore => {
  if (typeof window === 'undefined') {
    return { events: [], buckets: {}, updatedAt: nowIso() };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { events: [], buckets: {}, updatedAt: nowIso() };
    }

    const parsed = JSON.parse(raw) as ModelTelemetryStore;
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      buckets: parsed.buckets && typeof parsed.buckets === 'object' ? parsed.buckets : {},
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso()
    };
  } catch {
    return { events: [], buckets: {}, updatedAt: nowIso() };
  }
};

const saveStore = (store: ModelTelemetryStore) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
};

export const recordModelTelemetry = (event: Omit<ModelTelemetryEvent, 'timestamp'>) => {
  const stampedEvent: ModelTelemetryEvent = {
    ...event,
    timestamp: nowIso()
  };

  const store = readStore();
  const nextEvents = [...store.events, stampedEvent].slice(-MAX_EVENTS);

  const bucketKey = toBucketKey(stampedEvent.feature, stampedEvent.model);
  const prevBucket = store.buckets[bucketKey] || {
    attempts: 0,
    success: 0,
    failure: 0,
    fallbacks: 0,
    totalDurationMs: 0,
    avgDurationMs: 0,
    successRate: 0,
    lastErrorCode: null,
    lastErrorStatus: null,
    updatedAt: nowIso()
  };

  const nextBucket = { ...prevBucket };

  if (stampedEvent.phase === 'success') {
    nextBucket.attempts += 1;
    nextBucket.success += 1;
    if (typeof stampedEvent.durationMs === 'number') {
      nextBucket.totalDurationMs += stampedEvent.durationMs;
    }
  }

  if (stampedEvent.phase === 'failure') {
    nextBucket.attempts += 1;
    nextBucket.failure += 1;
    nextBucket.lastErrorCode = stampedEvent.errorCode ?? null;
    nextBucket.lastErrorStatus = stampedEvent.errorStatus ?? null;
    if (typeof stampedEvent.durationMs === 'number') {
      nextBucket.totalDurationMs += stampedEvent.durationMs;
    }
  }

  if (stampedEvent.phase === 'fallback') {
    nextBucket.fallbacks += 1;
    nextBucket.lastErrorCode = stampedEvent.errorCode ?? null;
    nextBucket.lastErrorStatus = stampedEvent.errorStatus ?? null;
  }

  nextBucket.avgDurationMs = nextBucket.attempts > 0 ? Math.round(nextBucket.totalDurationMs / nextBucket.attempts) : 0;
  nextBucket.successRate = nextBucket.attempts > 0 ? round2((nextBucket.success / nextBucket.attempts) * 100) : 0;
  nextBucket.updatedAt = nowIso();

  const nextStore: ModelTelemetryStore = {
    events: nextEvents,
    buckets: {
      ...store.buckets,
      [bucketKey]: nextBucket
    },
    updatedAt: nowIso()
  };

  saveStore(nextStore);

  if (isDev) {
    console.info('[MODEL_TELEMETRY]', stampedEvent);
  }
};

export const getModelTelemetrySnapshot = (): ModelTelemetryStore => readStore();

export const clearModelTelemetry = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
};
