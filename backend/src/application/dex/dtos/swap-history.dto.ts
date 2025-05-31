import { RouteInfo } from 'src/domain';

export class SwapHistoryDto {
  items: SwapHistoryRecord[];
  coinA: string;
  coinB: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

class SwapHistoryRecord {
  id: string;
  status: number;
  address: string;
  swapAforB: boolean;
  txDigest: string;
  configName: string;
  gasInfo: {
    totalGasFee: string;
    netGasFee: string;
  };
  routeInfo?: RouteInfo;
}
