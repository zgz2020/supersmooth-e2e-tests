import type { Address } from '../types/api/common';

export const validAddress: Address = '0x9e3663d0a9F97Cde94E22407d603782B7E7101ED';
export const unsignedAddress: Address = '0x6467e807dB1E71B9Ef04E0E3aFb962E4B0900B2B';
export const zeroAddress: Address = '0x0000000000000000000000000000000000000000';
export const sanctionedAddress: Address = '0x8576aCC5C05D6Ce88f4e49bf65BdF0C62F91353C';
export const defaultTestWalletAddress: Address = '0x44E361c3D9dcd703D535f9c2883a4E104AD2F4d5';

/**
 * Live staging fixture for `/api/migrate/adoptable-safes`: a Safe owned only by `validAddress`,
 * without the Supersmooth module, holding an Aave v3 borrow on Base.
 * The app only lists Safes whose Aave/Spark collateral is >= $1 (MIN_LENDING_MIGRATION_USD), so if
 * the adoptable-safes tests fail, check this Safe's collateral first (it is priced in WETH).
 * Never connect it to Supersmooth or enable the module: it would stop being adoptable.
 */
export const adoptableSafeFixture = {
  owner: validAddress,
  safe: '0xEd8696301C9Dc00Ac26aAB1A0Ef1F4E113688F1F' as Address,
  chainId: 8453,
} as const;

// Canonical Foundry / Anvil test accounts
export const anvilAccount0Address: Address = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
export const anvilAccount1Address: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

// Canonical token contracts
export const wethMainnetAddress: Address = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

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
