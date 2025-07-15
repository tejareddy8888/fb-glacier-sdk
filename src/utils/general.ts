import { SupportedAssetIds, SupportedBlockchains } from "../types.js";

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

export const calculateTokenAmount = (
  utxo: any,
  policyId: string,
  tokenName: string
): number => {
  if (tokenName === "ADA" && policyId === "") {
    const ada = utxo.amount.find((a: any) => a.unit === "lovelace");
    return ada ? parseInt(ada.quantity, 10) : 0;
  }

  // Construct asset unit for native tokens
  const assetUnit = policyId + Buffer.from(tokenName, "utf8").toString("hex");
  const token = utxo.amount.find((a: any) => a.unit === assetUnit);
  return token ? parseInt(token.quantity, 10) : 0;
};

export const getLovelaceAmount = (utxo: any): number => {
  const ada = utxo.amount.find((a: any) => a.unit === "lovelace");
  return ada ? parseInt(ada.quantity, 10) : 0;
};
