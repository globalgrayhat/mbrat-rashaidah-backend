/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PaymentMethodsController } from './payment-methods.controller';
import { MyFatooraService } from './myfatoora.service';
import { CurrencyService } from '../common/services/currency.service';
import { MyFatoorahInitiatePaymentData } from '../common/interfaces/payment-service.interface';

describe('PaymentMethodsController', () => {
  let controller: PaymentMethodsController;
  let myFatooraService: jest.Mocked<MyFatooraService>;
  let currencyService: jest.Mocked<CurrencyService>;

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

  beforeEach(async () => {
    // Suppress console.error for expected error cases in tests
    jest.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected error logs during tests
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentMethodsController],
      providers: [
        {
          provide: MyFatooraService,
          useValue: {
            initiatePayment: jest.fn(),
          },
        },
        {
          provide: CurrencyService,
          useValue: {
            normalizeCurrency: jest.fn((c: string) => {
              return c?.toUpperCase() || 'KWD';
            }),
            isValidCurrency: jest.fn((c: string) => {
              return ['KWD', 'USD', 'EUR'].includes(c);
            }),
            getSupportedCurrencies: jest.fn(() => [
              { code: 'KWD' },
              { code: 'USD' },
              { code: 'EUR' },
            ]),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentMethodsController>(PaymentMethodsController);
    myFatooraService = module.get(MyFatooraService);
    currencyService = module.get(CurrencyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('getAvailablePaymentMethods', () => {
    it('should return available payment methods with default values', async () => {
      (myFatooraService.initiatePayment as jest.Mock).mockResolvedValue(
        mockInitiateResponse,
      );

      const result = await controller.getAvailablePaymentMethods();

      expect(result.success).toBe(true);
      expect(result.invoiceAmount).toBe(1.0);
      expect(result.currency).toBe('KWD');
      expect(result.paymentMethods).toHaveLength(2);
      expect(result.paymentMethods[0]).toEqual({
        id: 1,
        code: 'KNET',
        nameEn: 'KNET',
        nameAr: 'كي نت',
        isDirectPayment: false,
        serviceCharge: 0.5,
        totalAmount: 100.5,
        currency: 'KWD',
        imageUrl: undefined,
        minLimit: undefined,
        maxLimit: undefined,
      });
    });

    it('should return available payment methods with provided parameters', async () => {
      (myFatooraService.initiatePayment as jest.Mock).mockResolvedValue(
        mockInitiateResponse,
      );

      const result = await controller.getAvailablePaymentMethods('100', 'USD');

      expect(result.invoiceAmount).toBe(100);
      expect(result.currency).toBe('USD');
      expect(myFatooraService.initiatePayment).toHaveBeenCalledWith(100, 'USD');
    });

    it('should throw error for invalid currency', async () => {
      jest
        .spyOn(currencyService, 'isValidCurrency')
        .mockReturnValue(false as any);

      await expect(
        controller.getAvailablePaymentMethods('100', 'INVALID'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error for invalid amount', async () => {
      await expect(
        controller.getAvailablePaymentMethods('invalid', 'KWD'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.getAvailablePaymentMethods('-10', 'KWD'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.getAvailablePaymentMethods('0', 'KWD'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle service errors gracefully with fallback', async () => {
      (myFatooraService.initiatePayment as jest.Mock).mockRejectedValue(
        new Error('Service error'),
      );

      const result = await controller.getAvailablePaymentMethods('100', 'KWD');

      expect(result).toHaveProperty('fallback', true);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('paymentMethods');
      expect(result.paymentMethods).toBeInstanceOf(Array);
      expect(result.paymentMethods.length).toBeGreaterThan(0);
      expect(result.message).toContain('MyFatoorah API is not available');
    });

    it('should handle UnauthorizedException with fallback', async () => {
      const unauthorizedError = new UnauthorizedException(
        'MyFatoorah authentication failed',
      );
      (myFatooraService.initiatePayment as jest.Mock).mockRejectedValue(
        unauthorizedError,
      );

      const result = await controller.getAvailablePaymentMethods('100', 'KWD');

      expect(result).toHaveProperty('fallback', true);
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('paymentMethods');
      expect(result.paymentMethods).toBeInstanceOf(Array);
      expect(result.paymentMethods.length).toBeGreaterThan(0);
      expect(result.message).toContain('MyFatoorah API is not available');
    });

    it('should enrich payment methods with local metadata', async () => {
      (myFatooraService.initiatePayment as jest.Mock).mockResolvedValue(
        mockInitiateResponse,
      );

      const result = await controller.getAvailablePaymentMethods('100', 'KWD');

      expect(result.paymentMethods[0].id).toBe(1);
      expect(result.paymentMethods[0].code).toBe('KNET');
      expect(result.paymentMethods[0].nameEn).toBe('KNET');
      expect(result.paymentMethods[0].nameAr).toBe('كي نت');
    });
  });

  describe('getAllSupportedPaymentMethods', () => {
    it('should return all supported payment methods', () => {
      const result = controller.getAllSupportedPaymentMethods();

      expect(result.success).toBe(true);
      expect(result.paymentMethods).toBeDefined();
      expect(Array.isArray(result.paymentMethods)).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      expect(result.paymentMethods[0]).toHaveProperty('id');
      expect(result.paymentMethods[0]).toHaveProperty('code');
      expect(result.paymentMethods[0]).toHaveProperty('nameEn');
      expect(result.paymentMethods[0]).toHaveProperty('nameAr');
      expect(result.paymentMethods[0]).toHaveProperty('isDirectPayment');
    });

    it('should return correct count', () => {
      const result = controller.getAllSupportedPaymentMethods();

      expect(result.count).toBe(result.paymentMethods.length);
    });
  });

  describe('getPaymentMethodById', () => {
    it('should return payment method by valid ID', () => {
      const result = controller.getPaymentMethodById('1');

      expect(result.success).toBe(true);
      expect(result.paymentMethod).toBeDefined();
      expect(result.paymentMethod.id).toBe(1);
      expect(result.paymentMethod.code).toBe('KNET');
    });

    it('should throw error for invalid ID format', () => {
      expect(() => controller.getPaymentMethodById('invalid')).toThrow(
        BadRequestException,
      );

      expect(() => controller.getPaymentMethodById('abc')).toThrow(
        BadRequestException,
      );
    });

    it('should throw error for non-existent payment method ID', () => {
      expect(() => controller.getPaymentMethodById('99999')).toThrow(
        BadRequestException,
      );
    });

    it('should return correct payment method details', () => {
      const result = controller.getPaymentMethodById('2');

      expect(result.paymentMethod).toHaveProperty('id');
      expect(result.paymentMethod).toHaveProperty('code');
      expect(result.paymentMethod).toHaveProperty('nameEn');
      expect(result.paymentMethod).toHaveProperty('nameAr');
      expect(result.paymentMethod).toHaveProperty('isDirectPayment');
      expect(result.paymentMethod).toHaveProperty('imageUrl');
    });
  });
});
