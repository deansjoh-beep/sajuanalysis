type CooldownFeature = 'chat' | 'report';

interface FeatureCooldownState {
  retryableFailureTimestamps: number[];
  cooldownUntil: number;
}

interface CooldownStore {
  chat: FeatureCooldownState;
  report: FeatureCooldownState;
}

const STORAGE_KEY = 'saju_model_cooldown_v1';
const FAILURE_WINDOW_MS = 2 * 60 * 1000;
const FAILURE_THRESHOLD = 4;
const COOLDOWN_MS = 25 * 1000;

const createDefaultFeatureState = (): FeatureCooldownState => ({
  retryableFailureTimestamps: [],
  cooldownUntil: 0
});

const createDefaultStore = (): CooldownStore => ({
  chat: createDefaultFeatureState(),
  report: createDefaultFeatureState()
});

const readStore = (): CooldownStore => {
  if (typeof window === 'undefined') {
    return createDefaultStore();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultStore();
    }

    const parsed = JSON.parse(raw) as Partial<CooldownStore>;
    return {
      chat: {
        retryableFailureTimestamps: Array.isArray(parsed?.chat?.retryableFailureTimestamps)
          ? parsed!.chat!.retryableFailureTimestamps
          : [],
        cooldownUntil: Number(parsed?.chat?.cooldownUntil) || 0
      },
      report: {
        retryableFailureTimestamps: Array.isArray(parsed?.report?.retryableFailureTimestamps)
          ? parsed!.report!.retryableFailureTimestamps
          : [],
        cooldownUntil: Number(parsed?.report?.cooldownUntil) || 0
      }
    };
  } catch {
    return createDefaultStore();
  }
};

const saveStore = (store: CooldownStore) => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors
  }
};

const filterRecentFailures = (timestamps: number[], now: number): number[] => {
  const from = now - FAILURE_WINDOW_MS;
  return timestamps.filter((ts) => ts >= from);
};

export const getModelCooldownRemainingMs = (feature: CooldownFeature): number => {
  const store = readStore();
  const now = Date.now();
  const remaining = store[feature].cooldownUntil - now;
  return remaining > 0 ? remaining : 0;
};

export const recordRetryableModelFailure = (feature: CooldownFeature): number => {
  const store = readStore();
  const now = Date.now();
  const featureState = store[feature];

  const recentFailures = filterRecentFailures(featureState.retryableFailureTimestamps, now);
  recentFailures.push(now);

  let cooldownUntil = featureState.cooldownUntil;
  if (recentFailures.length >= FAILURE_THRESHOLD) {
    cooldownUntil = Math.max(cooldownUntil, now + COOLDOWN_MS);
  }

  const nextStore: CooldownStore = {
    ...store,
    [feature]: {
      retryableFailureTimestamps: recentFailures,
      cooldownUntil
    }
  };

  saveStore(nextStore);

  return cooldownUntil > now ? cooldownUntil - now : 0;
};

export const recordModelRequestSuccess = (feature: CooldownFeature) => {
  const store = readStore();

  const nextStore: CooldownStore = {
    ...store,
    [feature]: {
      retryableFailureTimestamps: [],
      cooldownUntil: 0
    }
  };

  saveStore(nextStore);
};

export const waitForModelCooldownIfNeeded = async (feature: CooldownFeature): Promise<number> => {
  const remaining = getModelCooldownRemainingMs(feature);
  if (remaining <= 0) {
    return 0;
  }

  await new Promise((resolve) => setTimeout(resolve, remaining));
  return remaining;
};
