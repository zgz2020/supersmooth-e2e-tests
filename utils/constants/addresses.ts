import type { Address } from '../types/api/common.js';

export const validAddress: Address = '0x9e3663d0a9F97Cde94E22407d603782B7E7101ED';
export const zeroAddress: Address = '0x0000000000000000000000000000000000000000';
export const sanctionedAddress: Address = '0x8576aCC5C05D6Ce88f4e49bf65BdF0C62F91353C';

export interface InvalidAddressCase {
  description: string;
  params?: { address: string };
}

export const invalidAddressCases: InvalidAddressCase[] = [
  { description: 'missing', params: undefined },
  { description: 'empty', params: { address: '' } },
  { description: 'invalid string', params: { address: 'invalid-address' } },
  { description: 'short hex', params: { address: '0x123' } },
];
