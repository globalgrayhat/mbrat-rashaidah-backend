import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { DonationsService } from '../donations/donations.service';
import { MyFatooraWebhookEvent } from '../common/interfaces/payment-service.interface';

describe('WebhookController', () => {
  let controller: WebhookController;
  let donationsService: jest.Mocked<DonationsService>;

  const mockWebhookEvent: MyFatooraWebhookEvent = {
    Event: 1,
    CreatedDate: '2024-01-01T00:00:00',
    Data: {
      InvoiceId: 12345,
      InvoiceStatus: 4,
      InvoiceReference: 'REF-123',
      CustomerReference: 'CUST-123',
      CreatedDate: '2024-01-01T00:00:00',
      ExpireDate: '2024-01-02T00:00:00',
      InvoiceValue: 100,
      Comments: 'Test payment',
      CustomerName: 'John Doe',
      CustomerMobile: '1234567890',
      CustomerEmail: 'john@example.com',
    },
  };

  beforeEach(async () => {
    // Suppress console.error for expected error cases in tests
    jest.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected error logs during tests
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        {
          provide: DonationsService,
          useValue: {
            handlePaymentWebhook: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    donationsService = module.get(DonationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('handleMyFatooraWebhook', () => {
    it('should process webhook successfully', async () => {
      (donationsService.handlePaymentWebhook as jest.Mock).mockResolvedValue({
        success: true,
        outcome: 'paid',
      });

      const result = await controller.handleMyFatooraWebhook(mockWebhookEvent);

      expect(result).toEqual({
        received: true,
        success: true,
      });

      expect(donationsService.handlePaymentWebhook).toHaveBeenCalledWith(
        [],
        mockWebhookEvent,
      );
    });

    it('should handle webhook with payment method ID', async () => {
      const eventWithPaymentMethod = {
        ...mockWebhookEvent,
        Data: {
          ...mockWebhookEvent.Data,
          Payments: [
            {
              PaymentMethodId: 1,
              PaymentId: 'P-123',
              PaymentStatus: 'SUCCESS',
            },
          ],
        },
      };

      (donationsService.handlePaymentWebhook as jest.Mock).mockResolvedValue({
        success: true,
        outcome: 'paid',
      });

      const result = await controller.handleMyFatooraWebhook(
        eventWithPaymentMethod as any,
      );

      expect(result.success).toBe(true);
      expect(donationsService.handlePaymentWebhook).toHaveBeenCalled();
    });

    it('should handle webhook without Data property', async () => {
      const eventWithoutData = {
        Event: 1,
        CreatedDate: '2024-01-01T00:00:00',
        InvoiceId: 12345,
        TransactionStatus: 'SUCCESS',
      };

      (donationsService.handlePaymentWebhook as jest.Mock).mockResolvedValue({
        success: true,
        outcome: 'paid',
      });

      const result = await controller.handleMyFatooraWebhook(
        eventWithoutData as any,
      );

      expect(result.success).toBe(true);
      expect(donationsService.handlePaymentWebhook).toHaveBeenCalled();
    });

    it('should throw BadRequestException when service throws error', async () => {
      const errorMessage = 'Payment not found';
      (donationsService.handlePaymentWebhook as jest.Mock).mockRejectedValue(
        new Error(errorMessage),
      );

      await expect(
        controller.handleMyFatooraWebhook(mockWebhookEvent),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.handleMyFatooraWebhook(mockWebhookEvent),
      ).rejects.toThrow(errorMessage);
    });

    it('should handle error with message property', async () => {
      const error = new Error('Test error');
      (donationsService.handlePaymentWebhook as jest.Mock).mockRejectedValue(
        error,
      );

      await expect(
        controller.handleMyFatooraWebhook(mockWebhookEvent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle string error', async () => {
      (donationsService.handlePaymentWebhook as jest.Mock).mockRejectedValue(
        'String error',
      );

      await expect(
        controller.handleMyFatooraWebhook(mockWebhookEvent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle unknown error format', async () => {
      (donationsService.handlePaymentWebhook as jest.Mock).mockRejectedValue({
        unknown: 'error',
      });

      await expect(
        controller.handleMyFatooraWebhook(mockWebhookEvent),
      ).rejects.toThrow(BadRequestException);
    });

    it('should log webhook event details', async () => {
      const loggerSpy = jest.spyOn(controller['logger'], 'log');
      (donationsService.handlePaymentWebhook as jest.Mock).mockResolvedValue({
        success: true,
        outcome: 'paid',
      });

      await controller.handleMyFatooraWebhook(mockWebhookEvent);

      expect(loggerSpy).toHaveBeenCalledWith(
        'Received MyFatoorah webhook event',
        expect.objectContaining({
          event: mockWebhookEvent.Event,
          invoiceId: mockWebhookEvent.Data.InvoiceId,
        }),
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        'MyFatoorah webhook processed successfully',
        expect.objectContaining({
          invoiceId: mockWebhookEvent.Data.InvoiceId,
        }),
      );

      loggerSpy.mockRestore();
    });

    it('should log errors when webhook processing fails', async () => {
      const loggerErrorSpy = jest.spyOn(controller['logger'], 'error');
      const error = new Error('Processing failed');
      (donationsService.handlePaymentWebhook as jest.Mock).mockRejectedValue(
        error,
      );

      await expect(
        controller.handleMyFatooraWebhook(mockWebhookEvent),
      ).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('MyFatoora webhook error'),
        error.stack,
        expect.objectContaining({
          event: expect.any(String),
        }),
      );

      loggerErrorSpy.mockRestore();
    });
  });
});

