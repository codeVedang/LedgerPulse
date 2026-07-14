export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  page: { cursor: string | null; nextCursor: string | null; limit: number };
}
