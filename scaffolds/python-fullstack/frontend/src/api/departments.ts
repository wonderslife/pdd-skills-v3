import client from './client'

export interface DepartmentOption {
  id: number
  name: string
  code: string
  level: number
  parent_id: number | null
}

export interface DepartmentResponse {
  id: number
  name: string
  code: string
  parent_id: number | null
  level: number
  path: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export const departmentApi = {
  getOptions: (params?: { level?: number; is_active?: boolean }) =>
    client.get<{ code: number; message: string; data: DepartmentOption[] }>('/departments/options', { params }),

  getList: (params?: { page?: number; page_size?: number; keyword?: string; level?: number }) =>
    client.get<{ code: number; message: string; data: { items: DepartmentResponse[]; total: number } }>('/departments', { params }),

  getDetail: (id: number) =>
    client.get<{ code: number; message: string; data: DepartmentResponse }>(`/departments/${id}`),
}
