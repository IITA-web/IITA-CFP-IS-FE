'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  useGetSourcesQuery, useGetOpportunitiesQuery, useGetSummaryQuery, useUpdateStatusMutation,
  useStartScanMutation, useGetLatestScanQuery, useAuditRobotsMutation, useGetSettingsQuery, useUpdateSettingsMutation, usePrefilterMutation, useScoreCandidateMutation, usePreviewEmailMutation, usePreviewLatestScanDigestMutation, useSendDigestMutation, useGetSeenRecordsQuery, useGetScraperConfigQuery, useUpdateScraperConfigMutation, useVerifyAdminMutation, type Opportunity, type Status,
} from '@/lib/api';

const THEMES = [
  'Crop Improvement & Breeding', 'Agronomy & Soil Health', 'Food Systems & Nutrition',
  'Climate Adaptation & Resilience', 'Pest, Disease & Weed Management',
  'Gender, Youth & Policy', 'Digital Agriculture & Data',
];
const COLORS = ['#D4501A', '#1a7a2e', '#1a4080', '#b45309', '#6b21a8', '#0d6e75', '#be185d'];
const SOURCES = [
  {name:'USAID Grants', crawler:'USAID', type:'WEB'},
  {name:'Gates Foundation', crawler:'Gates Foundation', type:'WEB'},
  {name:'EU Horizon Africa', crawler:'EU Funding & Tenders Portal', type:'API'},
  {name:'African Dev Bank', crawler:'African Dev Bank', type:'WEB'},
  {name:'UK FCDO Research', crawler:'UK FCDO', type:'WEB'},
  {name:'CGIAR', crawler:'CGIAR', type:'RSS'},
  {name:'FAO Funding', crawler:'FAO Funding', type:'RSS'},
  {name:'Wellcome Trust', crawler:'Wellcome Trust', type:'WEB'},
  {name:'World Bank Grants', crawler:'World Bank', type:'WEB'},
  {name:'AGRA', crawler:'AGRA', type:'WEB'},
  {name:'IFAD', crawler:'IFAD', type:'RSS'},
  {name:'Bioversity Intl', crawler:'Bioversity International', type:'RSS'},
  {name:'Grants.gov', crawler:'Grants.gov (US Federal)', type:'API'},
  {name:'RUFORUM', crawler:'RUFORUM', type:'RSS'},
];
const STATUSES: Status[] = ['new', 'reviewing', 'submitted', 'won'];
const STATUS_LABEL: Record<Status, string> = {new:'New', reviewing:'Under Review', submitted:'Submitted', won:'Won'};
type SourceOption = {name:string; type:string; url?:string; crawler:string};
const blankSelection = () => Object.fromEntries(SOURCES.map(source => [source.name, true]));
const monthKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}`;
};
const escCsv = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export default function Home() {
  const [view, setView] = useState<'dash'|'scanner'|'reports'>('dash');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [quick, setQuick] = useState('all');
  const [search, setSearch] = useState('');
  const [themeFilter, setThemeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('score');
  const [selectedSources, setSelectedSources] = useState<Record<string, boolean>>(blankSelection);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(THEMES);
  const [activeOpportunity, setActiveOpportunity] = useState<Opportunity|null>(null);
  const [period, setPeriod] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [scanError, setScanError] = useState('');
  const [threshold, setThreshold] = useState(60);
  const [highThreshold, setHighThreshold] = useState(80);
  const [emailMode, setEmailMode] = useState('smtp');
  const [crawlDelay, setCrawlDelay] = useState(2.5);
  const [requestTimeout, setRequestTimeout] = useState(18);
  const [robotsCacheTtl, setRobotsCacheTtl] = useState(3600);
  const [themesJson, setThemesJson] = useState('{}');
  const [africaKeywordsJson, setAfricaKeywordsJson] = useState('[]');
  const [apiSourcesJson, setApiSourcesJson] = useState('[]');
  const [rssSourcesJson, setRssSourcesJson] = useState('[]');
  const [webSourcesJson, setWebSourcesJson] = useState('[]');
  const [adminToken, setAdminToken] = useState('');
  const [adminAuthorized, setAdminAuthorized] = useState(false);
  const [adminAuthMessage, setAdminAuthMessage] = useState('');
  const [emailFrom, setEmailFrom] = useState('');
  const [emailRecipients, setEmailRecipients] = useState('');
  const [smtpHost, setSmtpHost] = useState('smtp.office365.com');
  const [smtpPort, setSmtpPort] = useState(587);
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleTime, setScheduleTime] = useState('07:00');
  const [scheduleSendEmail, setScheduleSendEmail] = useState(false);
  const [sendEmailOnScan, setSendEmailOnScan] = useState(false);
  const [prefilterText, setPrefilterText] = useState('');
  const [prefilterResult, setPrefilterResult] = useState<{matched:boolean;themes:string[]}|null>(null);
  const [scoreTitle, setScoreTitle] = useState('');
  const [scoreSnippet, setScoreSnippet] = useState('');
  const [scoredCandidate, setScoredCandidate] = useState<{score:number;summary:string;themes:string[];deadline?:string|null;budget?:string|null}|null>(null);
  const [toolMessage, setToolMessage] = useState('');
  const [robotAudit, setRobotAudit] = useState<{results:{name:string;url:string;allowed:boolean}[];allowed:number;blocked:number}|null>(null);
  const {data: sourceCatalog} = useGetSourcesQuery();
  const {data: scraperSettings} = useGetSettingsQuery();
  const {data: scraperConfig} = useGetScraperConfigQuery();
  const {data: seenHistory} = useGetSeenRecordsQuery({limit:1});
  const sourceList: SourceOption[] = useMemo(() => {
    if (!sourceCatalog) return SOURCES;
    const labels: Record<string,string> = {'USAID':'USAID Grants','EU Funding & Tenders Portal':'EU Horizon Africa','UK FCDO':'UK FCDO Research','World Bank':'World Bank Grants','Bioversity International':'Bioversity Intl','Grants.gov (US Federal)':'Grants.gov'};
    return sourceCatalog.sources.map(source => ({...source, name:labels[source.name] || source.name, crawler:source.name}));
  }, [sourceCatalog]);
  const themeList = sourceCatalog?.themes ?? THEMES;
  useEffect(() => { if (scraperSettings) { setThreshold(scraperSettings.relevance_threshold); setHighThreshold(scraperSettings.high_priority_threshold); setEmailMode(scraperSettings.email_mode); } }, [scraperSettings?.relevance_threshold, scraperSettings?.high_priority_threshold, scraperSettings?.email_mode]);
  useEffect(() => { if (scraperConfig) { setCrawlDelay(scraperConfig.settings.crawl_delay_seconds); setRequestTimeout(scraperConfig.settings.request_timeout_seconds); setRobotsCacheTtl(scraperConfig.settings.robots_cache_ttl_seconds); setThemesJson(JSON.stringify(scraperConfig.themes,null,2)); setAfricaKeywordsJson(JSON.stringify(scraperConfig.africa_keywords,null,2)); setApiSourcesJson(JSON.stringify(scraperConfig.sources.api,null,2)); setRssSourcesJson(JSON.stringify(scraperConfig.sources.rss,null,2)); setWebSourcesJson(JSON.stringify(scraperConfig.sources.web,null,2)); setEmailFrom(scraperConfig.email.from_addr); setEmailRecipients(scraperConfig.email.recipients.join(', ')); setSmtpHost(scraperConfig.email.smtp_host); setSmtpPort(scraperConfig.email.smtp_port); setScheduleEnabled(scraperConfig.schedule.enabled); setScheduleTime(scraperConfig.schedule.time); setScheduleSendEmail(scraperConfig.schedule.send_email); } }, [scraperConfig]);
  const query = useMemo(() => ({limit:500}), []);
  const {data: list, isLoading, error, refetch: refetchOpportunities} = useGetOpportunitiesQuery(query);
  const {data: summary, refetch: refetchSummary} = useGetSummaryQuery();
  const {data: scan} = useGetLatestScanQuery(undefined, {pollingInterval:3000});
  const [updateStatus] = useUpdateStatusMutation();
  const [startScan, scanRequest] = useStartScanMutation();
  const [auditRobots, auditRequest] = useAuditRobotsMutation();
  const [updateSettings] = useUpdateSettingsMutation();
  const [updateScraperConfig, configRequest] = useUpdateScraperConfigMutation();
  const [verifyAdmin, authRequest] = useVerifyAdminMutation();
  const [prefilter, prefilterRequest] = usePrefilterMutation();
  const [scoreCandidate, scoreRequest] = useScoreCandidateMutation();
  const [previewEmail, previewRequest] = usePreviewEmailMutation();
  const [previewLatestScanDigest, latestDigestRequest] = usePreviewLatestScanDigestMutation();
  const [sendDigest, sendEmailRequest] = useSendDigestMutation();
  const opportunities = list?.items ?? [];
  const isScanning = scan?.status === 'running' || scanRequest.isLoading;

  useEffect(() => {
    if (scan?.status === 'completed') { refetchSummary(); refetchOpportunities(); }
  }, [scan?.id, scan?.status, refetchSummary, refetchOpportunities]);

  const filtered = useMemo(() => {
    let rows = opportunities.filter(item => {
      if (quick === 'urgent' && item.score < 80) return false;
      if (quick === 'reviewing' && item.status !== 'reviewing') return false;
      if (quick === 'submitted' && item.status !== 'submitted') return false;
      if (search && !`${item.title} ${item.source} ${item.summary}`.toLowerCase().includes(search.toLowerCase())) return false;
      if (themeFilter && !item.themes.includes(themeFilter)) return false;
      if (statusFilter && item.status !== statusFilter) return false;
      return true;
    });
    rows = [...rows].sort(sort === 'source'
      ? (a,b) => a.source.localeCompare(b.source)
      : (a,b) => b.score-a.score);
    return rows;
  }, [opportunities, quick, search, themeFilter, statusFilter, sort]);

  const reportData = useMemo(() => {
    let from: Date;
    let to = new Date();
    if (period === 0) {
      from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date('2020-01-01');
      to = dateTo ? new Date(`${dateTo}T23:59:59`) : new Date();
    } else {
      from = new Date(); from.setMonth(from.getMonth()-period);
    }
    return opportunities.filter(item => {
      const date = new Date(item.scan_date || item.published || new Date().toISOString());
      return date >= from && date <= to;
    });
  }, [opportunities, period, dateFrom, dateTo]);

  function navigate(next: 'dash'|'scanner'|'reports') {
    setView(next); setMobileOpen(false);
  }
  function quickFilter(value: string) {
    setQuick(value); setStatusFilter(''); navigate('dash');
  }
  function changeStatus(item: Opportunity, value: Status) {
    setActiveOpportunity(current => current?.id === item.id ? {...current, status:value} : current);
    updateStatus({id:item.id, status:value});
  }
  async function checkRobots() {
    setScanError('');
    try {
      const result = await auditRobots().unwrap();
      setRobotAudit(result); setScanError(`Robots audit complete: ${result.allowed} allowed, ${result.blocked} blocked.`);
    } catch {
      setRobotAudit(null); setScanError('The robots.txt audit failed. Check the backend logs and network access.');
    }
  }
  async function runScan() {
    const chosen = sourceList.filter(source => selectedSources[source.name]);
    if (!chosen.length) { setScanError('Select at least one donor source.'); return; }
    if (!selectedThemes.length) { setScanError('Select at least one research theme.'); return; }
    if (sendEmailOnScan && !adminAuthorized) { setScanError('Unlock admin settings before enabling email delivery.'); return; }
    const types = new Set(chosen.map(source => source.type === 'WEB' ? 'web' : 'rss'));
    const sourceMode = types.size > 1 ? 'all' : [...types][0];
    setScanError('');
    try {
      await startScan({sources:sourceMode, threshold, source_names:chosen.map(source => source.crawler), themes:selectedThemes, send_email:sendEmailOnScan}).unwrap();
    } catch (reason) {
      setScanError(reason instanceof Error ? reason.message : 'Could not start the scan. Check the API connection.');
    }
  }
  async function unlockAdmin() {
    setAdminAuthMessage('');
    if (!adminToken.trim()) { setAdminAuthMessage('Enter the IITA_CFP_ADMIN_TOKEN configured in backend/.env.'); return; }
    window.sessionStorage.setItem('iita-admin-token',adminToken.trim());
    try { await verifyAdmin().unwrap(); setAdminAuthorized(true); setAdminAuthMessage('Admin settings unlocked for this browser session.'); }
    catch { window.sessionStorage.removeItem('iita-admin-token'); setAdminAuthorized(false); setAdminAuthMessage('Admin token was rejected or backend admin access is not configured.'); }
  }
  function lockAdmin() {
    window.sessionStorage.removeItem('iita-admin-token'); setAdminToken(''); setAdminAuthorized(false); setSendEmailOnScan(false); setAdminAuthMessage('Admin settings locked.');
  }
  async function saveAdvancedConfig() {
    setToolMessage('');
    try {
      const themes = JSON.parse(themesJson) as Record<string,string[]>;
      const africa_keywords = JSON.parse(africaKeywordsJson) as string[];
      const sources = {api:JSON.parse(apiSourcesJson) as Record<string,unknown>[],rss:JSON.parse(rssSourcesJson) as Record<string,unknown>[],web:JSON.parse(webSourcesJson) as Record<string,unknown>[]};
      const email = {from_addr:emailFrom,to_addrs:emailRecipients.split(',').map(value=>value.trim()).filter(Boolean),smtp_host:smtpHost,smtp_port:smtpPort,username:emailFrom};
      await updateScraperConfig({settings:{relevance_threshold:threshold,high_priority_threshold:highThreshold,crawl_delay_seconds:crawlDelay,request_timeout_seconds:requestTimeout,robots_cache_ttl_seconds:robotsCacheTtl,email_mode:emailMode},themes,africa_keywords,sources,email,schedule:{enabled:scheduleEnabled,time:scheduleTime,send_email:scheduleSendEmail}}).unwrap();
      setSelectedThemes(Object.keys(themes)); setToolMessage('Scraper configuration saved and will apply to future scans.');
    } catch { setToolMessage('Configuration was not saved. Check the JSON fields, URLs, source schemas, and email addresses.'); }
  }
  async function runPrefilter() {
    setToolMessage('');
    try { setPrefilterResult(await prefilter({text:prefilterText}).unwrap()); }
    catch { setToolMessage('Keyword prefilter failed.'); }
  }
  async function runCandidateScore() {
    setToolMessage('');
    try {
      const result = await scoreCandidate({title:scoreTitle,snippet:scoreSnippet,source:'Manual entry',source_type:'web'}).unwrap();
      setScoredCandidate(result);
    } catch { setToolMessage('Scoring failed. Check the backend and ANTHROPIC_API_KEY.'); }
  }
  async function saveThreshold() {
    try { await updateSettings({relevance_threshold:threshold,high_priority_threshold:highThreshold,email_mode:emailMode}).unwrap(); setToolMessage('Scraper settings saved for this backend process.'); }
    catch { setToolMessage('Could not save the threshold.'); }
  }
  async function previewDigest() {
    if (!opportunities.length) { setToolMessage('There are no saved opportunities to include.'); return; }
    try {
      const html = await previewEmail({opportunity_ids:opportunities.map(item=>item.id)}).unwrap();
      const preview = window.open('', '_blank');
      if (preview) { preview.document.write(html); preview.document.close(); }
      setToolMessage(preview ? 'Digest preview opened.' : 'Allow pop-ups to view the digest.');
    } catch { setToolMessage('Could not create the digest preview.'); }
  }
  async function previewLatestDigest() {
    const preview = window.open('', '_blank');
    try {
      const html = await previewLatestScanDigest().unwrap();
      if (preview) { preview.document.write(html); preview.document.close(); }
      else setToolMessage('Allow pop-ups to view the latest scan digest.');
    } catch {
      preview?.close();
      setToolMessage('Could not load the latest scan digest. Unlock admin settings and make sure the scan completed with matches.');
    }
  }
  async function emailDigest() {
    if (!opportunities.length) { setToolMessage('There are no saved opportunities to send.'); return; }
    if (!window.confirm(`Send a digest of ${opportunities.length} saved opportunities to the configured IITA recipients?`)) return;
    try {
      const result = await sendDigest({opportunity_ids:opportunities.map(item=>item.id)}).unwrap();
      setToolMessage(`Digest sent: ${result.subject}`);
    } catch { setToolMessage('Email delivery failed. Check configured Microsoft 365 credentials.'); }
  }
  function exportCsv() {
    const columns = ['Title','Donor','Themes','Budget','Deadline','Score','Status','Source Type','Region','Scan Date'];
    const rows = reportData.map(item => [item.title,item.source,item.themes.join('; '),item.budget,item.deadline,item.score,item.status,item.source_type,item.eligible_regions,item.scan_date]);
    const csv = [columns,...rows].map(row => row.map(escCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href=url; link.download=`IITA_CFP_Report_${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }

  const urgent = opportunities.filter(item => item.score >= 80).length;
  const submitted = opportunities.filter(item => item.status === 'submitted').length;
  const title = {dash:'Dashboard', scanner:'Run Scanner', reports:'Reports'}[view];
  const periodLabel = period === 0 ? 'custom period' : `last ${period} month${period===1?'':'s'}`;
  const avg = reportData.length ? Math.round(reportData.reduce((sum,item)=>sum+item.score,0)/reportData.length) : 0;
  const donors = [...new Set(reportData.map(item=>item.source))];
  const months = Array.from({length:period || 6}, (_,index) => {
    const date=new Date(); date.setMonth(date.getMonth()-(period || 6)+index+1);
    return {key:monthKey(date.toISOString()), label:date.toLocaleDateString('en-GB',{month:'short'})};
  });
  const monthCounts = months.map(month=>reportData.filter(item=>monthKey(item.scan_date)===month.key).length);
  const maxMonth = Math.max(1,...monthCounts);
  const scoreBands = [{label:'90-100',low:90,high:100,color:'#8B2E08'},{label:'80-89',low:80,high:89,color:'#D4501A'},{label:'70-79',low:70,high:79,color:'#1a7a2e'},{label:'60-69',low:60,high:69,color:'#b45309'},{label:'0-59',low:0,high:59,color:'#e0d9d1'}];
  const scoreCounts = scoreBands.map(band=>reportData.filter(item=>item.score>=band.low&&item.score<=band.high).length);
  const maxScore=Math.max(1,...scoreCounts);
  const donorCounts=donors.map(name=>({name,count:reportData.filter(item=>item.source===name).length})).sort((a,b)=>b.count-a.count).slice(0,8);
  const maxDonor=Math.max(1,...donorCounts.map(item=>item.count));
  const themeCounts=themeList.map(theme=>reportData.filter(item=>item.themes.includes(theme)).length);
  const maxTheme=Math.max(1,...themeCounts);
  const stages=[{label:'Detected',key:null,color:'#D4501A',count:reportData.length},{label:'New',key:'new',color:'#b45309',count:reportData.filter(i=>i.status==='new').length},{label:'Under Review',key:'reviewing',color:'#1a4080',count:reportData.filter(i=>i.status==='reviewing').length},{label:'Submitted',key:'submitted',color:'#1a7a2e',count:reportData.filter(i=>i.status==='submitted').length},{label:'Won',key:'won',color:'#14532d',count:reportData.filter(i=>i.status==='won').length}];
  const lastScan = scan?.started_at ? new Date(scan.started_at).toLocaleString() : 'No scan yet';

  return <>
    <div className={`sidebar-overlay ${mobileOpen?'open':''}`} onClick={()=>setMobileOpen(false)} />
    <div className="shell">
      <aside className={`sidebar ${mobileOpen?'open':''}`} id="sidebar">
        <div className="brand"><Image src="/IITA_Logo.png" alt="IITA" className="brand-logo" width={120} height={44} priority/><div className="brand-sub">CFP Intelligence System · PDAU</div></div>
        <nav className="nav">
          <div className="nav-label">Main</div>
          <button className={`nav-item ${view==='dash'?'active':''}`} onClick={()=>navigate('dash')}><span className="nav-ico">▦</span> Dashboard{opportunities.length>0&&<span className="nav-badge">{opportunities.length}</span>}</button>
          <button className={`nav-item ${view==='scanner'?'active':''}`} onClick={()=>navigate('scanner')}><span className="nav-ico">◉</span> Run Scanner</button>
          <button className={`nav-item ${view==='reports'?'active':''}`} onClick={()=>navigate('reports')}><span className="nav-ico">▥</span> Reports</button>
          <div className="nav-label nav-filter-label">Filter</div>
          <button className="nav-item" onClick={()=>quickFilter('urgent')}><span className="nav-ico">!</span> High Priority{urgent>0&&<span className="nav-badge">{urgent}</span>}</button>
          <button className="nav-item" onClick={()=>quickFilter('reviewing')}><span className="nav-ico">◷</span> Under Review</button>
          <button className="nav-item" onClick={()=>quickFilter('submitted')}><span className="nav-ico">↗</span> Submitted</button>
          <button className="nav-item" onClick={()=>quickFilter('all')}><span className="nav-ico">☷</span> All Opportunities</button>
        </nav>
        <div className="sidebar-foot"><p>PDAU · IITA Ibadan, Nigeria</p><p>{lastScan}</p><div className="m365-badge">Microsoft 365</div></div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-toggle" aria-label="Open navigation" onClick={()=>setMobileOpen(true)}><span/><span/><span/></button>
          <Image src="/IITA_Logo.png" alt="IITA" className="topbar-logo" width={85} height={36}/>
          <div className="page-title">{title}</div>
          <div className="topbar-right"><span className="last-run">{scan?.started_at?`Last scan: ${new Date(scan.started_at).toLocaleTimeString()}`:'No scan yet'}</span><button className="btn btn-ghost btn-sm hide-mobile" onClick={()=>navigate('reports')}>Reports</button><button className="btn btn-primary btn-sm" onClick={()=>navigate('scanner')}>Scan</button></div>
        </header>

        <main className="content">
          {view==='dash'&&<section>
            <div className="stats">
              <div className="stat"><div className="stat-label">High Priority</div><div className="stat-val">{urgent}</div><div className="stat-sub">Score &gt;= 80</div></div>
              <div className="stat"><div className="stat-label">Total Found</div><div className="stat-val">{list?.total ?? 0}</div><div className="stat-sub">In your database</div></div>
              <div className="stat s-green"><div className="stat-label">Submitted</div><div className="stat-val">{submitted}</div><div className="stat-sub">Proposals</div></div>
              <div className="stat s-dark"><div className="stat-label">Sources</div><div className="stat-val">{sourceList.length}</div><div className="stat-sub">Monitored portals</div></div>
            </div>
            <div className="toolbar">
              <div className="search-wrap"><span className="search-ico">⌕</span><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search opportunities..." aria-label="Search opportunities"/></div>
              <select className="filt" value={themeFilter} onChange={event=>setThemeFilter(event.target.value)}><option value="">All themes</option>{themeList.map(theme=><option key={theme}>{theme}</option>)}</select>
              <select className="filt" value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="">All statuses</option>{STATUSES.map(status=><option key={status} value={status}>{STATUS_LABEL[status]}</option>)}</select>
              <select className="filt" value={sort} onChange={event=>setSort(event.target.value)}><option value="score">Relevance</option><option value="source">Source</option></select>
            </div>
            {error&&<div className="empty"><h3>Could not load opportunities</h3><p>Check that the FastAPI backend is running.</p></div>}
            {isLoading?<div className="empty">Loading opportunities...</div>:<div className="cfp-list">
              {filtered.map(item=><article key={item.id} className={`cfp-card ${item.score>=80?'p-urgent':item.score>=70?'p-high':'p-medium'}`} onClick={()=>setActiveOpportunity(item)}>
                <div className="card-top"><div className="card-title">{item.title}</div><div className={`score-pill ${item.score>=80?'sp-urgent':item.score>=70?'sp-high':'sp-medium'}`}>{item.score}/100</div></div>
                <div className="card-meta"><span>{item.source}</span>{item.deadline&&<span>Deadline: <strong>{item.deadline}</strong></span>}{item.budget&&<span>{item.budget}</span>}{item.eligible_regions&&<span>{item.eligible_regions}</span>}</div>
                <p className="card-summary">{item.summary}</p><div className="tags">{item.themes.slice(0,3).map(tag=><span className="tag" key={tag}>{tag}</span>)}</div>
                <div className="card-foot"><span className={`status-pill st-${item.status}`}>{STATUS_LABEL[item.status]}</span><div className="card-actions" onClick={event=>event.stopPropagation()}><select className="filt card-status" value={item.status} onChange={event=>changeStatus(item,event.target.value as Status)} aria-label={`Status for ${item.title}`}>{STATUSES.map(status=><option value={status} key={status}>{STATUS_LABEL[status]}</option>)}</select>{item.url&&<a href={item.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Open</a>}</div></div>
              </article>)}
              {!filtered.length&&<div className="empty"><div className="empty-ico">{opportunities.length?'⌕':'+'}</div><h3>{opportunities.length?'No matches':'No opportunities yet'}</h3><p>{opportunities.length?'Adjust your filters':'Run a scan to detect calls for proposals'}</p>{!opportunities.length&&<button className="btn btn-primary" style={{marginTop:16}} onClick={()=>navigate('scanner')}>Run First Scan</button>}</div>}
            </div>}
          </section>}

          {view==='scanner'&&<section className="scanner-wrap">
            <div className="panel"><div className="panel-head"><div className="panel-icon">◉</div><div><div className="panel-title">CFP Intelligence Scanner</div><div className="panel-desc">Donor portals · IITA research themes · robots.txt compliant</div></div></div>
              <div className="sources-grid">{sourceList.map(source=><label className="src-item" key={source.name}><input className="src-check" type="checkbox" checked={!!selectedSources[source.name]} onChange={event=>setSelectedSources(current=>({...current,[source.name]:event.target.checked}))}/><div><div className="src-name">{source.name}</div><div className="src-type">{source.type}</div>{source.url&&<a className="src-url" href={source.url} target="_blank" rel="noreferrer" onClick={event=>event.stopPropagation()}>Source website</a>}</div></label>)}</div>
              <div className="kw-section"><div className="kw-label">Scan and alert settings</div><div className="scan-actions"><label>Relevance {threshold}<input aria-label="Relevance threshold" type="range" min="0" max="100" value={threshold} onChange={event=>setThreshold(Number(event.target.value))}/></label><label>High priority {highThreshold}<input aria-label="High priority threshold" type="range" min="0" max="100" value={highThreshold} onChange={event=>setHighThreshold(Number(event.target.value))}/></label><label>Email mode<select value={emailMode} onChange={event=>setEmailMode(event.target.value)}><option value="smtp">SMTP</option><option value="apppassword">App password</option><option value="graph">Microsoft Graph</option></select></label><button className="btn btn-ghost btn-sm" disabled={!adminAuthorized} onClick={saveThreshold}>{adminAuthorized?'Save settings':'Admin unlock required'}</button><label><input type="checkbox" checked={sendEmailOnScan} disabled={!adminAuthorized} onChange={event=>setSendEmailOnScan(event.target.checked)}/> Send alert email after this scan</label></div></div>
              <div className="kw-section"><div className="kw-label">Research themes to monitor</div><div className="kw-tags">{themeList.map(theme=><button key={theme} className={`kw-tag ${selectedThemes.includes(theme)?'on':''}`} onClick={()=>setSelectedThemes(current=>current.includes(theme)?current.filter(item=>item!==theme):[...current,theme])}>{theme}</button>)}</div></div>
              {scanError&&<p className="scan-error">{scanError}</p>}
              <div className="scan-actions"><button className="btn btn-primary" onClick={runScan} disabled={isScanning}>{isScanning?'Scanning...':'Start AI Scan'}</button><button className="btn btn-ghost" onClick={checkRobots} disabled={auditRequest.isLoading}>{auditRequest.isLoading?'Checking robots.txt...':'Check robots.txt'}</button><button className="btn btn-ghost" onClick={()=>navigate('dash')}>Back to Dashboard</button><span className="m365-badge">{sendEmailOnScan?'Email enabled for scan':'Dry-run: no email'}</span></div>
              {robotAudit&&<div className="robots-results"><strong>robots.txt audit: {robotAudit.allowed} allowed, {robotAudit.blocked} blocked</strong>{robotAudit.results.map(result=><div key={result.name}><span>{result.name}</span><b className={result.allowed?'ok':'er'}>{result.allowed?'ALLOWED':'BLOCKED'}</b></div>)}</div>}
            </div>
            <div className="panel scraper-tools"><div className="panel-title">Scraper tools · {seenHistory?.total ?? 0} CFPs in deduplication history</div>
              <details className="advanced-config"><summary>Advanced scraper configuration</summary>
                {!adminAuthorized ? <div className="admin-lock"><p>Admin access is required to change sources, email routing, or persistent scanner settings.</p><label htmlFor="admin-token">Backend admin token</label><input id="admin-token" type="password" autoComplete="current-password" value={adminToken} onChange={event=>setAdminToken(event.target.value)} onKeyDown={event=>{if(event.key==='Enter') void unlockAdmin();}}/><button className="btn btn-ghost btn-sm" disabled={authRequest.isLoading} onClick={unlockAdmin}>{authRequest.isLoading?'Checking...':'Unlock admin settings'}</button>{adminAuthMessage&&<p role="status">{adminAuthMessage}</p>}</div> : <>
                <div className="config-grid"><label>Daily scan enabled<input type="checkbox" checked={scheduleEnabled} onChange={event=>setScheduleEnabled(event.target.checked)}/></label><label>Daily scan time (Africa/Lagos)<input type="time" value={scheduleTime} onChange={event=>setScheduleTime(event.target.value)}/></label><label>Send email after scheduled scan<input type="checkbox" checked={scheduleSendEmail} onChange={event=>setScheduleSendEmail(event.target.checked)}/></label></div>
                <div className="config-grid"><label>Crawl delay (seconds)<input type="number" min="0" max="60" step="0.5" value={crawlDelay} onChange={event=>setCrawlDelay(Number(event.target.value))}/></label><label>Request timeout (seconds)<input type="number" min="1" max="120" value={requestTimeout} onChange={event=>setRequestTimeout(Number(event.target.value))}/></label><label>Robots cache TTL (seconds)<input type="number" min="1" max="86400" value={robotsCacheTtl} onChange={event=>setRobotsCacheTtl(Number(event.target.value))}/></label></div>
                <label className="kw-label" htmlFor="themes-json">Theme keywords (JSON)</label><textarea id="themes-json" className="config-json" value={themesJson} onChange={event=>setThemesJson(event.target.value)}/>
                <label className="kw-label" htmlFor="africa-keywords-json">Africa keywords (JSON)</label><textarea id="africa-keywords-json" className="config-json" value={africaKeywordsJson} onChange={event=>setAfricaKeywordsJson(event.target.value)}/>
                <p>Configured sources (one JSON array per type): URLs and scraper selectors/mappings are editable.</p>
                <label className="kw-label" htmlFor="api-sources-json">API sources (JSON)</label><textarea id="api-sources-json" className="config-json" value={apiSourcesJson} onChange={event=>setApiSourcesJson(event.target.value)}/>
                <label className="kw-label" htmlFor="rss-sources-json">RSS sources (JSON)</label><textarea id="rss-sources-json" className="config-json" value={rssSourcesJson} onChange={event=>setRssSourcesJson(event.target.value)}/>
                <label className="kw-label" htmlFor="web-sources-json">Web sources (JSON)</label><textarea id="web-sources-json" className="config-json" value={webSourcesJson} onChange={event=>setWebSourcesJson(event.target.value)}/>
                <div className="config-grid"><label>Email sender<input type="email" value={emailFrom} onChange={event=>setEmailFrom(event.target.value)}/></label><label>Recipients (comma separated)<input type="text" value={emailRecipients} onChange={event=>setEmailRecipients(event.target.value)}/></label><label>SMTP host<input type="text" value={smtpHost} onChange={event=>setSmtpHost(event.target.value)}/></label><label>SMTP port<input type="number" min="1" max="65535" value={smtpPort} onChange={event=>setSmtpPort(Number(event.target.value))}/></label></div>
                <p>Email credentials stay in backend environment variables and are never shown here.</p>
                {adminAuthMessage&&<p role="status">{adminAuthMessage}</p>}<button className="btn btn-ghost btn-sm" disabled={configRequest.isLoading} onClick={saveAdvancedConfig}>{configRequest.isLoading?'Saving...':'Save advanced settings'}</button> <button className="btn btn-ghost btn-sm" onClick={lockAdmin}>Lock admin settings</button>
                </>}
              </details><div className="tool-grid">
                <div><label className="kw-label" htmlFor="prefilter-text">Keyword prefilter</label><textarea id="prefilter-text" value={prefilterText} onChange={event=>setPrefilterText(event.target.value)} placeholder="Paste a call description to check IITA theme matches"/><button className="btn btn-ghost btn-sm" disabled={!prefilterText.trim()||prefilterRequest.isLoading} onClick={runPrefilter}>Check themes</button>{prefilterResult&&<p>{prefilterResult.matched?'Matched: ':'No theme match'}{prefilterResult.themes.join(', ')}</p>}</div>
                <div><label className="kw-label" htmlFor="score-title">Score a candidate with Claude</label><input id="score-title" value={scoreTitle} onChange={event=>setScoreTitle(event.target.value)} placeholder="Opportunity title"/><textarea value={scoreSnippet} onChange={event=>setScoreSnippet(event.target.value)} placeholder="Description or source excerpt"/><button className="btn btn-ghost btn-sm" disabled={!scoreTitle.trim()||scoreRequest.isLoading} onClick={runCandidateScore}>{scoreRequest.isLoading?'Scoring...':'Score candidate'}</button>{scoredCandidate&&<p>Score {scoredCandidate.score}/100 · {scoredCandidate.themes.join(', ')}<br/>{scoredCandidate.summary}</p>}</div>
              </div>
              <div className="scan-actions"><button className="btn btn-ghost btn-sm" disabled={!opportunities.length||previewRequest.isLoading} onClick={previewDigest}>Preview email digest ({opportunities.length})</button><button className="btn btn-ghost btn-sm" disabled={!opportunities.length||sendEmailRequest.isLoading||!adminAuthorized} onClick={emailDigest}>{sendEmailRequest.isLoading?'Sending...':'Send email digest'}</button><span className="m365-badge">Mode: {scraperSettings?.email_mode ?? 'loading'} · {scraperSettings?.email_configured?'credentials set':'credentials missing'}</span></div>
              {toolMessage&&<p className="scan-error">{toolMessage}</p>}
            </div>
            <div className="panel"><div className="prog-wrap"><div className="prog-track"><div className="prog-fill" style={{width:scan?.status==='completed'?'100%':isScanning?'55%':scan?.status==='failed'?'0%':'0%'}}/></div><div className="prog-label">{scan?.message || 'Ready to scan selected donor sources'}</div></div>{scan?.status==='completed'&&scan.digest_available&&scan.dry_run&&<button className="btn btn-ghost btn-sm" disabled={!adminAuthorized||latestDigestRequest.isLoading} onClick={previewLatestDigest}>{latestDigestRequest.isLoading?'Preparing digest...':'Preview latest dry-run digest'}</button>}<div className="log"><div>IITA CFP Intelligence System</div><div>robots.txt compliance: ACTIVE</div><div>Selected portals: {sourceList.filter(source=>selectedSources[source.name]).length}</div>{scan?.started_at&&<div>Last scan: {new Date(scan.started_at).toLocaleString()}</div>}{scan&&<div className={scan.status==='failed'?'er':scan.status==='completed'?'ok':'hi'}>{scan.status.toUpperCase()}: {scan.message}</div>}</div></div>
          </section>}

          {view==='reports'&&<section className="rpt-wrap">
            <div className="period-bar"><h2>Management Report</h2><div className="period-btns">{[1,3,6].map(months=><button key={months} className={`period-btn ${period===months?'active':''}`} onClick={()=>setPeriod(months)}>Last {months} month{months===1?'':'s'}</button>)}<button className={`period-btn ${period===0?'active':''}`} onClick={()=>setPeriod(0)}>Custom range</button></div>{period===0&&<div className="custom-range"><input type="date" value={dateFrom} onChange={event=>setDateFrom(event.target.value)}/><span>to</span><input type="date" value={dateTo} onChange={event=>setDateTo(event.target.value)}/></div>}<div className="rpt-actions"><button className="btn btn-ghost btn-sm" onClick={()=>window.print()}>Print / Save PDF</button><button className="btn btn-primary btn-sm" onClick={exportCsv}>Export CSV</button></div></div>
            <div className="kpi-row"><Kpi value={reportData.length} label="Opportunities scanned" sub={periodLabel}/><Kpi value={reportData.filter(item=>item.score>=80).length} label="High priority (80+)" sub="Immediate attention" cls="kpi-deep"/><Kpi value={donors.length} label="Donor organisations" sub="Unique funders" cls="kpi-blue"/><Kpi value={reportData.filter(item=>item.status==='submitted'||item.status==='won').length} label="Proposals submitted" sub="In period" cls="kpi-green"/><Kpi value={reportData.filter(item=>item.status==='won').length} label="Awards won" sub="Success rate" cls="kpi-amber"/></div>
            <div className="analytics-grid"><div className="chart-panel"><div className="chart-title">Opportunities detected over time</div><div className="chart-sub">Monthly volume of CFPs identified by the scanner</div><div className="timeline">{months.map((month,index)=><div className="tl-col" key={month.key}><div className="tl-val">{monthCounts[index]}</div><div className="tl-bar" style={{height:`${Math.max(4,Math.round(monthCounts[index]/maxMonth*76))}px`}} title={`${month.label}: ${monthCounts[index]}`}/><div className="tl-label">{month.label}</div></div>)}</div></div>
              <div className="chart-panel"><div className="chart-title">AI relevance score distribution</div><div className="chart-sub">Opportunity scores against IITA's research mandate</div><div className="score-bands">{scoreBands.map((band,index)=><div className="score-band" key={band.label} style={{height:`${Math.max(4,Math.round(scoreCounts[index]/maxScore*76))}px`,background:band.color}} title={`${band.label}: ${scoreCounts[index]}`}/>)}</div><div className="score-axis">{scoreBands.map(band=><span key={band.label}>{band.label}</span>)}</div><div className="chart-legend">80-100 High priority &nbsp; 60-79 Standard &nbsp; Below threshold</div></div></div>
            <div className="analytics-grid"><div className="chart-panel"><div className="chart-title">Opportunities by donor organisation</div><div className="chart-sub">Which funders produced the most relevant calls</div><div className="bar-chart">{donorCounts.map((item,index)=><div className="bar-row" key={item.name}><div className="bar-label" title={item.name}>{item.name}</div><div className="bar-track"><div className="bar-fill" style={{width:`${item.count/maxDonor*100}%`,background:COLORS[index%COLORS.length]}}><span>{item.count}</span></div></div><div className="bar-count">{item.count}</div></div>)}{!donorCounts.length&&<div className="empty compact">No donor data in this period.</div>}</div></div>
              <div className="chart-panel"><div className="chart-title">Opportunities by research theme</div><div className="chart-sub">Coverage across IITA's seven thematic areas</div>{themeList.map((theme,index)=>{const count=themeCounts[index];return <div className="theme-bar-row" key={theme}><div className="theme-bar-label">{theme}</div><div className="theme-bar-track"><div className="theme-bar-fill" style={{width:`${count/maxTheme*100}%`,background:COLORS[index]}}/></div><div className="theme-bar-count">{count}</div></div>})}</div></div>
            <div className="analytics-grid wide"><div className="chart-panel"><div className="chart-title">Proposal pipeline - status funnel</div><div className="chart-sub">Tracking opportunities from detection through to award</div><div className="funnel">{stages.map(stage=><div className="funnel-row" key={stage.label}><div className="funnel-label">{stage.label}</div><div className="funnel-bar" style={{width:`${Math.max(4,stage.count/Math.max(1,reportData.length)*100)}%`,background:stage.color}}>{stage.count}</div><div className="funnel-count" style={{color:stage.color}}>{stage.count}</div></div>)}</div></div></div>
            <div className="chart-panel"><div className="chart-title">All opportunities in period</div><div className="chart-sub">{reportData.length} opportunities · Average relevance score: {avg}/100</div><div style={{overflowX:'auto',marginTop:4}}><table className="opp-table"><thead><tr><th>#</th><th>Opportunity title</th><th>Donor</th><th>Theme(s)</th><th>Grant value</th><th>Deadline</th><th>Score</th><th>Status</th><th>Source type</th></tr></thead><tbody>{[...reportData].sort((a,b)=>b.score-a.score).map((item,index)=><tr key={item.id}><td>{index+1}</td><td><div className="opp-title">{item.title}</div><div className="opp-source">{item.eligible_regions}</div></td><td>{item.source}</td><td>{item.themes.join(', ')}</td><td><span className="budget-pill">{item.budget||'-'}</span></td><td>{item.deadline||'-'}</td><td>{item.score}/100</td><td>{STATUS_LABEL[item.status]}</td><td>{item.source_type.toUpperCase()}</td></tr>)}</tbody></table>{!reportData.length&&<div className="empty compact">No opportunities for this period.</div>}</div></div>
          </section>}
          <footer className="app-footer">IITA CFP Intelligence System <span>Last scan: {lastScan}</span></footer>
        </main>
      </div>
    </div>
    {activeOpportunity&&<div className="overlay" onClick={event=>{if(event.target===event.currentTarget)setActiveOpportunity(null)}}><div className="modal"><div className="modal-head"><div className="modal-title">{activeOpportunity.title}</div><button className="modal-close" onClick={()=>setActiveOpportunity(null)} aria-label="Close">x</button></div><div className="modal-body"><div className="tags">{activeOpportunity.themes.map(theme=><span className="tag" key={theme}>{theme}</span>)}<span className={`score-pill ${activeOpportunity.score>=80?'sp-urgent':activeOpportunity.score>=70?'sp-high':'sp-medium'}`}>{activeOpportunity.score}/100</span></div><Detail label="Source" value={activeOpportunity.source}/><Detail label="Published" value={activeOpportunity.published||'-'}/><Detail label="Deadline" value={activeOpportunity.deadline||'-'}/><Detail label="Budget" value={activeOpportunity.budget||'-'}/><Detail label="Region" value={activeOpportunity.eligible_regions||'-'}/><Detail label="Consortium" value={activeOpportunity.consortium===true?'Required':activeOpportunity.consortium===false?'Not required':'-'}/>{activeOpportunity.url&&<Detail label="Link" value={<a href={activeOpportunity.url} target="_blank" rel="noreferrer">{activeOpportunity.url}</a>}/>}<hr className="divider"/><div className="kw-label">AI Summary</div><p className="modal-summary">{activeOpportunity.summary||'No summary provided.'}</p><div className="modal-actions"><a href={activeOpportunity.url||'#'} target="_blank" rel="noreferrer" className="btn btn-primary">View Full Call</a><button className="btn btn-ghost" onClick={()=>changeStatus(activeOpportunity,'reviewing')}>Mark Under Review</button></div></div></div></div>}
  </>;
}

function Kpi({value,label,sub,cls=''}:{value:number|string;label:string;sub:string;cls?:string}) { return <div className={`kpi ${cls}`}><div className="kpi-val">{value}</div><div className="kpi-label">{label}</div><div className="kpi-sub">{sub}</div></div>; }
function Detail({label,value}:{label:string;value:React.ReactNode}) { return <div className="d-row"><div className="d-lbl">{label}</div><div className="d-val">{value}</div></div>; }