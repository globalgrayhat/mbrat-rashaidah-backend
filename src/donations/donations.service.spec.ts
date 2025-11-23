/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository, ObjectLiteral } from 'typeorm';

import { DonationsService } from './donations.service';
import { MyFatooraService } from '../payment/myfatoora.service';
import { NotificationService } from '../common/services/notification.service';

import { Donation } from './entities/donation.entity';
import { Project } from '../projects/entities/project.entity';
import { Campaign } from '../campaigns/entities/campaign.entity';
import { Donor } from '../donor/entities/donor.entity';
import { Payment } from '../payment/entities/payment.entity';
import { User } from '../user/entities/user.entity';

type MockType<T> = {
  [P in keyof T]?: jest.Mock<unknown>;
};

function createRepositoryMock<T extends ObjectLiteral>(): MockType<
  Repository<T>
> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };
}

describe('DonationsService - reconcilePayment', () => {
  let service: DonationsService;
  let myFatooraService: MockType<MyFatooraService>;
  let paymentRepository: MockType<Repository<Payment>>;
  let donationRepository: MockType<Repository<Donation>>;

  const queryRunnerMock = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
    },
  };

  const dataSourceMock = {
    createQueryRunner: jest.fn(() => queryRunnerMock),
  } as unknown as DataSource;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Suppress console.error for expected error cases in tests
    jest.spyOn(console, 'error').mockImplementation(() => {
      // Suppress expected error logs during tests
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        {
          provide: MyFatooraService,
          useValue: {
            getPaymentStatus: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            notifyPaymentStatusChange: jest.fn(),
          },
        },
        { provide: DataSource, useValue: dataSourceMock },

        {
          provide: getRepositoryToken(Donation),
          useValue: createRepositoryMock<Donation>(),
        },
        {
          provide: getRepositoryToken(Project),
          useValue: createRepositoryMock<Project>(),
        },
        {
          provide: getRepositoryToken(Campaign),
          useValue: createRepositoryMock<Campaign>(),
        },
        {
          provide: getRepositoryToken(Donor),
          useValue: createRepositoryMock<Donor>(),
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: createRepositoryMock<Payment>(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createRepositoryMock<User>(),
        },
      ],
    }).compile();

    service = module.get<DonationsService>(DonationsService);
    myFatooraService = module.get(MyFatooraService) as any;
    paymentRepository = module.get(getRepositoryToken(Payment));
    donationRepository = module.get(getRepositoryToken(Donation));

    jest
      .spyOn<any, any>(service as any, 'applyPaymentOutcome')
      .mockImplementation(async () => ({
        updatedDonations: ['d1'],
        outcome: 'paid',
      }));
  });

  it('should throw BadRequestException if key is empty', async () => {
    await expect(
      service.reconcilePayment('', 'InvoiceId'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
  });

  it('should reconcile using InvoiceId and map to local payment', async () => {
    (myFatooraService.getPaymentStatus as jest.Mock).mockResolvedValue({
      outcome: 'paid',
      invoiceId: '12345',
      raw: {
        InvoiceId: 12345,
        Payments: [
          {
            PaymentId: 'P-999',
            PaymentStatus: 'SUCCESS',
          },
        ],
      },
    });

    const payment: Partial<Payment> = {
      id: 'local-payment-1',
      transactionId: '12345',
    };
    (paymentRepository.findOne as jest.Mock).mockResolvedValue(payment);

    // Mock donation repository for notification
    (donationRepository.find as jest.Mock).mockResolvedValue([]);

    const result = await service.reconcilePayment('12345', 'InvoiceId');

    expect(dataSourceMock.createQueryRunner).toHaveBeenCalled();
    expect(queryRunnerMock.startTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.commitTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();

    expect(paymentRepository.findOne).toHaveBeenCalledWith({
      where: { transactionId: '12345' },
    });

    expect((service as any).applyPaymentOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'local-payment-1' }),
      'paid',
      queryRunnerMock.manager,
    );

    expect(result).toEqual({
      outcome: 'paid',
      paymentId: 'local-payment-1',
      invoiceId: '12345',
      mfPaymentId: 'P-999',
      updatedDonations: ['d1'],
    });
  });

  it('should throw NotFoundException when payment does not exist for InvoiceId', async () => {
    (myFatooraService.getPaymentStatus as jest.Mock).mockResolvedValue({
      outcome: 'paid',
      invoiceId: '99999',
      raw: { InvoiceId: 99999, Payments: [] },
    });

    (paymentRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.reconcilePayment('99999', 'InvoiceId'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
  });

  it('should reconcile using PaymentId and fallback to InvoiceId mapping', async () => {
    (myFatooraService.getPaymentStatus as jest.Mock).mockResolvedValue({
      outcome: 'paid',
      invoiceId: 'INV-777',
      raw: {
        InvoiceId: 'INV-777',
        Payments: [
          {
            PaymentId: 'PAY-777',
            PaymentStatus: 'SUCCESS',
          },
        ],
      },
    });

    const payment: Partial<Payment> = {
      id: 'local-payment-777',
      transactionId: 'INV-777',
    };
    (paymentRepository.findOne as jest.Mock).mockResolvedValue(payment);
    (donationRepository.find as jest.Mock).mockResolvedValue([]);

    const result = await service.reconcilePayment('PAY-777', 'PaymentId');

    expect((service as any).applyPaymentOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'local-payment-777' }),
      'paid',
      queryRunnerMock.manager,
    );

    expect(result).toEqual({
      outcome: 'paid',
      paymentId: 'local-payment-777',
      invoiceId: 'INV-777',
      mfPaymentId: 'PAY-777',
      updatedDonations: ['d1'],
    });
  });

  it('should throw NotFoundException if no payment matches PaymentId/InvoiceId', async () => {
    (myFatooraService.getPaymentStatus as jest.Mock).mockResolvedValue({
      outcome: 'failed',
      invoiceId: 'INV-404',
      raw: {
        InvoiceId: 'INV-404',
        Payments: [{ PaymentId: 'PAY-404', PaymentStatus: 'Failed' }],
      },
    });

    (paymentRepository.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      service.reconcilePayment('PAY-404', 'PaymentId'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(queryRunnerMock.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunnerMock.release).toHaveBeenCalled();
  });

  afterEach(() => {
    // Restore console.error after each test
    jest.restoreAllMocks();
  });
});
