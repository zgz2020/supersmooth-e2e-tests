import type { Options } from 'k6/options';
import { getEnv } from './environments.ts';
import { loadStages, soakStages, spikeStages, stressStages } from './stages.ts';
import { smokeThresholds, standardThresholds, stressThresholds } from './thresholds.ts';

export type PerformanceProfileName = 'smoke' | 'load' | 'stress' | 'spike' | 'soak';

const isPerformanceProfileName = (val: string): val is PerformanceProfileName =>
  (['smoke', 'load', 'stress', 'spike', 'soak'] as const).includes(val as PerformanceProfileName);

export function getSelectedProfileName(): PerformanceProfileName {
  const profile = (getEnv('K6_PROFILE') || 'smoke').toLowerCase();
  return isPerformanceProfileName(profile) ? profile : 'smoke';
}

export const PROFILE_CONFIGS: Record<PerformanceProfileName, Options> = {
  smoke: {
    vus: 1,
    duration: '30s',
    thresholds: smokeThresholds,
  },
  load: {
    stages: loadStages,
    thresholds: standardThresholds,
  },
  stress: {
    stages: stressStages,
    thresholds: stressThresholds,
  },
  spike: {
    stages: spikeStages,
    thresholds: stressThresholds,
  },
  soak: {
    stages: soakStages,
    thresholds: standardThresholds,
  },
};

export function getProfileOptions(profileName?: PerformanceProfileName): Options {
  const vusEnv = getEnv('K6_VUS');
  const customVus = vusEnv ? parseInt(vusEnv, 10) : undefined;
  const customDuration = getEnv('K6_DURATION');

  if (customVus !== undefined || customDuration !== undefined) {
    return {
      vus: customVus || 1,
      duration: customDuration || '30s',
      thresholds: standardThresholds,
    };
  }

  const name = profileName || getSelectedProfileName();
  return PROFILE_CONFIGS[name];
}
