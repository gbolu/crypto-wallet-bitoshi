import { TransactionStatus } from '../enums/transaction-status.enum';

const allowedTransitions: Record<TransactionStatus, Set<TransactionStatus>> = {
  [TransactionStatus.PENDING]: new Set([
    TransactionStatus.CONFIRMED,
    TransactionStatus.FAILED,
  ]),
  [TransactionStatus.CONFIRMED]: new Set(),
  [TransactionStatus.FAILED]: new Set(),
};

export class TransactionStateMachine {
  static transition(
    currentStatus: TransactionStatus,
    nextStatus: TransactionStatus,
  ): TransactionStatus {
    const allowed = allowedTransitions[currentStatus];
    if (!allowed?.has(nextStatus)) {
      throw new Error(
        `Invalid transaction transition: ${currentStatus} -> ${nextStatus}`,
      );
    }
    return nextStatus;
  }
}
