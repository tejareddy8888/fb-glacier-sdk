import {
  Fireblocks,
  FireblocksResponse,
  SignedMessageAlgorithmEnum,
  TransactionOperation,
  TransactionRequest,
  TransactionResponse,
  TransactionStateEnum,
  TransferPeerPathType,
} from "@fireblocks/ts-sdk";
import { SupportedAssetIds, SupportedBlockchains } from "../types.js";

/**
 * Generates a transaction payload for signing messages on various blockchains.
 *
 * Depending on the specified blockchain, this function prepares the payload in the required format
 * and returns a `TransactionRequest` object suitable for Fireblocks SDK operations.
 *
 * @param {string} payload - The message or data to be signed, as a string.
 * @param {SupportedBlockchains} chain - The blockchain for which the transaction payload is being generated.
 * @param {SupportedAssetIds} assetId - The asset identifier relevant to the transaction.
 * @param {string} originVaultAccountId - The originating vault account ID as a string.
 * @returns {Promise<TransactionRequest>} A promise that resolves to a `TransactionRequest` object containing the formatted payload.
 * @throws Will throw an error if the blockchain is not supported or if any internal error occurs.
 */
export const generateTransactionPayload = async (
  payload: string,
  chain: SupportedBlockchains,
  assetId: SupportedAssetIds,
  originVaultAccountId: string
): Promise<TransactionRequest> => {
  try {
    const { MSL } = await import("cardano-web3-js");
    switch (chain) {
      case SupportedBlockchains.CARDANO:
        const payloadBytes = new TextEncoder().encode(payload);

        const protectedHeaders = MSL.HeaderMap.new();
        protectedHeaders.set_algorithm_id(
          MSL.Label.from_algorithm_id(MSL.AlgorithmId.EdDSA)
        );
        const protectedSerialized =
          MSL.ProtectedHeaderMap.new(protectedHeaders);
        const headers = MSL.Headers.new(
          protectedSerialized,
          MSL.HeaderMap.new()
        );

        const builder = MSL.COSESign1Builder.new(headers, payloadBytes, false);
        const sigStructureBytes = builder.make_data_to_sign().to_bytes();
        const content = Buffer.from(sigStructureBytes).toString("hex");
        return {
          source: {
            type: TransferPeerPathType.VaultAccount,
          },

          operation: TransactionOperation.Raw,
          extraParameters: {
            rawMessageData: {
              algorithm: SignedMessageAlgorithmEnum.EddsaEd25519,
              messages: [
                {
                  content,
                  type: "RAW",
                  derivationPath: [
                    44,
                    1815,
                    Number(originVaultAccountId),
                    2,
                    0,
                  ],
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
      case SupportedBlockchains.BAT:
      case SupportedBlockchains.BNB:
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

/**
 * Retrieves the status of a Fireblocks transaction and waits until it is completed.
 * Polls the transaction status every 3 seconds and logs the current status to the console.
 * Throws an error if the transaction is blocked, cancelled, failed, or rejected.
 *
 * @param {string} txId - The ID of the transaction to check.
 * @param {Fireblocks} fireblocks - The Fireblocks SDK instance used to fetch transaction details.
 * @returns {Promise<TransactionResponse>} A promise that resolves to the completed transaction response.
 * @throws {Error} If the transaction is blocked, cancelled, failed, or rejected.
 */
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
