import { BlockFrostAPI } from "@blockfrost/blockfrost-js";
import { nightTokenName } from "../constants";
import { Utxo } from "../types";
import {
  TransactionInput,
  TransactionHash,
  BigNum,
  TransactionOutput,
  Address,
  MultiAsset,
  Assets,
  Value,
  ScriptHash,
  AssetName,
  TransactionBody,
  TransactionInputs,
  TransactionOutputs,
  Transaction,
} from "@emurgo/cardano-serialization-lib-nodejs";

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

export const createTransactionInputs = (
  selectedUtxos: Utxo[]
): TransactionInput[] => {
  const inputs = selectedUtxos.map((utxo) => {
    const txHashBytes = Buffer.from(utxo.tx_hash, "hex");
    const txHash = TransactionHash.from_bytes(txHashBytes);
    return TransactionInput.new(txHash, utxo.output_index);
  });

  return inputs;
};

export const createTransactionOutputs = (
  requiredLovelace: number,
  fee: number,
  recipientAddress: Address,
  senderAddress: Address,
  tokenPolicyId: string,
  tokenName: string,
  transferAmount: number,
  selectedUtxos: Utxo[]
): TransactionOutput[] => {
  // Construct token unit correctly
  const tokenNameHex = Buffer.from(tokenName, "utf8").toString("hex");
  const tokenUnit = `${tokenPolicyId}${tokenNameHex}`;

  console.log("=== TOKEN UNIT CONSTRUCTION ===");
  console.log("Policy ID:", tokenPolicyId);
  console.log("Token Name:", tokenName);
  console.log("Token Name Hex:", tokenNameHex);
  console.log("Constructed Unit:", tokenUnit);

  // Find the actual token unit in UTXOs
  let actualTokenUnit = "";
  let totalTokenAmount = 0;
  let totalLovelace = 0;

  selectedUtxos.forEach((utxo) => {
    utxo.amount.forEach((asset) => {
      if (asset.unit === "lovelace") {
        totalLovelace += parseInt(asset.quantity, 10);
      } else if (asset.unit.startsWith(tokenPolicyId)) {
        actualTokenUnit = asset.unit;
        totalTokenAmount += parseInt(asset.quantity, 10);
        console.log(`Found token: ${asset.unit} = ${asset.quantity}`);
      }
    });
  });

  console.log("Actual token unit found:", actualTokenUnit);
  console.log("Total tokens found:", totalTokenAmount);
  console.log("Total ADA found:", totalLovelace);

  // Validate we have enough tokens
  if (totalTokenAmount < transferAmount) {
    throw new Error(
      `Insufficient tokens: have ${totalTokenAmount}, need ${transferAmount}`
    );
  }

  // Calculate change
  const changeLovelace = totalLovelace - requiredLovelace - fee;
  const changeTokenAmount = totalTokenAmount - transferAmount;

  console.log("=== CHANGE CALCULATION ===");
  console.log("Change ADA:", changeLovelace);
  console.log("Change Tokens:", changeTokenAmount);

  // Create recipient output
  const recipientValue = Value.new(
    BigNum.from_str(requiredLovelace.toString())
  );
  if (transferAmount > 0) {
    const recipientMultiAsset = MultiAsset.new();
    const policy = ScriptHash.from_hex(tokenPolicyId);
    const assetName = AssetName.new(Buffer.from(tokenName, "utf8"));
    const assets = Assets.new();
    assets.insert(assetName, BigNum.from_str(transferAmount.toString()));
    recipientMultiAsset.insert(policy, assets);
    recipientValue.set_multiasset(recipientMultiAsset);
  }
  const recipientOutput = TransactionOutput.new(
    recipientAddress,
    recipientValue
  );

  // Create change output
  const changeValue = Value.new(BigNum.from_str(changeLovelace.toString()));
  if (changeTokenAmount > 0) {
    const changeMultiAsset = MultiAsset.new();
    const policy = ScriptHash.from_hex(tokenPolicyId);
    const assetName = AssetName.new(Buffer.from(tokenName, "utf8"));
    const assets = Assets.new();
    assets.insert(assetName, BigNum.from_str(changeTokenAmount.toString()));
    changeMultiAsset.insert(policy, assets);
    changeValue.set_multiasset(changeMultiAsset);
  }
  const changeOutput = TransactionOutput.new(senderAddress, changeValue);

  // Final validation
  console.log("=== FINAL VALIDATION ===");
  console.log("Input tokens:", totalTokenAmount);
  console.log("Output tokens:", transferAmount + changeTokenAmount);
  console.log(
    "Balanced:",
    totalTokenAmount === transferAmount + changeTokenAmount
  );

  return [recipientOutput, changeOutput];
};

