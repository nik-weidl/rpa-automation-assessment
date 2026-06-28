export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
