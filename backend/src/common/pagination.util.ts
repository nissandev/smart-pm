export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

/** Always paginate — defaults when query params omitted (production-safe). */
export function parsePagination(page?: string, limit?: string): PaginationParams {
  const pageNum = Math.max(1, parseInt(page ?? String(DEFAULT_PAGE), 10) || DEFAULT_PAGE);
  const limitNum = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
  );
  return {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum,
  };
}

export function toPaginatedResult<T>(
  data: T[],
  total: number,
  pagination: PaginationParams,
): PaginatedResult<T> {
  return {
    data,
    total,
    page: pagination.page,
    pages: Math.max(1, Math.ceil(total / pagination.limit)),
    limit: pagination.limit,
  };
}
