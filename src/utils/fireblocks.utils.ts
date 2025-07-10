import {
  Fireblocks,
  FireblocksResponse,
  TransactionOperation,
  TransactionResponse,
  TransactionStateEnum,
  TransferPeerPathType,
} from "@fireblocks/ts-sdk";
import { testCIP8 } from "./general.js";
import { SupportedAssetIds, SupportedBlockchains } from "../types.js";

export const generateTransactionPayload = async (
  payload: string,
  chain: SupportedBlockchains,
  assetId: SupportedAssetIds,
  originVaultAccountId: string,
  originAddress: string
) => {
  try {
    switch (chain) {
      case SupportedBlockchains.CARDANO:
        // const cip8Payload = await buildCIP8Message(payload, originAddress);

        const rawPayload = await testCIP8(payload, originAddress);
        return {
          assetId,
          source: {
            type: TransferPeerPathType.VaultAccount,
            id: originVaultAccountId,
          },
          operation: TransactionOperation.Raw,
          extraParameters: {
            rawMessageData: {
              messages: [
                {
                  content: rawPayload,
                  type: "RAW",
                },
              ],
            },
          },
        };

      case SupportedBlockchains.BITCOIN:
        return {
          operation: TransactionOperation.TypedMessage,
          assetId: assetId,
          source: {
            type: TransferPeerPathType.VaultAccount,
            id: originVaultAccountId,
          },
          extraParameters: {
            rawMessageData: {
              messages: [
                {
                  content: payload,
                  type: "BTC_MESSAGE",
                },
              ],
            },
          },
        };

      case SupportedBlockchains.ETHEREUM:
      case SupportedBlockchains.EVM:
      case SupportedBlockchains.AVALANCHE:
        const message = Buffer.from(payload).toString("hex");
        return {
          operation: TransactionOperation.TypedMessage,
          assetId: assetId,
          source: {
            type: TransferPeerPathType.VaultAccount,
            id: originVaultAccountId,
          },
          extraParameters: {
            rawMessageData: {
              messages: [
                {
                  content: message,
                  type: "EIP191",
                },
              ],
            },
          },
        };

      case SupportedBlockchains.SOLANA:
        const solHexMessage = Buffer.from(payload, "utf8").toString("hex");
        return {
          operation: TransactionOperation.Raw,
          assetId: assetId,
          source: {
            type: TransferPeerPathType.VaultAccount,

            id: originVaultAccountId,
          },
          extraParameters: {
            rawMessageData: {
              messages: [
                {
                  content: solHexMessage,
                  type: "RAW",
                },
              ],
            },
          },
        };

      case SupportedBlockchains.XRP:
        return {};

      default:
        throw new Error("block chain is not supported.");
    }
  } catch (error: any) {
    throw new Error(`${error.message}`);
  }
};

export const getTxStatus = async (
  txId: string,
  fireblocks: Fireblocks
): Promise<TransactionResponse> => {
  try {
    let response: FireblocksResponse<TransactionResponse> =
      await fireblocks.transactions.getTransaction({ txId });
    let tx: TransactionResponse = response.data;
    let messageToConsole: string = `Transaction ${tx.id} is currently at status - ${tx.status}`;

    console.log(messageToConsole);
    while (tx.status !== TransactionStateEnum.Completed) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      response = await fireblocks.transactions.getTransaction({ txId });
      tx = response.data;

      switch (tx.status) {
        case TransactionStateEnum.Blocked:
        case TransactionStateEnum.Cancelled:
        case TransactionStateEnum.Failed:
        case TransactionStateEnum.Rejected:
          throw new Error(
            `Signing request failed/blocked/cancelled: Transaction: ${tx.id} status is ${tx.status}`
          );
        default:
          console.log(messageToConsole);
          break;
      }
    }
    while (tx.status !== TransactionStateEnum.Completed);

    return tx;
  } catch (error) {
    throw error;
  }
};
