import { Repository } from 'typeorm';
import { InvalidInputException } from '../exceptions/invalid-input.exception';

export interface CursorPayload {
  createdAt: string;
  id: string;
}

export abstract class BaseRepository<T extends { id: string }> {
  constructor(protected readonly repository: Repository<T>) {}

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({ where: { id } as never });
  }

  async save(entity: T): Promise<T> {
    return this.repository.save(entity);
  }

  encodeCursor(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  }

  decodeCursor(cursor: string): CursorPayload {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      return JSON.parse(decoded) as CursorPayload;
    } catch {
      throw new InvalidInputException('Invalid pagination cursor');
    }
  }
}
