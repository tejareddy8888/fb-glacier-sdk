import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import * as lucid from "lucid-cardano";
import { nightTokenName } from "../constants.js";
import { Utxo } from "../types.js";

export const fetchAndSelectUtxos = async (
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
        tokenAmount: calculateTokenAmount(utxo, tokenPolicyId, nightTokenName),
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
    const adaTarget = minRecipientLovelace + transactionFee + minChangeLovelace;
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
      blockfrost,
      selectedUtxos,
      accumulatedAda,
      accumulatedTokenAmount,
    };
  } catch (error) {
    throw new Error(
      `Error fetching and selecting UTXOs: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
};

export const fetchUtxos = async (
  blockfrostContext: BlockFrostAPI,
  address: string
) => {
  try {
    const utxos = await blockfrostContext.addressesUtxos(address);

    return utxos;
  } catch (error: any) {
    throw new Error(`fb service error: ${error.message}`);
  }
};

export const calculateTokenAmount = (
  utxo: Utxo,
  policyId: string,
  tokenName: string
): number => {
  if (tokenName === "ADA" && policyId === "") {
    const ada = utxo.amount.find((a) => a.unit === "lovelace");
    return ada ? parseInt(ada.quantity, 10) : 0;
  }

  const assetUnit = policyId + Buffer.from(tokenName, "utf8").toString("hex");
  const token = utxo.amount.find((a) => a.unit === assetUnit);
  return token ? parseInt(token.quantity, 10) : 0;
};

export const getLovelaceAmount = (utxo: Utxo): number => {
  const ada = utxo.amount.find((a) => a.unit === "lovelace");
  return ada ? parseInt(ada.quantity, 10) : 0;
};

export const filterUtxos = (utxos: Utxo[], tokenPolicyId: string): Utxo[] => {
  try {
    const filtered = utxos.filter(
      (utxo) => calculateTokenAmount(utxo, tokenPolicyId, nightTokenName) > 0
    );

    if (filtered.length === 0) {
      throw new Error(
        `No UTXOs found containing token '${nightTokenName}' with policy ID '${tokenPolicyId}'.`
      );
    }

    return filtered;
  } catch (err: any) {
    throw new Error(
      `An unexpected error occurred while filtering UTXOs. ${err.message}`
    );
  }
};

export const createTransactionInputs = (selectedUtxos: Utxo[]) => {
  return selectedUtxos.map((utxo) => {
    const assets: Record<string, bigint> = {};

    for (const amount of utxo.amount) {
      assets[amount.unit] = BigInt(amount.quantity);
    }

    return {
      txHash: utxo.tx_hash,
      outputIndex: utxo.output_index,
      assets,
      address: utxo.address,
      datumHash: null,
      scriptRef: null,
    };
  });
};

export const createTransactionOutputs = (
  requiredLovelace: number,
  fee: number,
  recipientAddress: lucid.Address,
  senderAddress: lucid.Address,
  tokenPolicyId: string,
  tokenName: string,
  transferAmount: number,
  selectedUtxos: Utxo[]
) => {
  const tokenNameHex = lucid.toHex(Buffer.from(tokenName, "utf8"));
  const tokenUnit = `${tokenPolicyId}${tokenNameHex}`;

  let totalLovelace = 0n;
  let totalTokenAmount = 0n;

  // Sum ADA + tokens
  selectedUtxos.forEach((utxo) => {
    utxo.amount.forEach((asset) => {
      const quantity = BigInt(asset.quantity);
      if (asset.unit === "lovelace") {
        totalLovelace += quantity;
      } else if (asset.unit === tokenUnit) {
        totalTokenAmount += quantity;
      }
    });
  });

  if (totalTokenAmount < BigInt(transferAmount)) {
    throw new Error(
      `Insufficient tokens: have ${totalTokenAmount}, need ${transferAmount}`
    );
  }

  const changeLovelace = totalLovelace - BigInt(requiredLovelace) - BigInt(fee);
  const changeTokenAmount = totalTokenAmount - BigInt(transferAmount);

  const outputs = [];

  const recipientAssets: lucid.Assets = {
    lovelace: BigInt(requiredLovelace),
    [tokenUnit]: BigInt(transferAmount),
  };
  outputs.push({
    address: recipientAddress,
    assets: recipientAssets,
  });

  const changeAssets: lucid.Assets = {
    lovelace: changeLovelace,
  };
  if (changeTokenAmount > 0n) {
    changeAssets[tokenUnit] = changeTokenAmount;
  }
  outputs.push({
    address: senderAddress,
    assets: changeAssets,
  });

  return outputs;
};

export const buildTransaction = async ({
  lucid,
  txInputs,
  txOutputs,
  fee,
  ttl,
}: {
  lucid: lucid.Lucid;
  txInputs: lucid.UTxO[];
  txOutputs: {
    address: string;
    assets: Record<string, bigint>;
  }[];
  fee: bigint;
  ttl: number;
}) => {
  let tx = lucid.newTx();

  txInputs.forEach((utxo) => {
    tx = tx.collectFrom([utxo], undefined);
  });

  txOutputs.forEach((output) => {
    tx = tx.payToAddress(output.address, output.assets);
  });

  tx = tx.validTo(ttl);

  const completedTx = await tx.complete();

  return completedTx;
};

export const calculateTtl = async (
  blockfrost: BlockFrostAPI,
  lucid: lucid.Lucid,
  bufferSlots: number = 2600
): Promise<number> => {
  try {
    const latestBlock = await blockfrost.blocksLatest();
    const currentSlot = latestBlock.slot;
    if (!currentSlot) throw new Error("Current slot undefined");

    const ttlSlot = currentSlot + bufferSlots;

    // Convert slot to unix timestamp (in ms)
    const ttlUnixMs = lucid.utils.slotToUnixTime(ttlSlot);

    console.log(`Calculated TTL (ms): ${ttlUnixMs} (slot: ${ttlSlot})`);

    return ttlUnixMs;
  } catch (error) {
    console.error(`Failed to calculate TTL: ${error}`);
    throw new Error(
      `Unable to calculate TTL. ${
        error instanceof Error ? error.message : error
      }`
    );
  }
};

export const submitTransaction = async (
  blockfrostApi: BlockFrostAPI,
  signedTx: lucid.TxSigned
): Promise<string> => {
  try {
    const txCbor = signedTx.toString();

    const txHash = await blockfrostApi.txSubmit(txCbor);

    console.log(
      `Transaction successfully submitted. Transaction ID: ${txHash}`
    );

    return txHash;
  } catch (error: any) {
    throw new Error(
      `Error in submitTransaction: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
};
