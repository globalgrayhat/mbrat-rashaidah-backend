export interface IPaginationParams {
  skip: number;
  take: number;
  order: Record<string, 'ASC' | 'DESC'>;
  search?: string;
}

export interface IPaginationMeta {
  page: number;
  limit: number;
  offset: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ICollectionResponse<T> {
  data: T[];
  meta: IPaginationMeta;
}
