import {
  ConfigurationOptions as FireblocksConfig,
  Fireblocks,
  SignedMessageSignature,
  TransactionRequest,
} from "@fireblocks/ts-sdk";
import {
  generateTransactionPayload,
  getTxStatus,
} from "../utils/fireblocks.utils";
import { SupportedAssetIds, SupportedBlockchains } from "../types";
import { getVaultAccountAddress } from "../utils/general";

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
    publicKey?: string;
    content?: string;
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
          publicKey: signatureData.publicKey,
          content: signatureData.content,
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
    destinationVaultAccountId: string,
    amount: number
  ): Promise<{
    signature: SignedMessageSignature;
    publicKey?: string;
    content?: string;
  } | null> => {
    try {
      const transactionPayload = await generateTransactionPayload(
        this.fireblocksSDK,
        chain,
        assetId,
        originVaultAccountId,
        destinationVaultAccountId,
        amount
      );
      if (!transactionPayload) {
        throw new Error("Failed to generate transaction payload");
      }

      const response = await this.broadcastTransaction(transactionPayload);
      return response;
    } catch (error: any) {
      console.error(error.message);
      return null;
    }
  };

  public getVaultAccountAddress = async (
    vaultAccountId: string,
    assetId: string
  ): Promise<string> => {
    try {
      const address = await getVaultAccountAddress(
        this.fireblocksSDK,
        vaultAccountId,
        assetId
      );
      if (!address) {
        throw new Error("Failed to generate transaction payload");
      }

      return address;
    } catch (error: any) {
      throw new Error(`${error.message}`);
    }
  };
}
