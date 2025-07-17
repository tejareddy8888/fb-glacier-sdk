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
} from "../utils/fireblocks.utils.js";
import { nightTokenName, termsAndConditionsHash } from "../constants.js";
import { SupportedAssetIds, SupportedBlockchains, Utxo } from "../types.js";
import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import {
  calculateTokenAmount,
  fetchUtxos,
  filterUtxos,
  getLovelaceAmount,
} from "../utils/cardanoUtils.js";

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
      const originAddress = await this.getVaultAccountAddress(
        originVaultAccountId,
        assetId
      );
      const transactionPayload = await generateTransactionPayload(
        payload,
        chain,
        assetId,
        originVaultAccountId,
        originAddress
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

  public fetchAndSelectUtxos = async (
    address: string,
    blockfrostProjectId: string,
    tokenPolicyId: string,
    requiredTokenAmount: number,
    transactionFee: number,
    minRecipientLovelace = 1_000_000,
    minChangeLovelace = 1_000_000
  ) => {
    try {
      const blockfrost = new BlockFrostAPI({
        projectId: blockfrostProjectId,
      });
      const utxos = await fetchUtxos(blockfrost, address);

      const tokenUtxosWithAmounts = filterUtxos(utxos, tokenPolicyId)
        .map((utxo) => ({
          utxo,
          tokenAmount: calculateTokenAmount(
            utxo,
            tokenPolicyId,
            nightTokenName
          ),
          adaAmount: getLovelaceAmount(utxo),
        }))
        .sort((a, b) => b.tokenAmount - a.tokenAmount);
      let selectedUtxos: Utxo[] = [];
      let accumulatedTokenAmount = 0;
      let accumulatedAda = 0;

      // Accumulate token UTXOs
      for (const { utxo, tokenAmount, adaAmount } of tokenUtxosWithAmounts) {
        selectedUtxos.push(utxo);
        accumulatedTokenAmount += tokenAmount;
        accumulatedAda += adaAmount;

        if (
          accumulatedTokenAmount >= requiredTokenAmount &&
          accumulatedAda >= minRecipientLovelace + transactionFee
        ) {
          break;
        }
      }
      const adaTarget =
        minRecipientLovelace + transactionFee + minChangeLovelace;
      if (accumulatedAda < adaTarget) {
        const remainingUtxos = utxos.filter((u) => !selectedUtxos.includes(u));
        const adaUtxos = remainingUtxos
          .map((utxo) => ({
            utxo,
            adaAmount: getLovelaceAmount(utxo),
          }))
          .sort((a, b) => b.adaAmount - a.adaAmount);

        for (const { utxo, adaAmount } of adaUtxos) {
          selectedUtxos.push(utxo);
          accumulatedAda += adaAmount;
          if (accumulatedAda >= adaTarget) break;
        }
      }

      return {
        selectedUtxos,
        accumulatedAda,
        accumulatedTokenAmount,
      };
    } catch (error) {}
  };
}
