/**
 * Legatura dintre pagini si API, prin TanStack Query.
 *
 * Fiecare "hook" (useProjects, useScan etc.) incarca datele, le tine minte (cache) si spune
 * paginii daca se incarca, daca a aparut o eroare sau daca datele sunt gata. Dupa o modificare
 * (proiect nou, scanare noua), listele afectate sunt reincarcate automat.
 *
 * O scanare in curs ("queued" sau "running") este reverificata periodic, pana se termina.
 * Profilul juridic (OUG 112/2018) al unui proiect se citeste si se salveaza tot de aici.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  legalProfileResponseSchema,
  legalProfileSchema,
  projectListSchema,
  projectSchema,
  ruleResultListSchema,
  scanListSchema,
  scanSchema,
  type CreateProjectInput,
  type CreateScanInput,
  type LegalProfileAnswers,
  type LegalProfileResponse,
} from '@ro-a11y/shared';
import { apiRequest } from './client';

/** Cat de des (milisecunde) reverificam o scanare care inca ruleaza. */
export const SCAN_POLL_INTERVAL_MS = 1500;

export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  projectScans: (id: string) => ['projects', id, 'scans'] as const,
  legalProfile: (id: string) => ['projects', id, 'legal-profile'] as const,
  scan: (id: string) => ['scans', id] as const,
  scanResults: (id: string) => ['scans', id, 'results'] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ signal }) => apiRequest('/api/v1/projects', projectListSchema, { signal }),
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: ({ signal }) =>
      apiRequest(`/api/v1/projects/${encodeURIComponent(projectId)}`, projectSchema, { signal }),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiRequest('/api/v1/projects', projectSchema, { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useProjectScans(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectScans(projectId),
    queryFn: ({ signal }) =>
      apiRequest(`/api/v1/projects/${encodeURIComponent(projectId)}/scans`, scanListSchema, {
        signal,
      }),
    // Daca exista scanari in curs, lista se actualizeaza singura pana se termina.
    refetchInterval: (query) =>
      query.state.data?.items.some((s) => s.status === 'queued' || s.status === 'running')
        ? SCAN_POLL_INTERVAL_MS
        : false,
  });
}

export function useCreateScan(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateScanInput) =>
      apiRequest(`/api/v1/projects/${encodeURIComponent(projectId)}/scans`, scanSchema, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projectScans(projectId) }),
  });
}

export function useScan(scanId: string) {
  return useQuery({
    queryKey: queryKeys.scan(scanId),
    queryFn: ({ signal }) =>
      apiRequest(`/api/v1/scans/${encodeURIComponent(scanId)}`, scanSchema, { signal }),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'running' ? SCAN_POLL_INTERVAL_MS : false;
    },
  });
}

export function useScanResults(scanId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.scanResults(scanId),
    queryFn: ({ signal }) =>
      apiRequest(`/api/v1/scans/${encodeURIComponent(scanId)}/results`, ruleResultListSchema, {
        signal,
      }),
    enabled,
  });
}

/** Intrebarile chestionarului OUG 112/2018 si profilul juridic salvat al proiectului (sau null). */
export function useLegalProfile(projectId: string) {
  return useQuery({
    queryKey: queryKeys.legalProfile(projectId),
    queryFn: ({ signal }) =>
      apiRequest(
        `/api/v1/projects/${encodeURIComponent(projectId)}/legal-profile`,
        legalProfileResponseSchema,
        { signal },
      ),
  });
}

/**
 * Salveaza raspunsurile si primeste evaluarea. Dupa salvare, rezultatele scanarilor sunt
 * reincarcate, pentru ca pasul "Aplicabilitate" din lantul de trasabilitate se schimba.
 */
export function useSaveLegalProfile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers: LegalProfileAnswers) =>
      apiRequest(
        `/api/v1/projects/${encodeURIComponent(projectId)}/legal-profile`,
        legalProfileSchema,
        { method: 'PUT', body: answers },
      ),
    onSuccess: (profile) => {
      queryClient.setQueryData<LegalProfileResponse>(queryKeys.legalProfile(projectId), (old) =>
        old ? { ...old, profile } : old,
      );
      return queryClient.invalidateQueries({ queryKey: ['scans'] });
    },
  });
}
