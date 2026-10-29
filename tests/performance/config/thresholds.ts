export const smokeThresholds: Record<string, string[]> = {
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
  'http_req_duration{type:api_fast}': ['p(95)<500'],
  'http_req_duration{type:api_agg}': ['p(95)<1200'],
  'http_req_duration{type:rpc}': ['p(95)<1800'],
  'http_req_duration{type:web}': ['p(95)<2000'],
  http_req_duration: ['p(95)<1500'],
};

export const standardThresholds: Record<string, string[]> = {
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
  'http_req_duration{type:api_fast}': ['p(90)<400', 'p(95)<600'],
  'http_req_duration{type:api_agg}': ['p(90)<800', 'p(95)<1200'],
  'http_req_duration{type:rpc}': ['p(90)<1200', 'p(95)<1800'],
  'http_req_duration{type:web}': ['p(90)<1200', 'p(95)<2000'],
  http_req_duration: ['p(90)<800', 'p(95)<1400', 'p(99)<2500'],
};

export const stressThresholds: Record<string, string[]> = {
  http_req_failed: ['rate<0.05'],
  checks: ['rate>0.95'],
  'http_req_duration{type:api_fast}': ['p(95)<1200'],
  'http_req_duration{type:api_agg}': ['p(95)<2500'],
  'http_req_duration{type:rpc}': ['p(95)<3000'],
  'http_req_duration{type:web}': ['p(95)<3500'],
  http_req_duration: ['p(95)<3000', 'p(99)<5000'],
};
