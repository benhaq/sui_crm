import { bech32 } from 'bech32';
import { decodeSuiPrivateKey } from '@mysten/sui.js/cryptography';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { fromB64 } from '@mysten/sui.js/utils';
export const suiBech32ToHex = (bech32Priv: string): string => {
  // Step 1: Decode Bech32
  const { words } = bech32.decode(bech32Priv);
  const bytes = bech32.fromWords(words);

  // Step 2: Remove the flag byte (first byte)
  const privKeyBytes = bytes.slice(1);

  // Step 3: Convert to hex string
  return Buffer.from(privKeyBytes).toString('hex');
};
export const hexToSuiBech32PrivKey = (hexPriv: string): string => {
  // Step 1: Convert hex to bytes
  const privKeyBytes = Uint8Array.from(
    hexPriv.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
  );
  if (privKeyBytes.length !== 32)
    throw new Error('Private key must be 32 bytes');

  // Step 2: Prepend Ed25519 flag (0x00)
  const flag = 0x00;
  const bytesWithFlag = new Uint8Array(33);
  bytesWithFlag[0] = flag;
  bytesWithFlag.set(privKeyBytes, 1);

  // Step 3: Bech32 encode with HRP 'suiprivkey'
  const words = bech32.toWords(bytesWithFlag);
  return bech32.encode('suiprivkey', words);
};

export const getKeypairFromPrivateKey = (
  privateKeyHex: string,
): Ed25519Keypair => {
  const privateKey = hexToSuiBech32PrivKey(privateKeyHex);
  const { secretKey } = decodeSuiPrivateKey(privateKey);
  return Ed25519Keypair.fromSecretKey(secretKey);
};

export const getPrivateKeyHex = (privateKey: string): string => {
  const privateKeyBuffer = fromB64(privateKey);
  return Buffer.from(privateKeyBuffer).toString('hex');
};
