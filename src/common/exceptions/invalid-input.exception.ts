import { DomainException } from './domain.exception';

export class InvalidInputException extends DomainException {
  constructor(message: string) {
    super('INVALID_INPUT', message);
  }
}
