import { SupportedAssetIds, SupportedBlockchains } from "../types.js";

const blockchainToAssetIdsMap: Record<SupportedBlockchains, SupportedAssetIds> =
  {
    [SupportedBlockchains.CARDANO]: SupportedAssetIds.ADA,
    [SupportedBlockchains.BITCOIN]: SupportedAssetIds.BTC,
    [SupportedBlockchains.ETHEREUM]: SupportedAssetIds.ETH,
    [SupportedBlockchains.BNB]: SupportedAssetIds.BNB,
    [SupportedBlockchains.BAT]: SupportedAssetIds.BAT,
    [SupportedBlockchains.SOLANA]: SupportedAssetIds.SOL,
    [SupportedBlockchains.AVALANCHE]: SupportedAssetIds.AVAX,
    [SupportedBlockchains.XRP]: SupportedAssetIds.XRP,
  };

export const getAssetIdsByBlockchain = (
  chain: SupportedBlockchains
): SupportedAssetIds | null => {
  return blockchainToAssetIdsMap[chain] ?? null;
};
