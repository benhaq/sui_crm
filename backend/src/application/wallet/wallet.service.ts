import { Injectable } from '@nestjs/common';
import {
  CreateWalletResultDto,
  MultiSendRequestDto,
  MultiSendResponseDto,
} from './models';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { generateKey, encrypt } from 'src/utils/cipher-utils';
import { WalletDocument, Wallet } from 'src/domain';
import * as bip39 from '@scure/bip39';
import { wordlist as enWordlist } from '@scure/bip39/wordlists/english';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { suiBech32ToHex } from 'src/utils/sui-cryptography';
import {
  getDefaultSigner,
  multiSend,
  getDecimals,
} from 'src/utils/sui-blockchain';
import { getKeypairFromPrivateKey } from 'src/utils/sui-cryptography';
import { decrypt } from 'src/utils/cipher-utils';
import { parseUnits } from 'ethers';

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(Wallet.name)
    private readonly walletModel: Model<WalletDocument>,
  ) {}
  createWallet() {
    const seedPhrase = bip39.generateMnemonic(enWordlist);
    const ed25519Keypair = Ed25519Keypair.deriveKeypair(
      seedPhrase,
      `m/44'/784'/0'/0'/0'`,
    );
    const privateKey = suiBech32ToHex(ed25519Keypair.getSecretKey());
    return {
      address: ed25519Keypair.getPublicKey().toSuiAddress(),
      seedPhrase: seedPhrase,
      privateKey: privateKey,
    };
  }

  /**
   * Create a new wallet
   * @returns The created wallet with its address, private key, and mnemonic
   */
  async create(numberOfWallets: number): Promise<CreateWalletResultDto[]> {
    const wallets = [];
    const walletEntities = [];
    for (let i = 0; i < numberOfWallets; i++) {
      const wallet = this.createWallet();
      const privateKeySalt = generateKey(32, 'hex');
      const mnemonicSalt = generateKey(32, 'base64url');
      const walletEntity = new this.walletModel({
        address: wallet.address.toLocaleLowerCase(),
        encryptedMnemonic: encrypt(wallet.seedPhrase, mnemonicSalt),
        encryptedPrivateKey: encrypt(wallet.privateKey, privateKeySalt),
        mnemonicSalt,
        privateKeySalt,
        accountId: 'SYSTEM',
      });

      walletEntities.push(walletEntity);

      wallets.push({
        address: wallet.address.toLocaleLowerCase(),
        privateKey: wallet.privateKey,
        mnemonic: wallet.seedPhrase,
      });
    }

    if (walletEntities.length > 0) {
      await this.walletModel.insertMany(walletEntities);
    }

    return wallets;
  }

  async getWallet(address: string): Promise<WalletDocument> {
    const wallet = await this.walletModel.findOne({
      address: address.toLocaleLowerCase(),
    });
    return wallet;
  }

  async getWallets(addresses: string[]): Promise<WalletDocument[]> {
    const wallets = await this.walletModel.find({
      address: { $in: addresses },
    });
    return wallets;
  }

  async allWallets(): Promise<WalletDocument[]> {
    return this.walletModel.find({});
  }

  /**
   * Send multiple transactions in a single transaction block
   * @param payload The multi-send request payload
   * @returns The transaction hash
   */
  async multiSend(payload: MultiSendRequestDto): Promise<MultiSendResponseDto> {
    const defaultSigner = getDefaultSigner();

    // Get coin decimals
    const decimals = await getDecimals(payload.coinType);

    // Parse amounts to proper decimals
    const parsedRecipients = payload.recipients.map((recipient) => ({
      address: recipient.address,
      amount: parseUnits(recipient.amount, decimals).toString(),
    }));

    // Execute the multi-send transaction
    const result = await multiSend(
      payload.coinType,
      parsedRecipients,
      defaultSigner,
    );

    return {
      transactionHash: result.transactionHash,
    };
  }
}
