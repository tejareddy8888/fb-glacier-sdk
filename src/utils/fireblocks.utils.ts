import {
  Fireblocks,
  FireblocksResponse,
  TransactionOperation,
  TransactionResponse,
  TransactionStateEnum,
  TransferPeerPathType,
} from "@fireblocks/ts-sdk";
import crypto from "crypto";
import { encodeCIP8Message } from "./general";
import { termsAndConditionsHash } from "../constants";
import { SupportedAssetIds, SupportedBlockchains } from "../types";

export const generateTransactionPayload = async (
  payload: string,
  chain: SupportedBlockchains,
  assetId: SupportedAssetIds,
  originVaultAccountId: string
) => {
  try {
    switch (chain) {
      case SupportedBlockchains.CARDANO:
        const cip8Payload = encodeCIP8Message("payload");
        const messageForSigning = cip8Payload.toString("binary");
        const adaHexMessage = Buffer.from(messageForSigning, "utf8").toString(
          "hex"
        );

        return {
          note: "ada Raw Signing Transaction with Fireblocks",
          assetId: "ADA",
          source: {
            type: TransferPeerPathType.VaultAccount,
            id: originVaultAccountId,
          },
          operation: TransactionOperation.Raw,
          extraParameters: {
            rawMessageData: {
              messages: [
                {
                  content: Buffer.from(adaHexMessage).toString("hex"),
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

      case SupportedBlockchains.AVALANCHE:
        const hashMessage = crypto
          .createHash("sha256")
          .update(payload, "utf8")
          .digest("hex");
        return {
          assetId: assetId,
          operation: TransactionOperation.Raw,
          source: {
            type: TransferPeerPathType.VaultAccount,
            id: originVaultAccountId,
          },
          extraParameters: {
            rawMessageData: {
              messages: [
                {
                  content: hashMessage,
                  bip44addressIndex: 0,
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
