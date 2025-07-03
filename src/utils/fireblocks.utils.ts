import {
  Fireblocks,
  FireblocksResponse,
  SignedMessageSignature,
  TransactionOperation,
  TransactionRequest,
  TransactionResponse,
  TransactionStateEnum,
  TransferPeerPathType,
} from "@fireblocks/ts-sdk";
import crypto from "crypto";
import { encodeCIP8Message } from "./general";
import { termsAndConditionsHash } from "../constants";

export const generateTransactionPayload = (
  chain: SupportedBlockchains,
  assetId: SupportedAssetIds,
  originAddress: string,
  destinationAddress: string,
  amount: number
) => {
  const payload = `STAR ${amount} to ${destinationAddress} ${termsAndConditionsHash}`;

  try {
    switch (chain) {
      case SupportedBlockchains.CARDANO:
        const cip8Payload = encodeCIP8Message(payload);
        const messageForSigning = cip8Payload.toString("binary");
        const adaHexMessage = Buffer.from(messageForSigning, "utf8").toString(
          "hex"
        );

        return {
          operation: TransactionOperation.Raw,
          assetId: assetId,
          source: {
            type: TransferPeerPathType.VaultAccount,
            id: originAddress,
          },
          destinationAddress: destinationAddress,
          extraParameters: {
            rawMessageData: {
              messages: [
                {
                  content: adaHexMessage,
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
            id: originAddress,
          },
          destinationAddress: destinationAddress,
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

      case SupportedBlockchains.ETHEREUM || SupportedBlockchains.EVM:
        const message = Buffer.from(payload).toString("hex");
        return {
          operation: TransactionOperation.TypedMessage,
          assetId: assetId,
          source: {
            type: TransferPeerPathType.VaultAccount,
            id: originAddress,
          },
          destinationAddress: destinationAddress,
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

            id: originAddress,
          },
          destinationAddress: destinationAddress,
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
            id: originAddress,
          },
          destinationAddress: destinationAddress,
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
  } catch (error) {}
};

const getTxStatus = async (
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

export const rawSignRawMessage = async (
  fireblocksSDK: Fireblocks,
  transactionPayload: TransactionRequest
): Promise<{
  signature: SignedMessageSignature;
  publicKey?: string;
  content?: string;
} | null> => {
  try {
    const transactionResponse =
      await fireblocksSDK.transactions.createTransaction({
        transactionRequest: transactionPayload,
      });

    const txId = transactionResponse.data.id;
    if (!txId) throw new Error("Transaction ID is undefined.");

    const completedTx = await getTxStatus(txId, fireblocksSDK);
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
    console.error(`${transactionPayload.assetId} signing error:`, err.message);
    throw err;
  }
};
