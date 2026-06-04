import axios from "axios";
import { midnightClaimAddress } from "../constants.js";
import axiosInstance from "../utils/httpClient.js";
import {
  PhaseConfigResponse,
  ThawScheduleResponse,
  ThawTransactionResponse,
  ThawTransactionStatus,
  TransactionBuildRequest,
  TransactionBuildResponse,
  TransactionSubmissionRequest,
} from "../types.js";

/**
 * Service for managing NIGHT token thawing and redemption operations against
 * the Midnight redemption API. Provides phase-config lookups, address-specific
 * thaw schedules, and the build/submit/status calls used by the redeem flow.
 */
export class ThawsService {
  private logError(scope: string, error: any): void {
    if (axios.isAxiosError(error)) {
      console.error(`Axios error! - ${scope}`);
      console.error("Status:", error.response?.status);
      console.error("Status Text:", error.response?.statusText);
      console.error("Response Data:", error.response?.data);
      console.error("Request URL:", error.config?.url);
    } else {
      console.error(`Unexpected error in ${scope}:`, error);
    }
  }

  public getPhaseConfig = async (): Promise<PhaseConfigResponse> => {
    const url = `${midnightClaimAddress}/thaws/phase-config`;
    try {
      const response = await axiosInstance.get<PhaseConfigResponse>(url);
      if (response.status === 200) {
        return response.data;
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error: any) {
      this.logError("getPhaseConfig", error);
      throw error;
    }
  };

  public getThawSchedule = async (
    destAddress: string
  ): Promise<ThawScheduleResponse> => {
    const url = `${midnightClaimAddress}/thaws/${destAddress}/schedule`;
    try {
      const response = await axiosInstance.get<ThawScheduleResponse>(url);
      if (response.status === 200) {
        return response.data;
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error: any) {
      this.logError(`getThawSchedule:${destAddress}`, error);
      throw error;
    }
  };

  public buildThawTransaction = async (
    destAddress: string,
    request: TransactionBuildRequest
  ): Promise<TransactionBuildResponse> => {
    const url = `${midnightClaimAddress}/thaws/${destAddress}/transactions/build`;
    try {
      const response = await axiosInstance.post<TransactionBuildResponse>(
        url,
        request
      );
      if (response.status === 200) {
        return response.data;
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error: any) {
      this.logError(`buildThawTransaction:${destAddress}`, error);
      throw error;
    }
  };

  public submitThawTransaction = async (
    destAddress: string,
    request: TransactionSubmissionRequest
  ): Promise<ThawTransactionResponse> => {
    const url = `${midnightClaimAddress}/thaws/${destAddress}/transactions`;
    try {
      const response = await axiosInstance.post<ThawTransactionResponse>(
        url,
        request
      );
      if (response.status === 200) {
        return response.data;
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error: any) {
      this.logError(`submitThawTransaction:${destAddress}`, error);
      throw error;
    }
  };

  public getTransactionStatus = async (
    destAddress: string,
    transactionId: string
  ): Promise<ThawTransactionStatus> => {
    const url = `${midnightClaimAddress}/thaws/${destAddress}/transactions/${transactionId}`;
    try {
      const response = await axiosInstance.get<ThawTransactionStatus>(url);
      if (response.status === 200) {
        return response.data;
      }
      throw new Error(`Unexpected response status: ${response.status}`);
    } catch (error: any) {
      this.logError(`getTransactionStatus:${transactionId}`, error);
      throw error;
    }
  };

  public isRedemptionWindowOpen = (config: PhaseConfigResponse): boolean => {
    const now = Date.now() / 1000;
    const startTime = config.genesis_timestamp;
    const totalDuration =
      config.redemption_increment_period * config.redemption_increments;
    const endTime = startTime + totalDuration;
    return now >= startTime && now <= endTime;
  };

  public getRedemptionWindowTimes = (config: PhaseConfigResponse) => {
    const startTime = config.genesis_timestamp;
    const totalDuration =
      config.redemption_increment_period * config.redemption_increments;
    const endTime = startTime + totalDuration;
    return {
      startTime: new Date(startTime * 1000),
      endTime: new Date(endTime * 1000),
      isOpen: Date.now() / 1000 >= startTime && Date.now() / 1000 <= endTime,
      totalDurationSeconds: totalDuration,
    };
  };
}
