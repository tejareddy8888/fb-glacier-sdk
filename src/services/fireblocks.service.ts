import {
  ConfigurationOptions as FireblocksConfig,
  Fireblocks,
  SignedMessageSignature,
} from "@fireblocks/ts-sdk";
import {
  generateTransactionPayload,
  rawSignRawMessage,
} from "../utils/fireblocks.utils";
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
        throw new Error("...");
      }
      const response = await rawSignRawMessage(
        this.fireblocksSDK,
        transactionPayload
      );
      return response;
    } catch (error) {
      console.error(error);
      return null;
    }
  };
}
