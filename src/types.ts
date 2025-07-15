import { TransactionOperation, TransferPeerPathType } from "@fireblocks/ts-sdk";

export enum SupportedBlockchains {
  AVALANCHE = "avax",
  BAT = "bat",
  BITCOIN = "bitcoin",
  BNB = "bnb",
  CARDANO = "cardano",
  ETHEREUM = "ethereum",
  SOLANA = "solana",
  XRP = "xrp",
}

export enum SupportedAssetIds {
  ADA = "ADA",
  AVAX = "AVAX",
  BAT = "BAT",
  BTC = "BTC",
  BNB = "BNB",
  ETH = "ETH",
  SOL = "SOL",
  XRP = "XRP",
}

enum TypedMessagesTypes {
  EIP191 = "EIP191",
  EIP712 = "EIP712",
  BTC = "BTC_MESSAGE",
}

interface MessagePayloadSource {
  type: TransferPeerPathType;
  id: string;
}

interface TypedMessages {
  content: any;
  type: TypedMessagesTypes;
}

interface RawMessageData {
  messages: TypedMessages[];
}

interface MessagePayloadSourceExtraParameters {
  rawMessageData: RawMessageData;
}

interface MessagePayload {
  operation?: TransactionOperation;
  assetId: SupportedBlockchains;
  source?: MessagePayloadSource;
  note?: string;
  vaultAccountId?: string;
  bip44addressIndex?: number;
  message?: string;
  extraParameters?: MessagePayloadSourceExtraParameters;
}

interface RawSigningConfig {
  assetId: string;
  message: string;
  vaultAccountId: string;
  bip44addressIndex?: number;
  note?: string;
  extraParameters?: Record<string, any>;
}
