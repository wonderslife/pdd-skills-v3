import client from './client'

export interface DictItemOption {
  id: number
  dict_type_id: number
  label: string
  value: string
}

export interface DictItemGrouped {
  code: string
  name: string
  items: DictItemOption[]
}

export interface DictTypeOption {
  id: number
  code: string
  name: string
}

export const dictItemApi = {
  getOptions: (params?: { dict_type?: string; is_active?: boolean }) =>
    client.get<{ code: number; message: string; data: DictItemOption[] }>('/dict-items/options', { params }),

  getGrouped: (params?: { is_active?: boolean }) =>
    client.get<{ code: number; message: string; data: DictItemGrouped[] }>('/dict-items/grouped', { params }),

  getTypes: () =>
    client.get<{ code: number; message: string; data: DictTypeOption[] }>('/dict-items/types'),
}
