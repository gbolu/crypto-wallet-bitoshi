import { IsEnum } from 'class-validator';
import { MockFailureType } from './mock-failure-type.enum';

export class MockFailureDto {
  @IsEnum(MockFailureType)
  errorType: MockFailureType;
}
