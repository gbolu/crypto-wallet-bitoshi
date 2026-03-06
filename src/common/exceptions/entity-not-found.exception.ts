import { DomainException } from './domain.exception';

export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, identifier: string) {
    super('ENTITY_NOT_FOUND', `${entityName} ${identifier} not found`);
  }
}
