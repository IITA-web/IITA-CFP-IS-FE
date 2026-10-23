import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export type Status = 'new' | 'reviewing' | 'submitted' | 'won';
export interface Opportunity {
  id: string; title: string; source: string; url: string; published?: string | null; deadline?: string | null;
  budget?: string | null; consortium?: boolean | null; eligible_regions?: string | null; themes: string[];
  score: number; urgency: string; summary: string; status: Status; source_type: string; scan_date: string;
}
export interface OpportunityList { items: Opportunity[]; total: number; limit: number; offset: number }
export interface Summary { total: number; average_score: number; by_status: Record<Status, number>; top_sources: {source: string; count: number}[]; last_scan: {status: string; message: string; started_at?: string | null} }
export interface Scan { id: string | null; status: string; message: string; started_at?: string | null; finished_at?: string | null; new_count: number; digest_available?: boolean; dry_run?: boolean; scheduled?: boolean }
export interface SourceCatalog { sources: {name:string; type:string; url:string}[]; themes: string[]; threshold: number; high_priority_threshold: number }
export interface RobotsAudit { results: {name:string; url:string; allowed:boolean}[]; allowed:number; blocked:number }
export interface ScraperSettings { relevance_threshold:number; high_priority_threshold:number; email_mode:string; email_configured:boolean; bot_name:string; bot_version:string; crawl_delay_seconds:number; request_timeout_seconds:number; robots_cache_ttl_seconds:number }
export interface ScraperConfig { settings:{relevance_threshold:number;high_priority_threshold:number;crawl_delay_seconds:number;request_timeout_seconds:number;robots_cache_ttl_seconds:number;email_mode:string}; sources:{api:Record<string,unknown>[];rss:Record<string,unknown>[];web:Record<string,unknown>[]}; themes:Record<string,string[]>; africa_keywords:string[]; schedule:{enabled:boolean;time:string;send_email:boolean}; email:{from_addr:string;recipients:string[];smtp_host:string;smtp_port:number;credentials_configured:boolean} }
export interface Candidate { title:string; url?:string; source?:string; snippet?:string; source_type?:'rss'|'api'|'web'; published?:string|null; themes?:string[] }
export interface ScoredCandidate extends Omit<Candidate, 'themes'> { themes:string[]; score:number; deadline?:string|null; budget?:string|null; eligible_regions?:string|null; consortium?:boolean|null; urgency:string; summary:string; fingerprint:string }
const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
export const cfpApi = createApi({
  reducerPath: 'cfpApi', baseQuery: fetchBaseQuery({baseUrl, prepareHeaders: (headers) => { if (typeof window !== 'undefined') { const token = window.sessionStorage.getItem('iita-admin-token'); if (token) headers.set('Authorization', 'Bearer ' + token); } return headers; }, paramsSerializer: (params) => { const query = new URLSearchParams(); Object.entries(params).forEach(([key, value]) => { if (Array.isArray(value)) value.forEach((entry) => query.append(key, String(entry))); else if (value !== undefined && value !== null) query.append(key, String(value)); }); return query.toString(); }}),
  tagTypes: ['Opportunity', 'Summary', 'Scan', 'Settings', 'SourceCatalog'],
  endpoints: (builder) => ({
    verifyAdmin: builder.mutation<{authenticated:boolean},void>({query:()=>({url:'/admin/auth/verify',method:'POST'})}),
    getSources: builder.query<SourceCatalog, void>({query: () => '/sources', providesTags:['SourceCatalog']}),
    auditRobots: builder.mutation<RobotsAudit, void>({query: () => ({url:'/robots/audit', method:'POST'})}),
    getSettings: builder.query<ScraperSettings, void>({query: () => '/scraper/settings', providesTags:['Settings']}),
    getScraperConfig: builder.query<ScraperConfig, void>({query:()=>'/scraper/config',providesTags:['Settings']}),
    updateScraperConfig: builder.mutation<ScraperConfig,Record<string,unknown>>({query:(body)=>({url:'/scraper/config',method:'PATCH',body}),invalidatesTags:['Settings','SourceCatalog']}),
    updateSettings: builder.mutation<ScraperSettings, Partial<Pick<ScraperSettings,'relevance_threshold'|'high_priority_threshold'|'email_mode'>>>({query: (body) => ({url:'/scraper/settings',method:'PATCH',body}),invalidatesTags:['Settings','SourceCatalog']}),
    prefilter: builder.mutation<{matched:boolean;themes:string[]},{text:string}>({query:(body)=>({url:'/scraper/prefilter',method:'POST',body})}),
    scoreCandidate: builder.mutation<ScoredCandidate,Candidate>({query:(body)=>({url:'/scraper/score',method:'POST',body})}),
    getEmailConfig: builder.query<{mode:string;from:string;recipients:string[];smtp_host:string;smtp_port:number;graph_configured:boolean;smtp_configured:boolean},void>({query:()=>'/email/config'}),
    previewEmail: builder.mutation<string,{opportunity_ids:string[]}>({query:(body)=>({url:'/email/preview',method:'POST',body,responseHandler:'text'})}),
    previewLatestScanDigest: builder.mutation<string,void>({query:()=>({url:'/scans/latest/digest',method:'GET',responseHandler:'text'})}),
    sendDigest: builder.mutation<{status:string;subject:string;recipient_count:number;opportunity_count:number},{opportunity_ids:string[];dry_run?:boolean}>({query:(body)=>({url:'/email/send',method:'POST',body})}),
    getSeenRecords: builder.query<{items:Record<string,unknown>[];total:number;limit:number;offset:number},{limit?:number;offset?:number}>({query:(params)=>({url:'/scraper/seen',params})}),
    getOpportunities: builder.query<OpportunityList, {search?: string; status?: string; limit?: number}>(
      {query: (params) => ({url: '/opportunities', params}), providesTags: ['Opportunity']},
    ),
    getSummary: builder.query<Summary, void>({query: () => '/reports/summary', providesTags: ['Summary', 'Scan']}),
    updateStatus: builder.mutation<Opportunity, {id: string; status: Status}>({
      query: ({id, ...body}) => ({url: `/opportunities/${id}`, method: 'PATCH', body}), invalidatesTags: ['Opportunity', 'Summary'],
    }),
    startScan: builder.mutation<Scan, {sources: string; threshold?: number; source_names: string[]; themes: string[]; send_email?: boolean}>({
      query: (params) => ({url: '/scans', method: 'POST', params}), invalidatesTags: ['Scan', 'Opportunity', 'Summary'],
    }),
    getLatestScan: builder.query<Scan, void>({query: () => '/scans/latest', providesTags: ['Scan']}),
  }),
});
export const {useVerifyAdminMutation,useGetSourcesQuery,useAuditRobotsMutation,useGetSettingsQuery,useUpdateSettingsMutation,useGetScraperConfigQuery,useUpdateScraperConfigMutation,usePrefilterMutation,useScoreCandidateMutation,useGetEmailConfigQuery,usePreviewEmailMutation,usePreviewLatestScanDigestMutation,useSendDigestMutation,useGetSeenRecordsQuery,useGetOpportunitiesQuery,useGetSummaryQuery,useUpdateStatusMutation,useStartScanMutation,useGetLatestScanQuery} = cfpApi;
