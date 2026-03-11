import request from "./request";
import type {
  MetaDictionaryBatchRequestDto,
  MetaDictionaryBatchResponseDto,
  MetaDictionaryDto,
} from "@/models/dictionary";

const DICTIONARY_BASE = "/api/meta/dictionaries";
const DICTIONARY_SCENE_BASE = "/api/meta/dictionary-scenes";

export const dictionaryApi = {
  batch(data: MetaDictionaryBatchRequestDto): Promise<MetaDictionaryBatchResponseDto> {
    return request.post(`${DICTIONARY_BASE}:batch`, data);
  },

  getByCode(
    code: string,
    params?: { lang?: string; includeDisabled?: boolean },
  ): Promise<MetaDictionaryDto> {
    return request.get(`${DICTIONARY_BASE}/${encodeURIComponent(code)}`, { params });
  },

  getByScene(
    sceneCode: string,
    params?: { lang?: string; includeDisabled?: boolean },
  ): Promise<MetaDictionaryBatchResponseDto> {
    return request.get(`${DICTIONARY_SCENE_BASE}/${encodeURIComponent(sceneCode)}`, { params });
  },
};
