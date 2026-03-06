import Decimal from 'decimal.js';

export class AmountUtil {
  static parse(value: string): Decimal {
    return new Decimal(value);
  }

  static gte(left: string, right: string): boolean {
    return this.parse(left).gte(this.parse(right));
  }

  static add(left: string, right: string): string {
    return this.parse(left).add(this.parse(right)).toFixed();
  }

  static subtract(left: string, right: string): string {
    return this.parse(left).sub(this.parse(right)).toFixed();
  }
}
