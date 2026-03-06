export interface PaginatedResponseDto<T> {
  data: T[];
  nextCursor: string | null;
}
