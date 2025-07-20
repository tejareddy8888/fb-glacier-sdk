import {
  SignedMessageAlgorithmEnum,
  TransactionOperation,
  TransferPeerPathType,
  VaultWalletAddress,
} from "@fireblocks/ts-sdk";
import { blake2b } from "blakejs";

import { FireblocksService } from "./services/fireblocks.service.js";
import { ClaimApiService } from "./services/claim.api.service.js";
import { ProvetreeService } from "./services/provetree.service.js";
import { SupportedAssetIds, SupportedBlockchains } from "./types.js";
import { nightTokenName, tokenTransactionFee } from "./constants.js";
import { getAssetIdsByBlockchain } from "./utils/general.js";
import {
  buildTransaction,
  calculateTtl,
  createTransactionInputs,
  createTransactionOutputs,
  fetchAndSelectUtxos,
  submitTransaction,
} from "./utils/cardano.utils.js";
import {
  Address,
  Ed25519Signature,
  PublicKey,
  Transaction,
  TransactionWitnessSet,
  Vkey,
  Vkeywitness,
  Vkeywitnesses,
} from "@emurgo/cardano-serialization-lib-nodejs";
import { config } from "./utils/config.js";

export class FireblocksMidnightSDK {
  private fireblocksService: FireblocksService;
  private claimApiService: ClaimApiService;
  private provetreeService: ProvetreeService;
  private assetId: SupportedAssetIds;
  private vaultAccountId: string;
  private address: string;
  private blockfrostProjectId: string;

  constructor(params: {
    fireblocksService: FireblocksService;
    claimApiService: ClaimApiService;
    provetreeService: ProvetreeService;
    assetId: SupportedAssetIds;
    vaultAccountId: string;
    address: string;
    blockfrostProjectId: string;
  }) {
    this.fireblocksService = params.fireblocksService;
    this.claimApiService = params.claimApiService;
    this.provetreeService = params.provetreeService;
    this.assetId = params.assetId;
    this.vaultAccountId = params.vaultAccountId;
    this.address = params.address;
    this.blockfrostProjectId = params.blockfrostProjectId;
  }

