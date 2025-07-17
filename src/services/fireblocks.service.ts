import {
  ConfigurationOptions as FireblocksConfig,
  Fireblocks,
  SignedMessageSignature,
  TransactionRequest,
  SignedMessageAlgorithmEnum,
  VaultWalletAddress,
} from "@fireblocks/ts-sdk";

import {
  generateTransactionPayload,
  getTxStatus,
} from "../utils/fireblocks.utils.js";
import {  termsAndConditionsHash } from "../constants.js";
import { SupportedAssetIds, SupportedBlockchains } from "../types.js";

export class FireblocksService {
  private readonly fireblocksSDK: Fireblocks;

  constructor(config: FireblocksConfig) {
    this.fireblocksSDK = new Fireblocks({
      apiKey: config.apiKey,
      secretKey: config.secretKey,
      basePath: config.basePath,
    });
  }

  public broadcastTransaction = async (
    transactionPayload: TransactionRequest
  ): Promise<{
    signature: SignedMessageSignature;
    content?: string;
    publicKey?: string;
    algorithm?: SignedMessageAlgorithmEnum;
  } | null> => {
    try {
      const transactionResponse =
        await this.fireblocksSDK.transactions.createTransaction({
          transactionRequest: transactionPayload,
        });

      const txId = transactionResponse.data.id;
      if (!txId) throw new Error("Transaction ID is undefined.");

      const completedTx = await getTxStatus(txId, this.fireblocksSDK);
      const signatureData = completedTx.signedMessages?.[0];
      if (signatureData?.signature) {
        return {
          signature: signatureData.signature,
          content: signatureData.content,
          publicKey: signatureData.publicKey,
          algorithm: signatureData.algorithm,
        };
      } else {
        console.warn("No signed message found in response.");
        return null;
      }
    } catch (error: any) {
      console.error(
        `${transactionPayload.assetId} signing error:`,
        error.message
      );
      throw error;
    }
  };

  public signMessage = async (
    chain: SupportedBlockchains,
    assetId: SupportedAssetIds,
    originVaultAccountId: string,
    destinationAddress: string,
    amount: number
  ): Promise<{
    signature?: SignedMessageSignature;
    publicKey?: string;
    algorithm?: SignedMessageAlgorithmEnum;
    content?: string;
    message: string;
  } | null> => {
    try {
      const payload = `STAR ${amount} to ${destinationAddress} ${termsAndConditionsHash}`;

      const transactionPayload = await generateTransactionPayload(
        payload,
        chain,
        assetId,
        originVaultAccountId
      );
      if (!transactionPayload) {
        throw new Error("Failed to generate transaction payload");
      }

      const response = await this.broadcastTransaction(transactionPayload);
      return {
        ...response,
        message: payload,
      };
    } catch (error: any) {
      console.error(error.message);
      throw error;
    }
  };

  public getVaultAccountAddress = async (
    vaultAccountId: string,
    assetId: SupportedAssetIds
  ): Promise<string> => {
    try {
      const addressesResponse =
        await this.fireblocksSDK.vaults.getVaultAccountAssetAddressesPaginated({
          vaultAccountId,
          assetId,
        });

      const addresses = addressesResponse.data.addresses;
      if (!addresses || addresses.length === 0) {
        throw new Error(
          `No addresses found for vault account ${vaultAccountId} and asset ${assetId}`
        );
      }

      const defaultAddress = addresses[0].address;
      if (!defaultAddress) {
        throw new Error(
          `Invalid address found for vault account ${vaultAccountId} and asset ${assetId}`
        );
      }

      return defaultAddress;
    } catch (error: any) {
      throw new Error(
        `Failed to get address for vault account ${vaultAccountId}: ${error.message}`
      );
    }
  };

  public getVaultAccountAddresses = async (
    vaultAccountId: string,
    assetId: SupportedAssetIds
  ): Promise<VaultWalletAddress[]> => {
    try {
      const addressesResponse =
        await this.fireblocksSDK.vaults.getVaultAccountAssetAddressesPaginated({
          vaultAccountId,
          assetId,
        });

      const addresses = addressesResponse.data.addresses;
      if (!addresses) {
        throw new Error(
          `Failed to fetch addresses for vault account ${vaultAccountId} and asset ${assetId}`
        );
      }
      return addresses;
    } catch (error: any) {
      throw new Error(
        `Failed to get address for vault account ${vaultAccountId}: ${error.message}`
      );
    }
  };
  public getAssetPublicKey = async (
    vaultAccountId: string,
    assetId: SupportedAssetIds,
    change: number = 0,
    addressIndex: number = 0
  ): Promise<string> => {
    try {
      const response =
        await this.fireblocksSDK.vaults.getPublicKeyInfoForAddress({
          vaultAccountId,
          assetId,
          change,
          addressIndex,
        });

      const publicKey = response.data.publicKey;

      if (!publicKey) {
        throw new Error(
          `Error fetching public key for vault account ${vaultAccountId}`
        );
      }

      return publicKey;
    } catch (error: any) {
      throw new Error(
        `Failed to get public key for vault account ${vaultAccountId}: ${error.message}`
      );
    }
  };
}
