import type { Address } from '../types/api/common.ts';

export const validAddress: Address = '0x9e3663d0a9F97Cde94E22407d603782B7E7101ED';
export const unsignedAddress: Address = '0x6467e807dB1E71B9Ef04E0E3aFb962E4B0900B2B';
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

export interface TermsStatusAddressCase {
  signedStatus: boolean;
  params: { address: Address };
}

export const termsStatusAddresses: TermsStatusAddressCase[] = [
  { signedStatus: true, params: { address: validAddress } },
  { signedStatus: false, params: { address: unsignedAddress } },
];