  public static create = async (params: {
    vaultAccountId: string;
    chain: SupportedBlockchains;
  }): Promise<FireblocksMidnightSDK> => {
    try {
      const { vaultAccountId, chain } = params;
      const assetId = getAssetIdsByBlockchain(chain);
      if (!assetId) {
        throw new Error(`Unsupported blockchain: ${chain}`);
      }

      const fireblocksConfig = config.FIREBLOCKS;

      const fireblocksService = new FireblocksService(fireblocksConfig);
      const address = await fireblocksService.getVaultAccountAddress(
        vaultAccountId,
        assetId
      );

      const blockfrostProjectId = config.BLOCKFROST_PROJECT_ID;
      if (!blockfrostProjectId) {
        throw new Error("BLOCKFROST_PROJECT_ID is not configured.");
      }

      const claimApiService = new ClaimApiService();
      const provetreeService = new ProvetreeService();

      return new FireblocksMidnightSDK({
        fireblocksService,
        claimApiService,
        provetreeService,
        assetId,
        vaultAccountId,
        address,
        blockfrostProjectId,
      });
    } catch (error: any) {
      throw new Error(
        `Error creating FireblocksMidnightSDK: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  };

  public checkAddress = async (chain: SupportedBlockchains) => {
    try {
      const value = await this.provetreeService.checkAddress(
        this.address,
        chain as SupportedBlockchains
      );
      return value;
    } catch (error: any) {
      throw new Error(
        `Error in checkAddress:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };

  public getClaims = async (chain: SupportedBlockchains) => {
    try {
      const claimResponse = await this.claimApiService.getClaims(
        chain as SupportedBlockchains,
        this.address
      );

      return claimResponse.data;
    } catch (error: any) {
      throw new Error(
        `Error in getClaims:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };

  public makeClaims = async (
    chain: SupportedBlockchains,
    destinationAddress: string
  ) => {
    try {
      const originAddress = this.address;
      const amount = await this.provetreeService.checkAddress(
        originAddress,
        chain as SupportedBlockchains
      );

      const fbResoponse = await this.fireblocksService.signMessage(
        chain as SupportedBlockchains,
        this.assetId,
        this.vaultAccountId,
        destinationAddress,
        amount
      );

      if (
        !fbResoponse ||
        !fbResoponse.publicKey ||
        !fbResoponse.algorithm ||
        !fbResoponse.signature ||
        !fbResoponse.signature.fullSig
      ) {
        throw new Error(
          "Invalid Fireblocks response: missing signature or public key"
        );
      }

      const message = fbResoponse.message;
      const publicKey = fbResoponse.publicKey;
      let signature: string = "";
      if (fbResoponse.algorithm === SignedMessageAlgorithmEnum.EcdsaSecp256K1) {
        const { r, s, v } = fbResoponse.signature;
        if (!r || !s || v === undefined)
          throw new Error("ecdsa signature error.");
        if (this.assetId === SupportedAssetIds.BTC) {
          const encodedSig =
            Buffer.from([Number.parseInt(String(v), 16) + 31]).toString("hex") +
            fbResoponse.signature.fullSig;

          signature = Buffer.from(encodedSig, "hex").toString("base64");
        } else {
          const ethV = v + 27;

          signature = r + s + ethV.toString(16).padStart(2, "0");
        }
      } else {
        signature = fbResoponse.signature.fullSig;
      }

      const claimResponse = await this.claimApiService.makeClaims(
        chain as SupportedBlockchains,
        originAddress,
        amount,
        message,
        signature,
        destinationAddress,
        publicKey
      );

      return claimResponse.data;
    } catch (error: any) {
      throw new Error(
        `Error in makeClaims:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };

  public transferClaims = async (
    recipientAddress: string,
    tokenPolicyId: string,
    requiredTokenAmount: number,
    minRecipientLovelace = 1_200_000,
    minChangeLovelace = 1_200_000
  ): Promise<{
    txHash: string;
    senderAddress: string;
    tokenName: string;
  }> => {
    try {
      const transactionFee = tokenTransactionFee;
      const utxoResult = await fetchAndSelectUtxos(
        this.address,
        this.blockfrostProjectId,
        tokenPolicyId,
        requiredTokenAmount,
        transactionFee,
        minRecipientLovelace,
        minChangeLovelace
      );

      if (!utxoResult) {
        throw new Error("no utxo found");
      }

      const {
        blockfrost,
        selectedUtxos,
        accumulatedAda,
        accumulatedTokenAmount,
      } = utxoResult;

      const adaTarget = minRecipientLovelace + transactionFee;
      if (
        accumulatedTokenAmount < requiredTokenAmount ||
        accumulatedAda < adaTarget
      ) {
        throw {
          code: "INSUFFICIENT_BALANCE",
          message: "Insufficient balance for token or ADA.",
          details: {
            requiredTokenAmount,
            accumulatedTokenAmount,
            requiredAda: adaTarget,
            accumulatedAda,
          },
        };
      }

      const txInputs = createTransactionInputs(selectedUtxos);
      const recipientAddrObj = Address.from_bech32(recipientAddress);
      const senderAddrObj = Address.from_bech32(this.address);

      const txOutputs = createTransactionOutputs(
        minRecipientLovelace,
        transactionFee,
        recipientAddrObj,
        senderAddrObj,
        tokenPolicyId,
        nightTokenName,
        requiredTokenAmount,
        selectedUtxos
      );
      const ttl = await calculateTtl(blockfrost, 2600);
      const txBody = buildTransaction({
        txInputs,
        txOutputs,
        fee: transactionFee,
        ttl,
      });

      const txBodyBytes = txBody.to_bytes();
      const hashBytes = blake2b(txBodyBytes, undefined, 32);
      const txHashHex = Buffer.from(hashBytes).toString("hex");
      const transactionPayload = {
        assetId: this.assetId,
        operation: TransactionOperation.Raw,
        source: {
          type: TransferPeerPathType.VaultAccount,
          id: this.vaultAccountId,
        },
        note: "transfer ADA native tokens",
        extraParameters: {
          rawMessageData: {
            messages: [
              {
                content: txHashHex,
                type: "RAW",
              },
            ],
          },
        },
      };
      const broadcastTransactionresponse =
        await this.fireblocksService.broadcastTransaction(transactionPayload);
      const publicKeyBytes = Uint8Array.from(
        Buffer.from(broadcastTransactionresponse?.publicKey!, "hex")
      );
      const signatureBytes = Uint8Array.from(
        Buffer.from(broadcastTransactionresponse?.signature?.fullSig!, "hex")
      );
      const cardanoPubKey = Vkey.new(PublicKey.from_bytes(publicKeyBytes));
      const cardanoSig = Ed25519Signature.from_bytes(signatureBytes);

      const witness = Vkeywitness.new(cardanoPubKey, cardanoSig);
      const witnesses = Vkeywitnesses.new();
      witnesses.add(witness);

      const witnessSet = TransactionWitnessSet.new();
      witnessSet.set_vkeys(witnesses);

      const signedTransaction = Transaction.new(txBody, witnessSet);

      const txHash = await submitTransaction(blockfrost, signedTransaction);
      return {
        txHash,
        senderAddress: this.address,
        tokenName: nightTokenName,
      };
    } catch (error: any) {
      throw new Error(
        `Error in transferClaims:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };

  public getVaultAccountAddresses = async (
    vaultAccountId: string
  ): Promise<VaultWalletAddress[]> => {
    try {
      const addresses = await this.fireblocksService.getVaultAccountAddresses(
        vaultAccountId,
        this.assetId
      );
      return addresses;
    } catch (error: any) {
      throw new Error(
        `Error in getVaultAccountAddresses:
        ${error instanceof Error ? error.message : error}`
      );
    }
  };
}
