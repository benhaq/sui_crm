// Copyright (c), Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
  SealClient,
  SealCompatibleClient,
  getAllowlistedKeyServers,
} from '@mysten/seal';
import { fromHex, toHex } from '@mysten/sui/utils';
import { getRandomRpcProvider } from './sui-blockchain';

export enum UploadMode {
  PUBLIC = 'public',
  PRIVATE = 'private',
}

export interface WalrusUploadOptions {
  file: Uint8Array<ArrayBufferLike>;
  policyObject: string; // Required for private mode
  packageId: string; // Required for private mode
  //   keyId: string;
}

export interface EncryptResult {
  encryptedObject: Uint8Array;
}

const NUM_EPOCH = 1;

export const encryptBlob = async ({
  file,
  policyObject,
  packageId,
}: //   keyId,
WalrusUploadOptions): Promise<EncryptResult> => {
  const suiClient = getRandomRpcProvider();
  if (!policyObject || !packageId || !suiClient) {
    throw new Error(
      'Missing parameters for private upload: policyObject, packageId, or suiClient',
    );
  }
  const client = new SealClient({
    suiClient: suiClient as any as SealCompatibleClient,
    serverObjectIds: getAllowlistedKeyServers('testnet').map(
      (id) => [id, 1] as [string, number],
    ),
    verifyKeyServers: false,
  });

  const nonce = crypto.getRandomValues(new Uint8Array(5));
  const policyObjectBytes = fromHex(policyObject);
  const id = toHex(new Uint8Array([...policyObjectBytes, ...nonce]));
  const { encryptedObject: encryptedBytes } = await client.encrypt({
    threshold: 2,
    packageId,
    id,
    data: file,
  });
  return {
    encryptedObject: encryptedBytes,
  };
};
