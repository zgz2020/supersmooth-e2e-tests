import { Buffer } from 'node:buffer';
import type { DecodedRevert } from '../types/api/rpc';

export const ERROR_STRING_SELECTOR = '0x08c379a0';
export const PANIC_SELECTOR = '0x4e487b71';

export const PANIC_REASONS: Record<number, string> = {
  0x00: 'Generic compiler panic',
  0x01: 'Assert evaluated to false',
  0x11: 'Arithmetic operation underflowed or overflowed',
  0x12: 'Division or modulo by zero',
  0x21: 'Enum conversion out of bounds',
  0x22: 'Access to incorrectly encoded storage byte array',
  0x31: 'Empty array pop',
  0x32: 'Array index out of bounds or negative index',
  0x41: 'Too much memory allocated',
  0x51: 'Call to uninitialized internal function pointer',
};

/**
 * Decodes hex error data returned by eth_call / eth_estimateGas reverts.
 * Supports:
 * - Error(string) (0x08c379a0)
 * - Panic(uint256) (0x4e487b71)
 * - Custom errors (extracts 4-byte selector)
 */
export function decodeRevertReason(errorData: unknown): DecodedRevert {
  let hexString: string | undefined;

  if (typeof errorData === 'string') {
    hexString = errorData;
  } else if (errorData && typeof errorData === 'object') {
    const candidate = (errorData as Record<string, unknown>).data;
    if (typeof candidate === 'string') {
      hexString = candidate;
    } else if (candidate && typeof candidate === 'object') {
      hexString = (candidate as Record<string, unknown>).data as string;
    }
  }

  if (!hexString || typeof hexString !== 'string' || !hexString.startsWith('0x')) {
    return { type: 'Unknown', raw: String(errorData ?? '') };
  }

  const cleanHex = hexString.slice(2);
  if (cleanHex.length < 8) {
    return { type: 'Unknown', raw: hexString };
  }

  const selector = `0x${cleanHex.slice(0, 8).toLowerCase()}`;
  const payload = cleanHex.slice(8);

  if (selector === ERROR_STRING_SELECTOR) {
    // ABI format for Error(string):
    // bytes 0..32 (hex 0..64): offset to string data (usually 0x20 = 32)
    // bytes 32..64 (hex 64..128): string length
    // bytes 64.. (hex 128..): UTF-8 string bytes
    if (payload.length >= 128) {
      try {
        const lengthHex = payload.slice(64, 128);
        const length = parseInt(lengthHex, 16);
        const strHex = payload.slice(128, 128 + length * 2);
        const message = Buffer.from(strHex, 'hex').toString('utf8').replace(/\0+$/, '');
        return {
          type: 'Error',
          selector,
          message,
          raw: hexString,
        };
      } catch {
        return { type: 'Error', selector, message: 'Unparseable Error(string)', raw: hexString };
      }
    }
    return { type: 'Error', selector, message: '', raw: hexString };
  }

  if (selector === PANIC_SELECTOR) {
    // ABI format for Panic(uint256):
    // bytes 0..32 (hex 0..64): panic code
    if (payload.length >= 64) {
      const codeHex = payload.slice(0, 64);
      const code = parseInt(codeHex, 16);
      return {
        type: 'Panic',
        selector,
        code,
        reason: PANIC_REASONS[code] || `Unknown panic code (${code})`,
        raw: hexString,
      };
    }
  }

  return {
    type: 'Custom',
    selector,
    raw: hexString,
  };
}
