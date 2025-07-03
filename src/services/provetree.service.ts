import axios from "axios";

import { midnightProvtreeAdress } from "../constants";
export class ProvetreeService {
  public checkAddress = async (
    address: string,
    blockchainId: SupportedBlockchains
  ): Promise<number> => {
    try {
      const response = await axios.get(
        `${midnightProvtreeAdress}/check/${blockchainId}/${address}`,
        {
          headers: {
            Accept: "application/json;charset=utf-8",
          },
        }
      );

      if (response.status === 200) {
        return response.data.value;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error: any) {
      console.error(
        `Error fetching data for address ${address}:`,
        error.message
      );
      throw error;
    }
  };

  public getProofData = async (
    apiKey: string,
    requestData: object
  ): Promise<any> => {
    try {
      const response = await axios.post(midnightProvtreeAdress, requestData, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.status === 200) {
        return response.data;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      console.error("Error fetching proof data:", error);
      throw error;
    }
  };
}
