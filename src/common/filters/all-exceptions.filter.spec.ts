import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AssetMismatchException } from '../exceptions/asset-mismatch.exception';
import { EntityNotFoundException } from '../exceptions/entity-not-found.exception';
import { InsufficientBalanceException } from '../exceptions/insufficient-balance.exception';
import { InvalidInputException } from '../exceptions/invalid-input.exception';
import { OtelLoggerService } from '../logger/otel-logger.service';
import { AllExceptionsFilter } from './all-exceptions.filter';

type JsonResponse = {
  error: {
    statusCode: number;
    message: string | object;
    path: string;
    correlationId: string | null;
    timestamp: string;
  };
};

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let logger: Pick<OtelLoggerService, 'event'>;

  beforeEach(() => {
    logger = {
      event: jest.fn(),
    };
    filter = new AllExceptionsFilter(logger as OtelLoggerService);
  });

  const makeHost = (req: {
    url: string;
    method?: string;
    correlationId?: string;
  }) => {
    const status = jest.fn().mockReturnThis();
    const json = jest.fn<void, [JsonResponse]>();
    const response = { status, json };

    const host: ArgumentsHost = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => response,
      }),
    } as ArgumentsHost;

    return { host, response };
  };

  it('returns HTTP exception status and message', () => {
    const { host, response } = makeHost({
      method: 'GET',
      url: '/wallets/wallet_1',
      correlationId: 'corr-1',
    });
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    const payload = response.json.mock.calls[0][0];
    expect(payload.error.statusCode).toBe(HttpStatus.FORBIDDEN);
    expect(payload.error.message).toBe('Forbidden');
    expect(payload.error.path).toBe('/wallets/wallet_1');
    expect(payload.error.correlationId).toBe('corr-1');
    expect(payload.error.timestamp).toEqual(expect.any(String));
  });

  it('returns validation-style object response for bad requests', () => {
    const { host, response } = makeHost({
      method: 'POST',
      url: '/wallets/wallet_1/withdrawals',
    });
    const validationPayload = {
      message: ['amount must be greater than zero'],
      error: 'Bad Request',
      statusCode: 400,
    };
    const exception = new BadRequestException(validationPayload);

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    const payload = response.json.mock.calls[0][0];
    expect(payload.error.message).toEqual(validationPayload);
    expect(payload.error.correlationId).toBeNull();
  });

  it('returns 500 for unknown errors', () => {
    const { host, response } = makeHost({
      method: 'GET',
      url: '/transactions',
    });

    filter.catch(new Error('boom'), host);

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    const payload = response.json.mock.calls[0][0];
    expect(payload.error.message).toBe('Internal server error');
    expect(payload.error.statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('maps domain exceptions to expected HTTP statuses', () => {
    const cases: Array<[Error, number]> = [
      [new EntityNotFoundException('Wallet', 'wallet_1'), HttpStatus.NOT_FOUND],
      [
        new InvalidInputException('Invalid pagination cursor'),
        HttpStatus.BAD_REQUEST,
      ],
      [new InsufficientBalanceException(), HttpStatus.UNPROCESSABLE_ENTITY],
      [
        new AssetMismatchException('wallet_1', 'BTC', 'ETH'),
        HttpStatus.UNPROCESSABLE_ENTITY,
      ],
    ];

    for (const [exception, expectedStatus] of cases) {
      const { host, response } = makeHost({
        method: 'GET',
        url: '/wallets/wallet_1/transactions',
        correlationId: 'corr-domain',
      });

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(expectedStatus);
      const payload = response.json.mock.calls[0][0];
      expect(payload.error.statusCode).toBe(expectedStatus);
      expect(payload.error.message).toBe(exception.message);
      expect(payload.error.path).toBe('/wallets/wallet_1/transactions');
      expect(payload.error.correlationId).toBe('corr-domain');
    }
  });
});
