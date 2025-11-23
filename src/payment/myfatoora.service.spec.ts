/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { MyFatooraService } from './myfatoora.service';
import { AppConfigService } from '../config/config.service';
import {
  MyFatoorahResponseData,
  MyFatoorahGetPaymentStatusData,
  MyFatoorahInitiatePaymentData,
} from '../common/interfaces/payment-service.interface';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MyFatooraService', () => {
  let service: MyFatooraService;
  let configService: jest.Mocked<AppConfigService>;
  let httpClient: jest.Mocked<AxiosInstance>;

  const mockConfig = {
    myFatoorahApiKey: 'test-api-key',
    myFatoorahApiUrl: 'https://apitest.myfatoorah.com',
    myFatoorahCallbackUrl: 'https://example.com/callback',
    myFatoorahErrorkUrl: 'https://example.com/error',
    myFatoorahInvoiceTtlMinutes: 60,
    myFatoorahTz: 'Asia/Kuwait',
    myFatoorahTtlSkewSeconds: 30,
  };

  beforeEach(async () => {
    // Create mock axios instance
    httpClient = {
      request: jest.fn(),
    } as any;

    mockedAxios.create = jest.fn().mockReturnValue(httpClient);

    // Create mock config service
    configService = {
      myFatoorahApiKey: mockConfig.myFatoorahApiKey,
      myFatoorahApiUrl: mockConfig.myFatoorahApiUrl,
      myFatoorahCallbackUrl: mockConfig.myFatoorahCallbackUrl,
      myFatoorahErrorkUrl: mockConfig.myFatoorahErrorkUrl,
      myFatoorahInvoiceTtlMinutes: mockConfig.myFatoorahInvoiceTtlMinutes,
      myFatoorahTz: mockConfig.myFatoorahTz,
      myFatoorahTtlSkewSeconds: mockConfig.myFatoorahTtlSkewSeconds,
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyFatooraService,
        {
          provide: AppConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<MyFatooraService>(MyFatooraService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for expected error cases in tests
    jest.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected error logs during tests
    });
  });

  describe('constructor', () => {
    it('should throw error if API key is missing', async () => {
      const invalidConfig = {
        ...configService,
        myFatoorahApiKey: '',
      };

      await expect(
        Test.createTestingModule({
          providers: [
            MyFatooraService,
            {
              provide: AppConfigService,
              useValue: invalidConfig,
            },
          ],
        }).compile(),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw error if invoice TTL is invalid', async () => {
      const invalidConfig = {
        ...configService,
        myFatoorahInvoiceTtlMinutes: 0,
      };

      await expect(
        Test.createTestingModule({
          providers: [
            MyFatooraService,
            {
              provide: AppConfigService,
              useValue: invalidConfig,
            },
          ],
        }).compile(),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should initialize with valid config', () => {
      expect(service).toBeDefined();
      expect(mockedAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.stringContaining('/v2/'),
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockConfig.myFatoorahApiKey}`,
          }),
        }),
      );
    });
  });

  describe('createPayment', () => {
    const mockPaymentPayload = {
      amount: 100,
      currency: 'KWD',
      donationId: 'donation-123',
      description: 'Test donation',
      customerName: 'John Doe',
      customerEmail: 'john@example.com',
      customerMobile: '1234567890',
    };

    const mockResponse: MyFatoorahResponseData = {
      InvoiceId: '12345',
      InvoiceURL: 'https://myfatoorah.com/invoice/12345',
    };

    it('should create payment successfully', async () => {
      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: true,
          Message: 'Success',
          Data: mockResponse,
        },
      });

      const result = await service.createPayment(mockPaymentPayload);

      expect(result).toEqual({
        id: '12345',
        url: 'https://myfatoorah.com/invoice/12345',
        status: 'pending',
        rawResponse: mockResponse,
      });

      expect(httpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: 'SendPayment',
          data: expect.objectContaining({
            InvoiceValue: 100,
            CurrencyIso: 'KWD',
            CustomerName: 'John Doe',
            CustomerEmail: 'john@example.com',
            CustomerMobile: '1234567890',
          }),
        }),
      );
    });

    it('should include payment method ID if provided', async () => {
      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: true,
          Message: 'Success',
          Data: mockResponse,
        },
      });

      await service.createPayment({
        ...mockPaymentPayload,
        paymentMethodId: 1,
      });

      expect(httpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            InvoicePaymentMethods: [1],
          }),
        }),
      );
    });

    it('should throw error if API call fails', async () => {
      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: false,
          Message: 'Payment failed',
        },
      });

      await expect(service.createPayment(mockPaymentPayload)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw error if InvoiceURL is missing', async () => {
      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: true,
          Message: 'Success',
          Data: {
            InvoiceId: '12345',
          },
        },
      });

      await expect(service.createPayment(mockPaymentPayload)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle axios errors', async () => {
      const axiosError = {
        message: 'Network error',
        response: {
          data: {
            Message: 'API Error',
          },
        },
      } as AxiosError;

      (httpClient.request as jest.Mock).mockRejectedValue(axiosError);

      await expect(service.createPayment(mockPaymentPayload)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw UnauthorizedException for 401 errors', async () => {
      const axiosError = {
        message: 'Unauthorized',
        response: {
          status: 401,
          data: {
            Message: 'Invalid API key',
          },
        },
      } as AxiosError;

      (httpClient.request as jest.Mock).mockRejectedValue(axiosError);

      await expect(service.createPayment(mockPaymentPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for 403 errors', async () => {
      const axiosError = {
        message: 'Forbidden',
        response: {
          status: 403,
          data: {
            Message: 'Access forbidden',
          },
        },
      } as AxiosError;

      (httpClient.request as jest.Mock).mockRejectedValue(axiosError);

      await expect(service.createPayment(mockPaymentPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw BadRequestException for 404 errors', async () => {
      const axiosError = {
        message: 'Not Found',
        response: {
          status: 404,
          data: {
            Message: 'Endpoint not found',
          },
        },
      } as AxiosError;

      (httpClient.request as jest.Mock).mockRejectedValue(axiosError);

      await expect(service.createPayment(mockPaymentPayload)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPaymentStatus', () => {
    const mockStatusResponse: MyFatoorahGetPaymentStatusData = {
      InvoiceId: 12345,
      InvoiceStatus: 4,
      CreatedDate: '2024-01-01T00:00:00',
      ExpireDate: '2024-01-02T00:00:00',
      InvoiceValue: 100,
      Payments: [
        {
          PaymentId: 'P-123',
          PaymentGateway: 'KNET',
          PaymentMethodId: 1,
          PaymentMethod: 'KNET',
          PaymentCurrencyIso: 'KWD',
          PaymentValue: 100,
          PaymentStatus: 'SUCCESS',
          PaymentDate: '2024-01-01T00:00:00',
        },
      ],
    };

    it('should get payment status successfully', async () => {
      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: true,
          Message: 'Success',
          Data: mockStatusResponse,
        },
      });

      const result = await service.getPaymentStatus('12345', 'InvoiceId');

      expect(result).toEqual({
        invoiceId: '12345',
        outcome: 'paid',
        raw: mockStatusResponse,
      });

      expect(httpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: 'GetPaymentStatus',
          data: {
            Key: '12345',
            KeyType: 'InvoiceId',
          },
        }),
      );
    });

    it('should throw error if key is empty', async () => {
      await expect(service.getPaymentStatus('', 'InvoiceId')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle pending status', async () => {
      const pendingResponse = {
        ...mockStatusResponse,
        InvoiceStatus: 0,
        Payments: [
          {
            ...mockStatusResponse.Payments[0],
            PaymentStatus: 'PENDING',
          },
        ],
      };

      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: true,
          Message: 'Success',
          Data: pendingResponse,
        },
      });

      const result = await service.getPaymentStatus('12345', 'InvoiceId');

      expect(result.outcome).toBe('pending');
    });

    it('should handle failed status', async () => {
      const failedResponse = {
        ...mockStatusResponse,
        InvoiceStatus: 1,
        Payments: [
          {
            ...mockStatusResponse.Payments[0],
            PaymentStatus: 'FAILED',
          },
        ],
      };

      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: true,
          Message: 'Success',
          Data: failedResponse,
        },
      });

      const result = await service.getPaymentStatus('12345', 'InvoiceId');

      expect(result.outcome).toBe('failed');
    });
  });

  describe('getPaymentStatusByPaymentId', () => {
    it('should call getPaymentStatus with PaymentId key type', async () => {
      const mockStatusResponse: MyFatoorahGetPaymentStatusData = {
        InvoiceId: 12345,
        InvoiceStatus: 4,
        CreatedDate: '2024-01-01T00:00:00',
        ExpireDate: '2024-01-02T00:00:00',
        InvoiceValue: 100,
        Payments: [],
      };

      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: true,
          Message: 'Success',
          Data: mockStatusResponse,
        },
      });

      await service.getPaymentStatusByPaymentId('P-123');

      expect(httpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            Key: 'P-123',
            KeyType: 'PaymentId',
          },
        }),
      );
    });
  });

  describe('initiatePayment', () => {
    const mockInitiateResponse: MyFatoorahInitiatePaymentData = {
      PaymentMethods: [
        {
          PaymentMethodId: 1,
          PaymentMethodCode: 'KNET',
          PaymentMethodEn: 'KNET',
          PaymentMethodAr: 'كي نت',
          IsDirectPayment: false,
          ServiceCharge: 0.5,
          TotalAmount: 100.5,
          CurrencyIso: 'KWD',
        },
        {
          PaymentMethodId: 2,
          PaymentMethodCode: 'VISA',
          PaymentMethodEn: 'VISA/MASTER',
          PaymentMethodAr: 'فيزا / ماستر',
          IsDirectPayment: false,
          ServiceCharge: 1.0,
          TotalAmount: 101.0,
          CurrencyIso: 'KWD',
        },
      ],
    };

    it('should initiate payment successfully', async () => {
      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: true,
          Message: 'Success',
          Data: mockInitiateResponse,
        },
      });

      const result = await service.initiatePayment(100, 'KWD');

      expect(result).toEqual(mockInitiateResponse);
      expect(httpClient.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'post',
          url: 'InitiatePayment',
          data: {
            InvoiceAmount: 100,
            CurrencyIso: 'KWD',
          },
        }),
      );
    });

    it('should throw error if invoice amount is invalid', async () => {
      await expect(service.initiatePayment(0, 'KWD')).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.initiatePayment(-10, 'KWD')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if currency ISO is invalid', async () => {
      await expect(service.initiatePayment(100, '')).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.initiatePayment(100, 'KW')).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.initiatePayment(100, 'KWDX')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if PaymentMethods is missing', async () => {
      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: true,
          Message: 'Success',
          Data: {},
        },
      });

      await expect(service.initiatePayment(100, 'KWD')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw error if PaymentMethods is not an array', async () => {
      (httpClient.request as jest.Mock).mockResolvedValue({
        data: {
          IsSuccess: true,
          Message: 'Success',
          Data: {
            PaymentMethods: 'invalid',
          },
        },
      });

      await expect(service.initiatePayment(100, 'KWD')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