export const buildTransaction = ({
  txInputs,
  txOutputs,
  fee,
  ttl,
}: {
  txInputs: TransactionInput[];
  txOutputs: TransactionOutput[];
  fee: number;
  ttl: number;
}): TransactionBody => {
  const inputs = TransactionInputs.new();
  txInputs.forEach((input) => inputs.add(input));

  const outputs = TransactionOutputs.new();
  txOutputs.forEach((output) => outputs.add(output));

  const txBody = TransactionBody.new_tx_body(
    inputs,
    outputs,
    BigNum.from_str(fee.toString())
  );

  txBody.set_ttl(BigNum.from_str(ttl.toString()));

  return txBody;
};

export const calculateTtl = async (
  blockfrost: BlockFrostAPI,
  bufferSlots: number = 2600
): Promise<number> => {
  try {
    // Fetch the latest block to get current slot
    const latestBlock = await blockfrost.blocksLatest();
    const currentSlot = latestBlock.slot;

    if (!currentSlot) {
      throw new Error("Current slot is undefined in latest block response");
    }

    const ttl = currentSlot + bufferSlots;

    console.log(
      `Calculated TTL: ${ttl} (current slot: ${currentSlot}, buffer: ${bufferSlots})`
    );

    return ttl;
  } catch (error) {
    console.error(`Failed to calculate TTL: ${error}`);
    throw new Error(
      `Unable to fetch the current blockchain slot. Please check Blockfrost connection. ${
        error instanceof Error ? error.message : error
      }`
    );
  }
};

export const submitTransaction = async (
  blockfrostApi: BlockFrostAPI,
  signedTx: Transaction
): Promise<string> => {
  try {
    const txCbor = Buffer.from(signedTx.to_bytes()).toString("hex");

    // Submit transaction using BlockFrost API
    const txHash = await blockfrostApi.txSubmit(txCbor);

    console.log(
      `Transaction successfully submitted. Transaction ID: ${txHash}`
    );
    return txHash;
  } catch (error) {
    throw new Error(
      `Error creating submitTransaction: ${
        error instanceof Error ? error.message : error
      }`
    );
  }
};
// const aggregateTokenTotals = (
//   selectedUtxos: Utxo[]
// ): Record<string, number> => {
//   const tokenTotals: Record<string, number> = {};

//   for (const utxo of selectedUtxos) {
//     for (const amt of utxo.amount) {
//       if (amt.unit !== "lovelace") {
//         const policyId = amt.unit.slice(0, 56);
//         const assetNameHex = amt.unit.slice(56);
//         const key = `${policyId}.${assetNameHex}`;
//         const quantity = parseInt(amt.quantity, 10);
//         tokenTotals[key] = (tokenTotals[key] || 0) + quantity;
//       }
//     }
//   }

//   return tokenTotals;
// };

// const calculateMinAda = (
//   multiAsset: MultiAsset,
//   baseCost: number = 1_000_000,
//   scalingFactor: number = 44
// ): number => {
//   const baseUtxoSize = 27;
//   let tokenDataSize = 0;

//   const policies = multiAsset.keys(); // returns ScriptHashes
//   for (let i = 0; i < policies.len(); i++) {
//     const policyId = policies.get(i);
//     tokenDataSize += 28;

//     const assets = multiAsset.get(policyId);
//     if (assets) {
//       const assetNames = assets.keys();
//       for (let j = 0; j < assetNames.len(); j++) {
//         const assetName = assetNames.get(j);
//         tokenDataSize += assetName.name().length; // asset name byte length
//       }
//     }
//   }

