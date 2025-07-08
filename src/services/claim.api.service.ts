import axios from "axios";
import * as cbor from "cbor";
import { midnightClaimAdress } from "../constants";
import { SupportedBlockchains } from "../types";

export class ClaimApiService {
  constructor() {}
  public claimByAddress = async (
    address: string,
    blockchainId: SupportedBlockchains
  ) => {
    try {
      const response = await axios.get(
        `${midnightClaimAdress}/claims/${blockchainId}?address=${address}`,
        {
          headers: {
            Accept: "application/json;charset=utf-8",
          },
        }
      );

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error(`Unexpected response s  tatus: ${response.status}`);
      }
    } catch (error: any) {
      console.error(
        `Error fetching claims for address ${address}:`,
        error.error
      );
      throw error;
    }
  };

  public getClaims = async (
    chain: SupportedBlockchains,
    address: string
  ): Promise<any> => {
    try {
      const response = await axios.get(
        `${midnightClaimAdress}/claims/${chain}?address=${encodeURIComponent(
          address
        )}`
      );

      return response;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error("Axios error!");
        console.error("Status:", error.response?.status);
        console.error("Status Text:", error.response?.statusText);
        console.error("Response Data:", error.response?.data);
        console.error("Request URL:", error.config?.url);
      } else {
        console.error("Unexpected error:", error);
      }
    }
  };

  public makeClaims = async (
    chain: SupportedBlockchains,
    originAddress: string,
    amount: number,
    message: string,
    fullSig: string,
    destinationAddress: string,
    publicKey: string
  ): Promise<any> => {
    try {
      let coseSign1Hex: string = "";
      let params: any = {};
      // let coseKeyHex: string = "";

      switch (chain) {
        case SupportedBlockchains.CARDANO:
          // Generate COSE key
          // const coseKeyMap = new Map<number, any>([
          //   [1, 1], // kty: OKP
          //   [3, -8], // alg: EdDSA
          //   [-1, 6], // crv: Ed25519
          //   [-2, Buffer.from(publicKey, "hex")], // x-coordinate (pub key)
          // ]);

          // coseKeyHex = cbor.encode(coseKeyMap).toString("hex");

          // Generate COSE_Sign1
          const adaProtectedHeader = cbor.encode({ alg: "EdDSA" });
          const adaPayload = Buffer.from(message, "utf8");
          const adaSignature = Buffer.from(fullSig, "hex");
          const coseSign1Structure = [
            adaProtectedHeader,
            {},
            adaPayload,
            adaSignature,
          ];
          const adaCoseSign1 = cbor.encode(coseSign1Structure);
          coseSign1Hex = adaCoseSign1.toString("hex");
          params = [
            {
              address: originAddress,
              amount,
              cose_sign1: coseSign1Hex,
              dest_address: destinationAddress,
              // cose_key: coseKeyHex,
              public_key: publicKey,
            },
          ];
          break;
        case SupportedBlockchains.BITCOIN:
          const btcSignatureBase64 = Buffer.from(fullSig, "hex").toString(
            "base64"
          );
          params = [
            {
              address: originAddress,
              amount,
              dest_address: destinationAddress,
              signature: btcSignatureBase64,
            },
          ];
          break;

        case SupportedBlockchains.ETHEREUM:
          params = [
            {
              address: originAddress,
              amount,
              dest_address: destinationAddress,
              signature: fullSig,
            },
          ];
          break;

        default:
          throw new Error(`chain ${chain} is not supported.`);
      }

      console.log("makeClaim params", params);

      const response = await axios.post(
        `${midnightClaimAdress}/claims/${chain}`,
        params
      );

      console.log("midnight makeClame response", response);

      return response;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error("Axios error!");
        console.error("Status:", error.response?.status);
        console.error("Status Text:", error.response?.statusText);
        console.error("Response Data:", error.response?.data);
        console.error("Request URL:", error.config?.url);
      } else {
        console.error("Unexpected error:", error);
      }
    }
  };
}
