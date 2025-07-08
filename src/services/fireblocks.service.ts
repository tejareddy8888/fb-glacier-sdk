import {
  ConfigurationOptions as FireblocksConfig,
  Fireblocks,
  SignedMessageSignature,
  TransactionRequest,
  SignedMessageAlgorithmEnum,
} from "@fireblocks/ts-sdk";
import {
  generateTransactionPayload,
  getTxStatus,
} from "../utils/fireblocks.utils";
import { SupportedAssetIds, SupportedBlockchains } from "../types";
import { getAssetPublicKey, getVaultAccountAddress } from "../utils/general";
import { termsAndConditionsHash } from "../constants";

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
      return { ...response, message: payload };
    } catch (error: any) {
      console.error(error.message);
      return null;
    }
  };

  public getVaultAccountAddress = async (
    vaultAccountId: string,
    assetId: SupportedAssetIds
  ): Promise<string> => {
    try {
      const address = await getVaultAccountAddress(
        this.fireblocksSDK,
        vaultAccountId,
        assetId
      );
      if (!address) {
        throw new Error("Failed to fetch vault account address");
      }

      return address;
    } catch (error: any) {
      throw new Error(`${error.message}`);
    }
  };

  public getAssetPublicKey = async (
    vaultAccountId: string,
    assetId: SupportedAssetIds
  ): Promise<string> => {
    try {
      const publicKey = await getAssetPublicKey(
        this.fireblocksSDK,
        vaultAccountId,
        assetId
      );
      if (!publicKey) {
        throw new Error("Failed to fetch public key");
      }

      return publicKey;
    } catch (error: any) {
      throw new Error(`${error.message}`);
    }
  };
}
