import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import type { CatalogItem, CatalogName } from '../types/domain'

export function useCatalog(name: CatalogName) {
  return useQuery({
    queryKey: ['catalog', name],
    queryFn: async () => (await api.get<CatalogItem[]>(`/api/catalogs/${name}`)).data,
    staleTime: 5 * 60 * 1000, // 5 min — los catálogos cambian poco
  })
}

export function useCreateCatalogItem(name: CatalogName) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; extra?: Record<string, unknown> }) =>
      (await api.post<CatalogItem>(`/api/catalogs/${name}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['catalog', name] })
    },
  })
}
