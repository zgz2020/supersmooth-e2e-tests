import type { Stage } from 'k6/options';

export const loadStages: Stage[] = [
  { duration: '20s', target: 10 },
  { duration: '1m', target: 10 },
  { duration: '15s', target: 0 },
];

export const stressStages: Stage[] = [
  { duration: '30s', target: 20 },
  { duration: '1m', target: 20 },
  { duration: '30s', target: 40 },
  { duration: '1m', target: 40 },
  { duration: '20s', target: 0 },
];

export const spikeStages: Stage[] = [
  { duration: '10s', target: 50 },
  { duration: '30s', target: 50 },
  { duration: '10s', target: 0 },
];

export const soakStages: Stage[] = [
  { duration: '30s', target: 10 },
  { duration: '5m', target: 10 },
  { duration: '30s', target: 0 },
];
