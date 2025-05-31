export class BaseResultDto<T> {
  success: boolean;
  message: string;
  data: T;

  constructor(data: T, message: string, success: boolean) {
    this.data = data;
    this.message = message;
    this.success = success;
  }
}

export class BasePaginationResultDto<T> {
  success: boolean;
  message: string;
  data: T;
  total: number;
  page: number;
  pageSize: number;

  constructor(data: T, total: number, page: number, pageSize: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.pageSize = pageSize;
  }
}

export class BaseQueryParamsDto {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: string;
  search: string;
}
