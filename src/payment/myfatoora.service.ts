import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios, { AxiosInstance, AxiosError, AxiosResponse, Method } from 'axios';
import {
  PaymentPayload,
  PaymentResult,
  PaymentService,
  MyFatoorahResponseData, // Specific Data type for createPayment
  MyFatoorahGetPaymentStatusData, // Specific Data type for getPaymentStatus
} from '../common/interfaces/payment-service.interface'; // Ensure these interfaces are defined here
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MyFatooraService implements PaymentService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly http: AxiosInstance;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('MYFATOORAH_API_KEY');
    // Ensure API key is configured. This check is only needed once.
    if (!apiKey) {
      throw new InternalServerErrorException(
        'MyFatoorah API Key is not configured. Please check your environment variables.',
      );
    }
    this.apiKey = apiKey;

    this.baseUrl =
      this.configService.get<string>('MYFATOORAH_API_URL') || // Corrected variable name from 'MYFatoorah_API_URL'
      'https://apitest.myfatoorah.com/v2/'; // Use test URL for development

    // Initialize Axios instance with base URL and headers
    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Generic private helper method to make HTTP requests to MyFatoorah API.
   * Handles error logging and throwing a consistent exception.
   * Assumes MyFatoorah responses are typically wrapped in `{ IsSuccess: boolean, Message: string, Data: T }`.
   *
   * @param method HTTP method (e.g., 'get', 'post').
   * @param url API endpoint path.
   * @param data Request body data (for POST/PUT).
   * @param operationName A descriptive name for the API operation for logging/errors.
   * @param headers Optional additional headers.
   * @returns The 'Data' part of the MyFatoorah API response, typed as T.
   * @throws InternalServerErrorException if the request fails or response is invalid.
   */
  private async request<T>(
    method: Method,
    url: string,
    data?: any, // `any` here is for the request body, which can vary by endpoint
    operationName: string = 'MyFatoorah API call',
    headers?: Record<string, string>,
  ): Promise<T> {
    // Define the common MyFatoorah API response structure locally to avoid importing it
    interface MyFatoorahApiResponseLocal<TData> {
      IsSuccess: boolean;
      Message: string;
      ValidationErrors?: any[];
      Data: TData;
    }

    try {
      // Explicitly type the Axios response with the common MyFatoorah API wrapper structure.
      const response = await this.http.request<
        any,
        AxiosResponse<MyFatoorahApiResponseLocal<T>>
      >({
        method,
        url,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ...(typeof data !== 'undefined' ? { data } : {}),
        ...(typeof headers !== 'undefined' ? { headers } : {}),
      });

      if (!response.data.IsSuccess) {
        const validationErrors = response.data.ValidationErrors
          ? `Validation Errors: ${JSON.stringify(response.data.ValidationErrors)}`
          : '';
        throw new InternalServerErrorException(
          `${operationName} failed: ${response.data.Message}. ${validationErrors}`,
        );
      }

      // Ensure the 'Data' field is present and not null/undefined, as it's expected to contain the actual payload.
      if (response.data.Data === undefined || response.data.Data === null) {
        throw new InternalServerErrorException(
          `${operationName} failed: 'Data' field is missing or null from MyFatoorah response. This might indicate an unexpected API response structure.`,
        );
      }

      // Return the data contained within the 'Data' field, typed as T.
      return response.data.Data;
    } catch (error) {
      // Type assertion for AxiosError to safely access .response
      const axiosError = error as AxiosError;
      // Safely attempt to get the error message from the response data, assuming MyFatoorah's common error structure
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

  /**
   * Initiates a payment request with MyFatoorah.
   * @param payload Payment details.
   * @returns PaymentResult containing transaction ID and payment URL.
   * @throws InternalServerErrorException if payment initiation fails.
   */
  async createPayment(payload: PaymentPayload): Promise<PaymentResult> {
    const {
      amount,
      currency,
      donationId,
      description,
      customerName,
      customerEmail,
    } = payload;

    const requestBody = {
      CustomerName: customerName,
      NotificationOption: 'LNK', // 'EML', 'SMS', 'ALL', 'LNK' (Link only)
      InvoiceValue: amount,
      CallBackUrl: this.configService.get<string>('MYFATOORAH_CALLBACK_URL'), // Your webhook URL
      ErrorUrl: this.configService.get<string>('MYFATOORAH_ERROR_URL'), // Your error URL
      Language: 'en', // 'en' or 'ar'
      CustomerEmail: customerEmail,
      CurrencyIso: currency, // Ensure currency is passed
      Description: description, // Pass description to MyFatoorah
      ClientReferenceId: donationId, // Our internal donation ID
      // CustomerMobile: '12345678', // Optional: Add if you collect customer mobile
    };

    // Use MyFatoorahResponseData as the expected type for the 'Data' part of the response
    const data = await this.request<MyFatoorahResponseData>(
      'post',
      'SendPayment',
      requestBody,
      'create MyFatoorah payment',
    );

    // Perform validation on the specific data received
    if (!data.PaymentURL || !data.InvoiceId) {
      throw new InternalServerErrorException(
        'MyFatoorah payment initiation failed: Missing PaymentURL or InvoiceId in response data.',
      );
    }

    return {
      id: data.InvoiceId.toString(), // MyFatoorah's InvoiceId acts as our paymentId, convert to string
      url: data.PaymentURL,
      status: 'pending', // Initial status from payment gateway
      rawResponse: data, // Store the typed 'Data' content received from MyFatoorah
    };
  }

  /**
   * Retrieves payment status from MyFatoorah using InvoiceId.
   * @param invoiceId The MyFatoorah InvoiceId.
   * @returns Payment status data from MyFatoorah.
   * @throws InternalServerErrorException if status retrieval fails.
   */
  async getPaymentStatus(
    invoiceId: string,
  ): Promise<MyFatoorahGetPaymentStatusData> {
    // Using MyFatoorahGetPaymentStatusData as the explicit return type
    return await this.request<MyFatoorahGetPaymentStatusData>(
      'post',
      'GetPaymentStatus',
      { Key: invoiceId, KeyType: 'InvoiceId' },
      'get MyFatoorah payment status',
    );
  }

  // --- The rest of your existing MyFatoorah methods, now fully integrated with the `request` helper ---
  // For methods where you don't have a specific interface for the 'Data' payload,
  // the generic type `any` is used for `T` in `this.request<any>`.

  async getBanks(): Promise<any> {
    // Returns any
    return await this.request<any>(
      'get',
      'GetBanks',
      undefined,
      'get MyFatoorah banks',
    );
  }

  async getCurrenciesExchangeList(): Promise<any> {
    // Returns any
    return await this.request<any>(
      'get',
      'GetCurrenciesExchangeList',
      undefined,
      'get MyFatoorah currencies exchange list',
    );
  }

  async sendPaymentRequest(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'SendPayment',
      payload,
      'send MyFatoorah payment request',
    );
  }

  async initiatePayment(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'InitiatePayment',
      payload,
      'initiate MyFatoorah payment',
    );
  }

  async initiateSession(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'InitiateSession',
      payload,
      'initiate MyFatoorah session',
    );
  }

  async updateSession(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'UpdateSession',
      payload,
      'update MyFatoorah session',
    );
  }

  async executePayment(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'ExecutePayment',
      payload,
      'execute MyFatoorah payment',
    );
  }

  /**
   * Handles direct payment requests that do not go through the main MyFatoorah API endpoint (dynamic URL).
   * This method explicitly uses raw `axios.post` because it targets an external, dynamic URL
   * which does not fit the `this.http` instance's base URL configuration.
   * Its response structure may also differ from the standard MyFatoorahApiResponse wrapper.
   * @param payload Contains `paymentUrl` and `body` for the direct payment.
   * @returns The raw response data from the direct payment.
   * @throws InternalServerErrorException if the direct payment fails.
   */
  async directPayment(payload: {
    paymentUrl: string;
    body: unknown;
  }): Promise<any> {
    try {
      const { paymentUrl: url, body } = payload;

      const response: AxiosResponse<any> = await axios.post(url, body, {
        headers: { 'Content-Type': 'application/json' },
      });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.message; // Direct API might not have .Message from MyFatoorah's wrapper
      console.error(
        `direct MyFatoorah payment error:`,
        axiosError.response?.data || axiosError.message,
      );
      throw new InternalServerErrorException(
        `Failed to direct MyFatoorah payment: ${errorMessage}`,
      );
    }
  }

  async fetchPaymentStatus(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'GetPaymentStatus',
      payload,
      'fetch MyFatoorah payment status',
    );
  }

  async updatePaymentStatus(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'UpdatePaymentStatus',
      payload,
      'update MyFatoorah payment status',
    );
  }

  async getRecurringPayment(): Promise<any> {
    return await this.request<any>(
      'get',
      'GetRecurringPayment',
      undefined,
      'get MyFatoorah recurring payment',
    );
  }

  async cancelRecurringPayment(recurringId: string): Promise<any> {
    return await this.request<any>(
      'post',
      `CancelRecurringPayment?recurringId=${recurringId}`,
      undefined,
      'cancel MyFatoorah recurring payment',
    );
  }

  async resumeRecurringPayment(recurringId: string): Promise<any> {
    return await this.request<any>(
      'post',
      `ResumeRecurringPayment?recurringId=${recurringId}`,
      undefined,
      'resume MyFatoorah recurring payment',
    );
  }

  async cancelToken(token: string): Promise<any> {
    return await this.request<any>(
      'post',
      `CancelToken?Token=${token}`,
      undefined,
      'cancel MyFatoorah token',
    );
  }

  async registerApplePayDomain(domain: string): Promise<any> {
    return await this.request<any>(
      'post',
      'RegisterApplePayDomain',
      { DomainName: domain },
      'register MyFatoorah Apple Pay domain',
    );
  }

  async makeRefund(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'MakeRefund',
      payload,
      'make MyFatoorah refund',
    );
  }

  async getRefundStatus(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'GetRefundStatus',
      payload,
      'get MyFatoorah refund status',
    );
  }

  async getDepositedInvoices(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'GetDepositedInvoices',
      payload,
      'get MyFatoorah deposited invoices',
    );
  }

  async getCountries(): Promise<any> {
    return await this.request<any>(
      'get',
      'GetCountries',
      undefined,
      'get MyFatoorah countries',
    );
  }

  async getCities(shippingMethod: number, countryCode: string): Promise<any> {
    return await this.request<any>(
      'get',
      `GetCities?shippingMethod=${shippingMethod}&countryCode=${countryCode}`,
      undefined,
      'get MyFatoorah cities',
    );
  }

  async calculateShippingCharge(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'calculateshippingcharge',
      payload,
      'calculate MyFatoorah shipping charge',
    );
  }

  async updateShippingStatus(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'UpdateShippingStatus',
      payload,
      'update MyFatoorah shipping status',
    );
  }

  async requestPickup(shippingMethod: number): Promise<any> {
    return await this.request<any>(
      'get',
      `RequestPickup?shippingMethod=${shippingMethod}`,
      undefined,
      'request MyFatoorah pickup',
    );
  }

  async getShippingOrderList(query: any): Promise<any> {
    const qs = new URLSearchParams(query).toString();
    return await this.request<any>(
      'get',
      `GetShippingOrderList?${qs}`,
      undefined,
      'get MyFatoorah shipping order list',
    );
  }

  async createSupplier(formData: any): Promise<any> {
    return await this.request<any>(
      'post',
      'CreateSupplier',
      formData,
      'create MyFatoorah supplier',
      { 'Content-Type': 'multipart/form-data' },
    );
  }

  async editSupplier(formData: any): Promise<any> {
    return await this.request<any>(
      'post',
      'EditSupplier',
      formData,
      'edit MyFatoorah supplier',
      { 'Content-Type': 'multipart/form-data' },
    );
  }

  async customizeSupplierCommissions(payload: any): Promise<any> {
    return await this.request<any>(
      'post',
      'CustomizeSupplierCommissions',
      payload,
      'customize MyFatoorah supplier commissions',
    );
  }

  async getSuppliers(): Promise<any> {
    return await this.request<any>(
      'get',
      'GetSuppliers',
      undefined,
      'get MyFatoorah suppliers',
    );
  }

  async getSupplierDetails(supplierCode: number): Promise<any> {
    return await this.request<any>(
      'get',
      `GetSupplierDetails?supplierCode=${supplierCode}`,
      undefined,
      'get MyFatoorah supplier details',
    );
  }

  async getSupplierDeposits(params: any): Promise<any> {
    const qs = new URLSearchParams(params).toString();
    return await this.request<any>(
      'get',
      `GetSupplierDeposits?${qs}`,
      undefined,
      'get MyFatoorah supplier deposits',
    );
  }

  async getSupplierDocuments(supplierCode: number): Promise<any> {
    return await this.request<any>(
      'get',
      `GetSupplierDocuments?supplierCode=${supplierCode}`,
      undefined,
      'get MyFatoorah supplier documents',
    );
  }

  async getSupplierDashboard(supplierCode: number): Promise<any> {
    return await this.request<any>(
      'get',
      `GetSupplierDashboard?supplierCode=${supplierCode}`,
      undefined,
      'get MyFatoorah supplier dashboard',
    );
  }
}
