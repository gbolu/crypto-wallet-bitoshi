import { DomainException } from './domain.exception';

export class InsufficientBalanceException extends DomainException {
  constructor() {
    super('INSUFFICIENT_BALANCE', 'Insufficient balance');
  }
}
