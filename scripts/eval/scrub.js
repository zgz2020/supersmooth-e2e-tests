/**
 * Removes secrets from text before it is committed (eval dataset cases) or sent to an LLM.
 *
 * Covers private keys and other 64-hex values, key-bearing URLs (query keys and RPC provider path
 * keys), webhook URLs, GitHub / Google API tokens, bearer tokens and, when given, the literal
 * values of secret environment variables.
 */
import process from 'node:process';

const REDACTED = '<redacted>';

const PATTERNS = [
  // Discord / Slack webhooks (before the generic URL rules)
  [
    /https:\/\/(?:\w+\.)?discord(?:app)?\.com\/api\/webhooks\/[^\s"'`)]+/gi,
    `https://discord.com/api/webhooks/${REDACTED}`,
  ],
  [
    /https:\/\/hooks\.slack\.com\/services\/[^\s"'`)]+/gi,
    `https://hooks.slack.com/services/${REDACTED}`,
  ],
  // Keys in query strings: ?key=..., &apikey=..., &token=...
  [
    /([?&](?:key|api[_-]?key|apikey|token|access[_-]?token|dkey|secret)=)[^&\s"'`)]+/gi,
    `$1${REDACTED}`,
  ],
  // RPC provider keys in the path: /v2/<key> (Alchemy), /v3/<key> (Infura), /rpc/<key>
  [/(\/(?:v2|v3|rpc)\/)[A-Za-z0-9_-]{20,}/g, `$1${REDACTED}`],
  // Tokens
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, REDACTED],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}\b/g, REDACTED],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, REDACTED],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/g, `$1${REDACTED}`],
  // Local home directories (user names)
  [/\/(Users|home)\/[^/\s"'`]+\//g, '/$1/<user>/'],
  // Private keys (and any other 64-hex value, e.g. tx hashes: harmless to redact)
  [/\b(0x)?[a-fA-F0-9]{64}\b/g, `<redacted:hex64>`],
];

const SECRET_ENV_NAME = /KEY|TOKEN|SECRET|PASSWORD|PRIVATE|_PK$|WEBHOOK/i;

/** Literal values of secret-looking environment variables, longest first. */
export function secretEnvValues(env = process.env) {
  return Object.entries(env)
    .filter(([name, value]) => SECRET_ENV_NAME.test(name) && typeof value === 'string')
    .map(([, value]) => value)
    .filter((value) => value.length >= 8)
    .sort((a, b) => b.length - a.length);
}

/** @param {string} text @param {{ secrets?: string[] }} [options] */
export function scrubText(text, { secrets = [] } = {}) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const secret of secrets) out = out.split(secret).join(REDACTED);
  for (const [pattern, replacement] of PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

/** Deep-scrubs every string in a JSON-like value. */
export function scrubDeep(value, options) {
  if (typeof value === 'string') return scrubText(value, options);
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, options));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubDeep(v, options)]));
  }
  return value;
}
