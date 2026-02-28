import request from './request';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface MetaCategoryNodeDto {
  id: string;
  taxonomy: string;
  code: string;
  name: string;
  level?: number;
  parentId?: string | null;
  path?: string | null;
  hasChildren: boolean;
  leaf?: boolean;
  status?: string;
  sort?: number;
  createdAt?: string;
  updatedAt?: string | null;
}

export interface MetaCategorySearchItemDto {
  node: MetaCategoryNodeDto;
  path?: string | null;
  pathNodes?: MetaCategoryNodeDto[];
}

export interface MetaCategoryChildrenBatchRequestDto {
  taxonomy: string;
  parentIds: string[];
  status?: string;
}

export interface MetaTaxonomyLevelConfigDto {
  level: number;
  displayName: string;
}

export interface MetaTaxonomyDto {
  code: string;
  name: string;
  status: string;
  levelConfigs: MetaTaxonomyLevelConfigDto[];
}

const CATEGORY_BASE = '/api/meta/categories';
const TAXONOMY_BASE = '/api/meta/taxonomies';

export const metaCategoryApi = {
  listNodes(params: {
    taxonomy: string;
    parentId?: string;
    level?: number;
    keyword?: string;
    status?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<MetaCategoryNodeDto>> {
    return request.get(`${CATEGORY_BASE}/nodes`, { params });
  },

  getNodePath(id: string, taxonomy: string): Promise<MetaCategoryNodeDto[]> {
    return request.get(`${CATEGORY_BASE}/nodes/${encodeURIComponent(id)}/path`, {
      params: { taxonomy },
    });
  },

  search(params: {
    taxonomy: string;
    keyword: string;
    scopeNodeId?: string;
    maxDepth?: number;
    status?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<MetaCategorySearchItemDto>> {
    return request.get(`${CATEGORY_BASE}/search`, { params });
  },

  listChildrenBatch(data: MetaCategoryChildrenBatchRequestDto): Promise<Record<string, MetaCategoryNodeDto[]>> {
    return request.post(`${CATEGORY_BASE}/nodes:children-batch`, data);
  },

  getTaxonomy(code: string): Promise<MetaTaxonomyDto> {
    return request.get(`${TAXONOMY_BASE}/${encodeURIComponent(code)}`);
  }
};