//   const totalSize = baseUtxoSize + tokenDataSize;
//   return baseCost + scalingFactor * totalSize;
// };

// function calculateChangeLovelace(
//   totalLovelace: number,
//   requiredLovelace: number,
//   fee: number,
//   minLovelace: number
// ): number {
//   const changeLovelace = totalLovelace - requiredLovelace - fee;

//   if (changeLovelace < 0) {
//     throw new Error(
//       `Insufficient total Lovelace (${totalLovelace}) to cover required (${requiredLovelace}) and fee (${fee}).`
//     );
//   }

//   if (changeLovelace < minLovelace) {
//     throw new Error(
//       `Change Lovelace (${changeLovelace}) is below the minimum required (${minLovelace}).`
//     );
//   }

//   return changeLovelace;
// }

// const createRecipientOutput = (
//   recipientAddress: Address,
//   requiredLovelace: number,
//   tokenPolicyId: string,
//   tokenName: string,
//   transferAmount: number
// ): TransactionOutput => {
//   const recipientOutput = createOutput({
//     address: recipientAddress,
//     adaAmount: requiredLovelace,
//     tokenPolicyId,
//     tokenName,
//     tokenAmount: transferAmount,
//   });

//   return recipientOutput;
// };

// const createOutput = (params: {
//   address: Address;
//   adaAmount: number;
//   tokenPolicyId: string;
//   tokenName: string;
//   tokenAmount: number;
// }): TransactionOutput => {
//   const { address, adaAmount, tokenPolicyId, tokenName, tokenAmount } = params;
//   const multiAsset: MultiAsset = createMultiAsset(
//     tokenPolicyId,
//     tokenName,
//     tokenAmount
//   );

//   const value = Value.new(BigNum.from_str(adaAmount.toString()));

//   if (multiAsset) {
//     value.set_multiasset(multiAsset);
//   }

//   return TransactionOutput.new(address, value);
// };

// const createMultiAsset = (
//   policyId: string,
//   tokenName: string,
//   amount: number
// ): MultiAsset => {
//   const multiAsset = MultiAsset.new();

//   const policyScriptHash = ScriptHash.from_bytes(Buffer.from(policyId, "hex"));

//   const assets = Assets.new();

//   const assetName = AssetName.new(Buffer.from(tokenName, "utf8"));

//   assets.insert(assetName, BigNum.from_str(amount.toString()));

//   multiAsset.insert(policyScriptHash, assets);

//   return multiAsset;
// };

// const createChangeOutput = (
//   senderAddress: Address,
//   changeLovelace: number,
//   tokenTotals: Record<string, number>,
//   tokenPolicyId: string,
//   tokenName: string,
//   transferAmount: number
// ): TransactionOutput => {
//   const tokenNameHex = Buffer.from(tokenName, "utf8").toString("hex");
//   const key = `${tokenPolicyId}.${tokenNameHex}`;

//   if (!(key in tokenTotals)) {
//     throw new Error(
//       `Token '${tokenName}' with policy '${tokenPolicyId}' not found in selected UTXOs.`
//     );
//   }

//   tokenTotals[key] -= transferAmount;

//   // Prepare MultiAsset with remaining (non-zero) tokens
//   const multiAsset = MultiAsset.new();

//   for (const [compoundKey, amount] of Object.entries(tokenTotals)) {
//     if (amount <= 0) continue;

//     const [policyId, assetNameHex] = compoundKey.split(".");
//     const policy = ScriptHash.from_bytes(Buffer.from(policyId, "hex"));
//     const assetName = AssetName.new(Buffer.from(assetNameHex, "hex"));
//     let assets = multiAsset.get(policy);

//     if (!assets) {
//       assets = Assets.new();
//       multiAsset.insert(policy, assets);
//     }

//     assets.insert(assetName, BigNum.from_str(amount.toString()));
//   }

//   const value = Value.new(BigNum.from_str(changeLovelace.toString()));
//   if (multiAsset.len() > 0) {
//     value.set_multiasset(multiAsset);
//   }

//   const changeOutput = TransactionOutput.new(senderAddress, value);

//   return changeOutput;
// };
