/**
 * Legatura dintre pagini si API, prin TanStack Query.
 *
 * Fiecare "hook" (useProjects, useScan etc.) incarca datele, le tine minte (cache) si spune
 * paginii daca se incarca, daca a aparut o eroare sau daca datele sunt gata. Dupa o modificare
 * (proiect nou, scanare noua), listele afectate sunt reincarcate automat.
 *
 * O scanare in curs ("queued" sau "running") este reverificata periodic, pana se termina.
 * La fel un audit pe mai multe pagini, cat timp cauta paginile sau le scaneaza.
 * Profilul juridic (OUG 112/2018) al unui proiect se citeste si se salveaza tot de aici, la fel
 * si verificarea aspectului unei pagini (separata de accesibilitate) si verificarea manuala.
 */
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  auditListSchema,
  auditResultsSchema,
  auditSchema,
  legalProfileResponseSchema,
  legalProfileSchema,
  manualEvaluationSchema,
  pageCheckSchema,
  projectListSchema,
  projectSchema,
  ruleResultListSchema,
  scanLayoutSchema,
  scanManualChecksSchema,
  scanListSchema,
  scanSchema,
  type AuditList,
  type AuditStatus,
  type AuditSelectionInput,
  type CreateAuditInput,
  type CreateProjectInput,
  type CreateScanInput,
  type LegalProfileAnswers,
  type LegalProfileResponse,
  type ManualCheckId,
  type ManualEvaluationInput,
  type PageCheckInput,
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
  scanLayout: (id: string) => ['scans', id, 'layout'] as const,
  scanManualChecks: (id: string) => ['scans', id, 'manual-checks'] as const,
  projectAudits: (id: string) => ['projects', id, 'audits'] as const,
  audit: (id: string) => ['audits', id] as const,
  auditResults: (id: string) => ['audits', id, 'results'] as const,
};

/** Starile in care un audit inca lucreaza (pagina se actualizeaza singura). */
const AUDIT_ACTIVE: AuditStatus[] = ['discovery_queued', 'discovering', 'scanning'];

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

/** Verificarea aspectului paginii: latimile verificate, breakpoint-urile si semnalele. */
export function useScanLayout(scanId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.scanLayout(scanId),
    queryFn: ({ signal }) =>
      apiRequest(`/api/v1/scans/${encodeURIComponent(scanId)}/layout`, scanLayoutSchema, {
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

/** Auditurile pe mai multe pagini ale unui proiect. */
export function useProjectAudits(projectId: string) {
  return useQuery({
    queryKey: queryKeys.projectAudits(projectId),
    queryFn: ({ signal }) =>
      apiRequest(`/api/v1/projects/${encodeURIComponent(projectId)}/audits`, auditListSchema, {
        signal,
      }),
    refetchInterval: (query) =>
      query.state.data?.items.some((a) => AUDIT_ACTIVE.includes(a.status))
        ? SCAN_POLL_INTERVAL_MS
        : false,
  });
}

export function useCreateAudit(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAuditInput) =>
      apiRequest(`/api/v1/projects/${encodeURIComponent(projectId)}/audits`, auditSchema, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projectAudits(projectId) }),
  });
}

/**
 * Un audit; reverificat periodic cat timp cauta paginile sau le scaneaza. La fiecare raspuns,
 * randul lui din istoricul proiectului e actualizat, ca la revenire sa nu arate starea veche.
 */
export function useAudit(auditId: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.audit(auditId),
    queryFn: ({ signal }) =>
      apiRequest(`/api/v1/audits/${encodeURIComponent(auditId)}`, auditSchema, { signal }),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && AUDIT_ACTIVE.includes(status) ? SCAN_POLL_INTERVAL_MS : false;
    },
  });
  // Randul auditului din istoricul proiectului primeste imediat starea noua
  const audit = query.data;
  useEffect(() => {
    if (!audit) return;
    queryClient.setQueryData<AuditList>(queryKeys.projectAudits(audit.projectId), (old) =>
      old
        ? {
            items: old.items.map((item) =>
              item.id === audit.id
                ? {
                    ...item,
                    status: audit.status,
                    pagesFound: audit.discovery?.pages.length ?? null,
                    progress: audit.progress,
                  }
                : item,
            ),
          }
        : old,
    );
  }, [queryClient, audit]);
  return query;
}

/** Confirma paginile alese; raspunsul e auditul actualizat (paginile intra in coada). */
export function useSelectAuditPages(auditId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AuditSelectionInput) =>
      apiRequest(`/api/v1/audits/${encodeURIComponent(auditId)}/selection`, auditSchema, {
        method: 'POST',
        body: input,
      }),
    onSuccess: (audit) => {
      queryClient.setQueryData(queryKeys.audit(auditId), audit);
      return queryClient.invalidateQueries({
        queryKey: queryKeys.projectAudits(audit.projectId),
      });
    },
  });
}

/**
 * Auditul din care face parte o scanare (pentru titlul paginii), doar daca face parte dintr-unul.
 * Aceeasi cheie ca `useAudit`, deci datele deja incarcate de pagina auditului sunt refolosite.
 */
export function useAuditOfScan(auditId: string | null) {
  return useQuery({
    queryKey: queryKeys.audit(auditId ?? ''),
    queryFn: ({ signal }) =>
      apiRequest(`/api/v1/audits/${encodeURIComponent(auditId!)}`, auditSchema, { signal }),
    enabled: auditId !== null,
  });
}

/** Verifica o pagina adaugata manual (exista, e pagina web, e pe site) inainte de a o adauga. */
export function useCheckAuditPage(auditId: string) {
  return useMutation({
    mutationFn: (input: PageCheckInput) =>
      apiRequest(`/api/v1/audits/${encodeURIComponent(auditId)}/page-check`, pageCheckSchema, {
        method: 'POST',
        body: input,
      }),
  });
}

export function useAuditResults(auditId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.auditResults(auditId),
    queryFn: ({ signal }) =>
      apiRequest(`/api/v1/audits/${encodeURIComponent(auditId)}/results`, auditResultsSchema, {
        signal,
      }),
    enabled,
  });
}

/** Verificarea manuala a unei pagini: cele 6 verificari si starea lor. */
export function useManualChecks(scanId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.scanManualChecks(scanId),
    queryFn: ({ signal }) =>
      apiRequest(
        `/api/v1/scans/${encodeURIComponent(scanId)}/manual-checks`,
        scanManualChecksSchema,
        { signal },
      ),
    enabled,
  });
}

/**
 * Salveaza (sau, cu `input: null`, sterge) rezultatul unei verificari manuale. Dupa salvare se
 * reincarca verificarile paginii, scanarea (progresul) si auditurile (progresul pe pagini).
 */
export function useSaveManualCheck(scanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      checkId,
      input,
    }: {
      checkId: ManualCheckId;
      input: ManualEvaluationInput | null;
    }) => {
      const path = `/api/v1/scans/${encodeURIComponent(scanId)}/manual-checks/${checkId}`;
      return input
        ? apiRequest(path, manualEvaluationSchema, { method: 'PUT', body: input })
        : apiRequest(path, z.null(), { method: 'DELETE' });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.scan(scanId) });
      await queryClient.invalidateQueries({ queryKey: ['audits'] });
    },
  });
}
