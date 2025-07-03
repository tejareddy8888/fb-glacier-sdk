import { Fireblocks } from "@fireblocks/ts-sdk";
import * as cbor from "cbor";
import { SupportedAssetIds, SupportedBlockchains } from "../types";

export const encodeCIP8Message = (message: string): Buffer => {
  const protectedHeaders = cbor.encode(new Map([[1, -8]])); // { alg: EdDSA }
  const unprotectedHeaders = new Map();
  const headers = [protectedHeaders, unprotectedHeaders];

  const payload = Buffer.from(message, "utf8");
  const signature = Buffer.alloc(0);

  const coseSign1Structure = [headers, payload, signature];

  return cbor.encode(coseSign1Structure);
};

const blockchainToAssetIdsMap: Record<
  SupportedBlockchains,
  SupportedAssetIds[]
> = {
  [SupportedBlockchains.CARDANO]: [SupportedAssetIds.ADA],
  [SupportedBlockchains.BITCOIN]: [SupportedAssetIds.BTC],
  [SupportedBlockchains.ETHEREUM]: [SupportedAssetIds.ETH],
  [SupportedBlockchains.EVM]: [SupportedAssetIds.BNB, SupportedAssetIds.BAT],
  [SupportedBlockchains.SOLANA]: [SupportedAssetIds.SOL],
  [SupportedBlockchains.AVALANCHE]: [SupportedAssetIds.AVAX],
  [SupportedBlockchains.XRP]: [SupportedAssetIds.XRP],
};

export const getAssetIdsByBlockchain = (
  chain: SupportedBlockchains
): SupportedAssetIds[] => {
  return blockchainToAssetIdsMap[chain] ?? [];
};

export const getVaultAccountAddress = async (
  fireblocksSDK: Fireblocks,
  vaultAccountId: string,
  assetId: string
): Promise<string> => {
  try {
    const addressesResponse =
      await fireblocksSDK.vaults.getVaultAccountAssetAddressesPaginated({
        vaultAccountId,
        assetId,
      });

    const addresses = addressesResponse.data.addresses;
    if (!addresses || addresses.length === 0) {
      throw new Error(
        `No addresses found for vault account ${vaultAccountId} and asset ${assetId}`
      );
    }

    const address = addresses[0].address;
    if (!address) {
      throw new Error(
        `Invalid address found for vault account ${vaultAccountId} and asset ${assetId}`
      );
    }

    return address;
  } catch (error: any) {
    console.error("Error retrieving vault account address:", error);
    throw new Error(
      `Failed to get address for vault account ${vaultAccountId}: ${error.message}`
    );
  }
};
