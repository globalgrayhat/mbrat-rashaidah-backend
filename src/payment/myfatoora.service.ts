import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError, AxiosResponse, Method } from 'axios';
import {
  PaymentPayload,
  PaymentResult,
  PaymentService,
  MyFatoorahResponseData,
  MyFatoorahGetPaymentStatusData,
} from '../common/interfaces/payment-service.interface'; // Ensure these interfaces exist
import { AppConfigService } from '../config/config.service';
@Injectable()
export class MyFatooraService implements PaymentService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly http: AxiosInstance;

  constructor(private configService: AppConfigService) {
    const apiKey = this.configService.myFatoorahApiKey;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'MyFatoorah API Key is not configured. Please check your environment variables.',
      );
    }
    this.apiKey = apiKey;

    this.baseUrl = this.configService.myFatoorahApiUrl; // Test URL as a fallback

    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private async request<T>(
    method: Method,
    url: string,
    data?: unknown,
    operationName: string = 'MyFatoorah API call',
  ): Promise<T> {
    interface MyFatoorahApiResponseLocal<TData> {
      IsSuccess: boolean;
      Message: string;
      ValidationErrors?: any[];
      Data: TData;
    }

    try {
      const response = await this.http.request<
        any,
        AxiosResponse<MyFatoorahApiResponseLocal<T>>
      >({
        method,
        url,
        ...(typeof data !== 'undefined' ? { data } : {}),
      });

      if (!response.data.IsSuccess) {
        throw new InternalServerErrorException(
          `${operationName} failed: ${response.data.Message}`,
        );
      }

      if (response.data.Data === undefined || response.data.Data === null) {
        throw new InternalServerErrorException(
          `${operationName} failed: 'Data' field is missing from MyFatoorah response.`,
        );
      }
      return response.data.Data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage =
        (axiosError.response?.data as { Message?: string })?.Message ||
        axiosError.message;

      console.error(
        `${operationName} error:`,
        axiosError.response?.data || axiosError.message,
      );
      throw new InternalServerErrorException(
        `Failed to ${operationName}: ${errorMessage}`,
      );
    }
  }

  // #endregion

  async createPayment(
    payload: PaymentPayload & { paymentMethodId?: number },
  ): Promise<PaymentResult> {
    const {
      amount,
      currency,
      donationId,
      description,
      customerName,
      customerEmail,
      paymentMethodId,
    } = payload;

    // Determine the endpoint based on the presence of paymentMethodId.
    const endpoint = paymentMethodId ? 'ExecutePayment' : 'SendPayment';

    const requestBody = {
      ...(paymentMethodId && { PaymentMethodId: paymentMethodId }), // Add the payment method if it exists.
      CustomerName: customerName,
      NotificationOption: 'LNK', // Link Only.
      InvoiceValue: amount,
      CallBackUrl: this.configService.myFatoorahCallbackUrl,
      ErrorUrl: this.configService.myFatoorahErrorkUrl,
      Language: 'ar', // 'en' or 'ar'
      CustomerEmail: customerEmail,
      CurrencyIso: currency,
      Description: description,
      ClientReferenceId: donationId, // A reference ID from your own system.
    };

    const data = await this.request<MyFatoorahResponseData>(
      'post',
      endpoint,
      requestBody,
      `Create MyFatoorah payment via ${endpoint}`,
    );

    if (!data.PaymentURL || !data.InvoiceId) {
      throw new InternalServerErrorException(
        'Payment initiation failed: Missing PaymentURL or InvoiceId.',
      );
    }

    return {
      id: data.InvoiceId.toString(),
      url: data.PaymentURL,
      status: 'pending',
      rawResponse: data,
    };
  }

  async getPaymentStatus(
    invoiceId: string,
  ): Promise<MyFatoorahGetPaymentStatusData> {
    return this.request<MyFatoorahGetPaymentStatusData>(
      'post',
      'GetPaymentStatus',
      { Key: invoiceId, KeyType: 'InvoiceId' }, // Payload to check the status.
      'Get MyFatoorah payment status',
    );
  }
}
