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
import { getVaultAccountAddress } from "../utils/general";
import { SupportedAssetIds, SupportedBlockchains } from "../types";

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
    } catch (err: any) {
      console.error(
        `${transactionPayload.assetId} signing error:`,
        err.message
      );
      throw err;
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
      const originAddress = await getVaultAccountAddress(
        this.fireblocksSDK,
        originVaultAccountId,
        assetId
      );
      const destinationAddress = await getVaultAccountAddress(
        this.fireblocksSDK,
        destinationVaultAccountId,
        assetId
      );
      const transactionPayload = generateTransactionPayload(
        chain,
        assetId,
        originAddress,
        destinationAddress,
        amount
      );
      if (!transactionPayload) {
        throw new Error("Failed to generate transaction payload");
      }
      const response = await this.broadcastTransaction(transactionPayload);
      return response;
    } catch (error) {
      console.error(error);
      return null;
    }
  };
}
