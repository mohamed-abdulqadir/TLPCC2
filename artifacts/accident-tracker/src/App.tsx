import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  useListAccidents, getListAccidentsQueryKey, useCreateAccident,
  useGetDashboard, getGetDashboardQueryKey, useListActions,
  getListActionsQueryKey, useCreateAction, useUpdateAction,
} from '@workspace/api-client-react';
import type { Accident, AccidentInput, Action, ActionInput, ActionStatus } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Form } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link, Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ClerkProvider, SignIn, useClerk, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/shared/keys';
import { shadcn } from '@clerk/themes';
import {
  Activity, ArrowDownToLine, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown,
  CircleAlert, ClipboardCheck, Clock3, FilePlus2, Filter, HeartHandshake, Home, MapPin,
  Search, ShieldCheck, SlidersHorizontal, X,
} from 'lucide-react';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY.');
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#315c4a',
    colorForeground: '#2d4038',
    colorMutedForeground: '#68776f',
    colorDanger: '#a83d38',
    colorBackground: '#fffdf8',
    colorInput: '#fffdf8',
    colorInputForeground: '#2d4038',
    colorNeutral: '#d9d2c4',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf8] rounded-2xl !w-full !max-w-[440px] overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#29483b] font-bold tracking-tight',
    headerSubtitle: 'text-[#68776f]',
    socialButtonsBlockButtonText: 'text-[#2d4038] font-semibold',
    formFieldLabel: 'text-[#34483f] font-semibold',
    footerActionLink: 'text-[#315c4a] font-semibold',
    footerActionText: 'text-[#68776f]',
    dividerText: 'text-[#68776f]',
    identityPreviewEditButton: 'text-[#315c4a]',
    formFieldSuccessText: 'text-[#315c4a]',
    alertText: 'text-[#8f342f]',
    logoBox: 'rounded-xl overflow-hidden',
    logoImage: 'object-contain',
    socialButtonsBlockButton: 'border-[#ded8cb] hover:bg-[#f4f1e9]',
    formButtonPrimary: 'bg-[#315c4a] hover:bg-[#284c3d] text-white shadow-none',
    formFieldInput: 'border-[#d9d2c4] bg-[#fffdf8] text-[#2d4038]',
    footerAction: '!hidden',
    dividerLine: 'bg-[#e5dfd4]',
    alert: 'border-[#ead0cd] bg-[#fff4f2]',
    otpCodeFieldInput: 'border-[#d9d2c4] bg-[#fffdf8]',
    formFieldRow: 'text-[#2d4038]',
    main: 'text-[#2d4038]',
  },
};
const accidentSchema = z.object({
  date: z.string().min(1, 'Choose the date of the incident'),
  time: z.string().min(1, 'Add an approximate time'),
  childName: z.string().min(1, 'Enter the child’s name').max(120),
  room: z.string().min(1, 'Choose a room').max(80),
  location: z.string().min(1, 'Enter where it happened').max(120),
  accidentType: z.string().min(1, 'Choose an incident type').max(80),
  injuryType: z.string().min(1, 'Describe the injury').max(80),
  description: z.string().min(1, 'Add a brief description').max(5000),
  treatmentGiven: z.string().min(1, 'Describe any treatment given').max(5000),
  parentInformed: z.boolean(),
});
const actionSchema = z.object({
  title: z.string().min(1, 'Add a clear action title').max(200),
  reason: z.string().min(1, 'Explain why this action is needed').max(5000),
  assignedTo: z.string().min(1, 'Add an owner').max(120),
  dueDate: z.string().min(1, 'Choose a due date'),
  status: z.enum(['Not Started', 'In Progress', 'Completed']),
});
type AccidentFormValues = z.infer<typeof accidentSchema>;
type ActionFormValues = z.infer<typeof actionSchema>;

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: Home, testId: 'link-nav-overview' },
  { href: '/accidents', label: 'Accident register', icon: ClipboardCheck, testId: 'link-nav-accidents' },
  { href: '/actions', label: 'Improvement actions', icon: CheckCircle2, testId: 'link-nav-actions' },
];
const dateLabel = (value?: string) => {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date());
const statusTone = (status: ActionStatus) => status === 'Completed' ? 'complete' : status === 'In Progress' ? 'progress' : 'pending';

function AppShell({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const { signOut } = useClerk();
  return <div className="app-frame min-h-[100dvh]">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand-lockup" data-testid="link-brand-home">
        <img className="brand-mark" src={`${basePath}/logo.svg`} alt="" />
        <span><strong>Little Oak</strong><small>Care & learning</small></span>
      </Link>
      <div className="confidential"><ShieldCheck size={15} /><span>Confidential staff tool</span></div>
      <nav className="side-nav" aria-label="Main navigation">
        <p className="nav-caption">WORKSPACE</p>
        {navItems.map(({ href, label, icon: Icon, testId }) => <Link key={href} href={href} className={`nav-link ${path === href || (href === '/accidents' && path === '/accidents/new') ? 'active' : ''}`} data-testid={testId}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{href === '/actions' && <span className="nav-dot" />}
        </Link>)}
      </nav>
      <div className="sidebar-note"><span className="note-icon"><ShieldCheck size={17} /></span><div><strong>Private by design</strong><p>Only share information with colleagues who need it for care and learning.</p></div></div>
      <button className="sidebar-foot" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><span className="staff-avatar">LO</span><span><strong>Staff workspace</strong><small>Sign out securely</small></span><ChevronDown size={15} /></button>
    </aside>
    <main className="main-area">
      <header className="topbar"><div className="topbar-label"><span className="live-indicator" />Internal care workspace</div><div className="topbar-right"><span className="privacy-label"><ShieldCheck size={15} /> Confidential</span><button className="top-avatar top-avatar-button" onClick={() => signOut({ redirectUrl: basePath || '/' })} aria-label="Sign out" title="Sign out" data-testid="button-sign-out-mobile">LO</button></div></header>
      <div className="content-wrap">{children}</div>
    </main>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map(({ href, label, icon: Icon, testId }) => <Link key={href} href={href} className={`mobile-nav-item ${path === href || (href === '/accidents' && path === '/accidents/new') ? 'active' : ''}`} data-testid={`${testId}-mobile`}><Icon size={19} /><span>{label === 'Accident register' ? 'Register' : label === 'Improvement actions' ? 'Actions' : 'Overview'}</span></Link>)}</nav>
  </div>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}
function QueryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="state-card error-state" role="alert" data-testid="status-query-error"><span className="state-icon"><CircleAlert size={21} /></span><div><strong>We couldn’t load this information</strong><p>{message}</p><button className="text-action" onClick={onRetry} data-testid="button-retry">Try again <ArrowRight size={14} /></button></div></div>;
}
function SkeletonRows({ count = 3 }: { count?: number }) {
  return <div className="skeleton-list" aria-label="Loading"><span className="sr-only">Loading information</span>{Array.from({ length: count }, (_, i) => <div className="skeleton-row" key={i}><i /><div><i /><i /></div><i /></div>)}</div>;
}
function Breakdown({ title, items, kind }: { title: string; items: { name: string; count: number }[]; kind: string }) {
  const max = Math.max(1, ...items.map(item => item.count));
  return <section className="panel breakdown-panel" data-testid={`panel-breakdown-${kind}`}>
    <div className="panel-heading"><div><span className="panel-kicker">PATTERNS</span><h2>{title}</h2></div><span className="mini-count">{items.length} {items.length === 1 ? 'group' : 'groups'}</span></div>
    {items.length ? <div className="breakdown-list">{items.slice(0, 5).map((item, index) => <div className="breakdown-item" key={`${item.name}-${index}`} data-testid={`data-${kind}-${index}`}>
      <div className="breakdown-label"><span>{item.name}</span><strong>{item.count}</strong></div><div className="bar-track"><span style={{ width: `${Math.max(5, item.count / max * 100)}%` }} /></div>
    </div>)}</div> : <div className="inline-empty">No incident patterns to show yet.</div>}
  </section>;
}
function Dashboard() {
  const { data, isLoading, isError, refetch } = useGetDashboard();
  const [, setLocation] = useLocation();
  return <div className="page-enter">
    <PageHeading eyebrow="YOUR TEAM AT A GLANCE" title="Good morning" description={`A clear picture of care, learning and follow-up for ${monthName}.`} action={<Button onClick={() => setLocation('/accidents/new')} className="primary-button" data-testid="button-record-incident"><FilePlus2 size={17} /> Record an incident</Button>} />
    {isLoading ? <><div className="metric-skeletons"><i /><i /><i /></div><div className="dashboard-grid"><SkeletonRows count={4} /><SkeletonRows count={4} /></div></> : isError || !data ? <QueryError message="Your dashboard is still safe. Please try loading it again." onRetry={() => refetch()} /> : <>
      <section className="welcome-strip"><div className="welcome-emblem"><Activity size={20} /></div><div><strong>Every record helps us make care safer.</strong><p>Thank you for taking the time to notice, record and learn together.</p></div><span className="strip-month">{monthName}</span></section>
      <section className="metric-row">
        <div className="metric-card metric-primary" data-testid="metric-total-this-month"><div className="metric-top"><span>Incidents this month</span><CalendarDays size={17} /></div><strong className="metric-number">{data.totalThisMonth}</strong><span className="metric-foot">A shared view helps us spot what needs attention.</span></div>
        <div className="metric-card"><div className="metric-top"><span>Rooms represented</span><MapPin size={17} /></div><strong className="metric-number">{data.byRoom.length}</strong><span className="metric-foot">Across {data.byLocation.length} {data.byLocation.length === 1 ? 'location' : 'locations'}</span></div>
        <div className="metric-card"><div className="metric-top"><span>Incident patterns</span><Activity size={17} /></div><strong className="metric-number">{data.byType.length}</strong><span className="metric-foot">Types recorded this month</span></div>
      </section>
      <section className="dashboard-grid">
        <Breakdown title="By room" items={data.byRoom} kind="room" />
        <Breakdown title="By location" items={data.byLocation} kind="location" />
        <Breakdown title="By incident type" items={data.byType} kind="type" />
        <section className="panel recent-panel"><div className="panel-heading"><div><span className="panel-kicker">LATEST RECORDS</span><h2>Recent incidents</h2></div><Link href="/accidents" className="panel-link" data-testid="link-view-register">View register <ArrowRight size={14} /></Link></div>
          {data.recentAccidents.length ? <div className="recent-list">{data.recentAccidents.slice(0, 5).map(item => <AccidentListRow key={item.id} item={item} compact />)}</div> : <div className="inline-empty">There are no recent incidents to display.</div>}
        </section>
      </section>
      <div className="learning-note"><span><ShieldCheck size={17} /></span><p><strong>Learning, not blame.</strong> This information supports safer spaces and thoughtful care. Keep details factual and private.</p></div>
    </>}
  </div>;
}

function AccidentListRow({ item, compact = false }: { item: Accident; compact?: boolean }) {
  return <article className={`accident-row ${compact ? 'compact' : ''}`} data-testid={`row-accident-${item.id}`}>
    <div className="date-block"><strong>{new Intl.DateTimeFormat('en-GB', { day: '2-digit' }).format(new Date(`${item.date.slice(0,10)}T12:00:00`))}</strong><span>{new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(new Date(`${item.date.slice(0,10)}T12:00:00`))}</span></div>
    <div className="accident-main"><strong data-testid={`data-child-name-${item.id}`}>{item.childName}</strong><span>{item.accidentType} · {item.injuryType}</span><small>{item.room} <b>·</b> {item.location}</small></div>
    {!compact && <div className="accident-time">{item.time}</div>}
    <span className={`parent-pill ${item.parentInformed ? 'informed' : 'not-informed'}`} data-testid={`status-parent-informed-${item.id}`}>{item.parentInformed ? 'Parent informed' : 'Follow-up needed'}</span>
  </article>;
}

function AccidentRegister() {
  const [filters, setFilters] = useState({ search: '', dateFrom: '', dateTo: '', room: '', location: '', accidentType: '' });
  const params = useMemo(() => Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) as typeof filters, [filters]);
  const { data, isLoading, isError, refetch, isFetching } = useListAccidents(params);
  const records = data ?? [];
  const setFilter = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const filterOptions = useMemo(() => ({
    room: [...new Set(records.map(item => item.room))].sort(),
    location: [...new Set(records.map(item => item.location))].sort(),
    accidentType: [...new Set(records.map(item => item.accidentType))].sort(),
  }), [records]);
  const exportExcel = () => {
    const columns: (keyof Accident)[] = ['date', 'time', 'childName', 'room', 'location', 'accidentType', 'injuryType', 'description', 'treatmentGiven', 'parentInformed'];
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [columns.join(','), ...records.map(row => columns.map(column => escape(row[column])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'accident-register.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  return <div className="page-enter">
    <PageHeading eyebrow="RECORDS & REFERENCE" title="Accident register" description="Find a record, review the details and export a working copy when needed." action={<Button variant="outline" onClick={exportExcel} disabled={!records.length} className="outline-button" data-testid="button-export-excel"><ArrowDownToLine size={16} /> Export to Excel</Button>} />
    <section className="panel filter-panel">
      <div className="filter-title"><div className="filter-icon"><SlidersHorizontal size={17} /></div><div><strong>Find a record</strong><span>Use any combination of filters</span></div><span className="filter-count">{isFetching && !isLoading ? 'Updating…' : `${records.length} ${records.length === 1 ? 'record' : 'records'}`}</span></div>
      <div className="filter-grid">
        <label className="filter-field search-filter"><span>Search</span><div className="input-with-icon"><Search size={16} /><Input value={filters.search} onChange={e => setFilter('search', e.target.value)} placeholder="Child name or details" aria-label="Search records" data-testid="input-filter-search" /></div></label>
        <label className="filter-field"><span>From date</span><Input type="date" value={filters.dateFrom} onChange={e => setFilter('dateFrom', e.target.value)} data-testid="input-filter-date-from" /></label>
        <label className="filter-field"><span>To date</span><Input type="date" value={filters.dateTo} onChange={e => setFilter('dateTo', e.target.value)} data-testid="input-filter-date-to" /></label>
        {(['room', 'location', 'accidentType'] as const).map((key) => <label className="filter-field" key={key}><span>{key === 'accidentType' ? 'Incident type' : key === 'room' ? 'Room' : 'Location'}</span><select value={filters[key]} onChange={e => setFilter(key, e.target.value)} data-testid={`select-filter-${key}`}><option value="">All {key === 'accidentType' ? 'types' : `${key}s`}</option>{filterOptions[key].map(option => <option key={option} value={option}>{option}</option>)}</select></label>)}
        <button className="clear-filters" onClick={() => setFilters({ search: '', dateFrom: '', dateTo: '', room: '', location: '', accidentType: '' })} data-testid="button-clear-filters"><X size={14} /> Clear filters</button>
      </div>
    </section>
    <section className="panel register-panel"><div className="panel-heading register-heading"><div><span className="panel-kicker">PRIVATE RECORDS</span><h2>Incident records</h2></div><div className="register-meta"><span className="privacy-tag"><ShieldCheck size={14} /> Confidential</span></div></div>
      {isLoading ? <SkeletonRows count={5} /> : isError ? <QueryError message="The register could not be reached. Your filters are saved." onRetry={() => refetch()} /> : records.length ? <div className="register-list">{records.map(item => <AccidentListRow key={item.id} item={item} />)}</div> : <div className="empty-state" data-testid="status-accidents-empty"><span className="empty-illustration"><Search size={25} /></span><strong>No records found</strong><p>Try another search or clear a filter to see more records.</p><button className="text-action" onClick={() => setFilters({ search: '', dateFrom: '', dateTo: '', room: '', location: '', accidentType: '' })} data-testid="button-reset-search">Clear all filters <ArrowRight size={14} /></button></div>}
    </section>
  </div>;
}

function Field({ label, name, register, error, type = 'text', placeholder, children, testId }: { label: string; name: keyof AccidentFormValues | keyof ActionFormValues; register: (name: any) => any; error?: string; type?: string; placeholder?: string; children?: ReactNode; testId?: string }) {
  return <label className="form-field"><span>{label}</span>{children ?? <Input type={type} placeholder={placeholder} {...register(name)} data-testid={testId} />}{error && <small className="field-error" role="alert">{error}</small>}</label>;
}
function RecordAccident() {
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [saved, setSaved] = useState(false);
  const form = useForm<AccidentFormValues>({ resolver: zodResolver(accidentSchema), defaultValues: { date: new Date().toISOString().slice(0,10), time: '', childName: '', room: '', location: '', accidentType: '', injuryType: '', description: '', treatmentGiven: '', parentInformed: false } });
  const createAccident = useCreateAccident({ mutation: { onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: getListAccidentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    setSaved(true);
  } } });
  const submit = (values: AccidentFormValues) => createAccident.mutate({ data: values as AccidentInput });
  if (saved) return <div className="page-enter"><div className="success-screen" data-testid="status-accident-success"><span className="success-seal"><Check size={30} /></span><span className="eyebrow">RECORD SAVED</span><h1>Thank you for recording this.</h1><p>Your report has been added to the confidential register. Taking a moment to record what happened helps the whole team learn.</p><div className="success-actions"><Button className="primary-button" onClick={() => { setSaved(false); form.reset({ date: new Date().toISOString().slice(0,10), time: '', childName: '', room: '', location: '', accidentType: '', injuryType: '', description: '', treatmentGiven: '', parentInformed: false }); }} data-testid="button-record-another">Record another incident</Button><Button variant="outline" className="outline-button" onClick={() => setLocation('/accidents')} data-testid="button-view-register">View register</Button></div><div className="success-privacy"><ShieldCheck size={16} /> This information is for care and learning, and should be kept private.</div></div></div>;
  return <div className="page-enter">
    <div className="back-link-row"><Link href="/accidents" className="back-link" data-testid="link-back-register">← Accident register</Link><span className="privacy-tag"><ShieldCheck size={14} /> Confidential</span></div>
    <PageHeading eyebrow="NEW CONFIDENTIAL RECORD" title="Record an incident" description="Use clear, factual details. If you’re unsure, record what you know and speak with your manager." />
    <div className="form-layout"><section className="panel incident-form-panel">
      <Form {...form}><form onSubmit={form.handleSubmit(submit)} noValidate>
        <div className="form-section"><div className="form-section-heading"><span className="section-number">01</span><div><h2>When and where</h2><p>Start with the basic details.</p></div></div>
          <div className="form-grid">
            <Field label="Date of incident" name="date" type="date" register={form.register} error={form.formState.errors.date?.message} testId="input-accident-date" />
            <Field label="Approximate time" name="time" type="time" register={form.register} error={form.formState.errors.time?.message} testId="input-accident-time" />
            <Field label="Child’s name" name="childName" register={form.register} error={form.formState.errors.childName?.message} placeholder="First and last name" testId="input-accident-child-name" />
            <Field label="Room or group" name="room" register={form.register} error={form.formState.errors.room?.message} placeholder="e.g. Acorn room" testId="input-accident-room" />
            <Field label="Where did it happen?" name="location" register={form.register} error={form.formState.errors.location?.message} placeholder="e.g. Outdoor play area" testId="input-accident-location" />
            <Field label="Incident type" name="accidentType" register={form.register} error={form.formState.errors.accidentType?.message} placeholder="e.g. Fall, bump, scratch" testId="input-accident-type" />
          </div>
        </div>
        <div className="form-section"><div className="form-section-heading"><span className="section-number">02</span><div><h2>What happened</h2><p>Describe what you saw in a calm, factual way.</p></div></div>
          <div className="form-grid"><Field label="Injury or effect" name="injuryType" register={form.register} error={form.formState.errors.injuryType?.message} placeholder="e.g. Small bruise to left knee" testId="input-accident-injury" /><div className="field-spacer" />
            <label className="form-field full-field"><span>Description of incident</span><textarea {...form.register('description')} placeholder="What was happening just before, and what did you observe?" rows={4} data-testid="input-accident-description" />{form.formState.errors.description && <small className="field-error">{form.formState.errors.description.message}</small>}</label>
            <label className="form-field full-field"><span>Treatment or support given</span><textarea {...form.register('treatmentGiven')} placeholder="Include first aid or comfort offered, and how the child responded." rows={3} data-testid="input-accident-treatment" />{form.formState.errors.treatmentGiven && <small className="field-error">{form.formState.errors.treatmentGiven.message}</small>}</label>
          </div>
        </div>
        <label className="check-field"><input type="checkbox" {...form.register('parentInformed')} data-testid="input-parent-informed" /><span className="check-mark"><Check size={14} /></span><span><strong>Parent or carer informed</strong><small>Tick once a parent or carer has been updated.</small></span></label>
        {createAccident.isError && <div className="form-error" role="alert" data-testid="status-accident-error"><CircleAlert size={16} /> We couldn’t save this record. Please check your connection and try again.</div>}
        <div className="form-submit-row"><span><ShieldCheck size={15} /> Your record is confidential</span><Button type="submit" className="primary-button" disabled={createAccident.isPending} data-testid="button-submit-accident">{createAccident.isPending ? 'Saving record…' : 'Save incident record'} <ArrowRight size={16} /></Button></div>
      </form></Form>
    </section>
    <aside className="form-aside"><div className="aside-card reassurance-card"><span className="aside-icon"><HeartHandshake size={20} /></span><h3>There’s no perfect way to write this.</h3><p>A simple, factual account is enough. Your manager can help if you have questions about what to include.</p></div><div className="aside-card"><span className="aside-title"><ShieldCheck size={15} /> A gentle reminder</span><p>Only include information that is relevant to the incident. Keep conversations and records private.</p></div></aside></div>
  </div>;
}

function ActionCreation({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<ActionFormValues>({ resolver: zodResolver(actionSchema), defaultValues: { title: '', reason: '', assignedTo: '', dueDate: '', status: 'Not Started' } });
  const createAction = useCreateAction({ mutation: { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListActionsQueryKey() }); onCreated(); } } });
  return <section className="panel create-action-panel" data-testid="panel-create-action"><div className="panel-heading"><div><span className="panel-kicker">FOLLOW-UP</span><h2>New improvement action</h2></div><button className="icon-button" onClick={onClose} aria-label="Close action form" data-testid="button-close-action-form"><X size={18} /></button></div>
    <Form {...form}><form onSubmit={form.handleSubmit(values => createAction.mutate({ data: values as ActionInput }))} className="action-form">
      <Field label="Action" name="title" register={form.register} error={form.formState.errors.title?.message} placeholder="What needs to happen?" testId="input-action-title" />
      <label className="form-field"><span>Reason for action</span><textarea {...form.register('reason')} placeholder="What will this help us improve?" rows={3} data-testid="input-action-reason" />{form.formState.errors.reason && <small className="field-error">{form.formState.errors.reason.message}</small>}</label>
      <div className="form-grid"><Field label="Assigned to" name="assignedTo" register={form.register} error={form.formState.errors.assignedTo?.message} placeholder="Team member" testId="input-action-assignee" /><Field label="Due date" name="dueDate" type="date" register={form.register} error={form.formState.errors.dueDate?.message} testId="input-action-due-date" /></div>
      <label className="form-field"><span>Status</span><select {...form.register('status')} data-testid="select-action-create-status"><option>Not Started</option><option>In Progress</option><option>Completed</option></select></label>
      {createAction.isError && <div className="form-error" role="alert">We couldn’t save this action. Please try again.</div>}
      <div className="form-submit-row"><span>Keep the action clear and achievable.</span><Button type="submit" className="primary-button" disabled={createAction.isPending} data-testid="button-submit-action">{createAction.isPending ? 'Saving…' : 'Create action'} <ArrowRight size={15} /></Button></div>
    </form></Form>
  </section>;
}
function ActionCard({ action, onStatusChange, pending }: { action: Action; onStatusChange: (action: Action, status: ActionStatus) => void; pending: boolean }) {
  const overdue = action.status !== 'Completed' && new Date(`${action.dueDate.slice(0,10)}T23:59:59`) < new Date();
  return <article className={`action-card ${overdue ? 'is-overdue' : ''}`} data-testid={`card-action-${action.id}`}>
    <div className="action-card-top"><span className={`status-chip ${statusTone(action.status)}`} data-testid={`status-action-${action.id}`}><i />{action.status}</span>{overdue && <span className="overdue-chip" data-testid={`status-overdue-${action.id}`}><Clock3 size={13} /> Overdue</span>}</div>
    <h3 data-testid={`data-action-title-${action.id}`}>{action.title}</h3><p className="action-reason">{action.reason}</p>
    <div className="action-meta"><span><span className="meta-label">OWNER</span><strong>{action.assignedTo}</strong></span><span><span className="meta-label">DUE DATE</span><strong className={overdue ? 'due-overdue' : ''}>{dateLabel(action.dueDate)}</strong></span></div>
    <div className="action-status-control"><label htmlFor={`action-status-${action.id}`}>Update status</label><select id={`action-status-${action.id}`} value={action.status} disabled={pending} onChange={event => onStatusChange(action, event.target.value as ActionStatus)} data-testid={`select-action-status-${action.id}`}><option>Not Started</option><option>In Progress</option><option>Completed</option></select><ChevronDown size={15} /></div>
  </article>;
}
function ActionsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useListActions();
  const updateAction = useUpdateAction();
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState('');
  const actions = data ?? [];
  const openActions = actions.filter(action => action.status !== 'Completed');
  const overdueCount = openActions.filter(action => new Date(`${action.dueDate.slice(0,10)}T23:59:59`) < new Date()).length;
  const onStatusChange = (action: Action, status: ActionStatus) => updateAction.mutate({ id: action.id, data: { status } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListActionsQueryKey() }); setNotice(`“${action.title}” updated.`); }, onError: () => setNotice('We couldn’t update that action. Please try again.') });
  return <div className="page-enter">
    <PageHeading eyebrow="LEARNING & FOLLOW-THROUGH" title="Improvement actions" description="Small, clear steps help turn what we learn into safer everyday practice." action={<Button className="primary-button" onClick={() => { setNotice(''); setShowCreate(current => !current); }} data-testid="button-new-action"><FilePlus2 size={17} /> New action</Button>} />
    {notice && <div className="inline-notice" role="status" data-testid="status-action-notice"><CheckCircle2 size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={15} /></button></div>}
    {showCreate && <ActionCreation onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); setNotice('Your improvement action has been created.'); }} />}
    {isLoading ? <><div className="metric-skeletons"><i /><i /><i /></div><SkeletonRows count={4} /></> : isError ? <QueryError message="Your actions are safe. Try again to refresh the list." onRetry={() => refetch()} /> : <>
      <section className="action-summary"><div className="action-summary-main"><span className="summary-icon"><ClipboardCheck size={18} /></span><div><span>OPEN ACTIONS</span><strong data-testid="metric-open-actions">{openActions.length}</strong></div></div><div className={`action-summary-main ${overdueCount ? 'summary-alert' : ''}`}><span className="summary-icon"><Clock3 size={18} /></span><div><span>PAST DUE</span><strong data-testid="metric-overdue-actions">{overdueCount}</strong></div></div><div className="summary-copy">{overdueCount ? 'A quick check-in can help an overdue action move forward.' : 'You’re up to date. Thank you for closing the loop.'}</div></section>
      {actions.length ? <><section className="actions-section"><div className="section-header"><div><span className="panel-kicker">NEEDS FOLLOW-UP</span><h2>Open actions <span>{openActions.length}</span></h2></div><p>Update progress as work moves along.</p></div>{openActions.length ? <div className="actions-grid">{openActions.map(action => <ActionCard key={action.id} action={action} onStatusChange={onStatusChange} pending={updateAction.isPending} />)}</div> : <div className="complete-message"><CheckCircle2 size={19} /><span><strong>All clear for now.</strong> There are no open actions.</span></div>}</section>
        {actions.some(action => action.status === 'Completed') && <section className="actions-section completed-section"><div className="section-header"><div><span className="panel-kicker">CLOSED THE LOOP</span><h2>Completed <span>{actions.filter(action => action.status === 'Completed').length}</span></h2></div></div><div className="actions-grid">{actions.filter(action => action.status === 'Completed').map(action => <ActionCard key={action.id} action={action} onStatusChange={onStatusChange} pending={updateAction.isPending} />)}</div></section>}
      </> : <div className="empty-state action-empty" data-testid="status-actions-empty"><span className="empty-illustration"><ClipboardCheck size={25} /></span><strong>No actions yet</strong><p>When the team identifies a way to improve, add a clear next step here.</p><Button className="primary-button" onClick={() => setShowCreate(true)} data-testid="button-create-first-action"><FilePlus2 size={16} /> Create an action</Button></div>}
    </>}
    <div className="learning-note"><span><ShieldCheck size={17} /></span><p><strong>Keep learning together.</strong> Actions are here to support practical improvements, not to assign blame.</p></div>
  </div>;
}

function CacheOnIdentityChange() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const nextId = user?.id ?? null;
      if (previousId.current !== undefined && previousId.current !== nextId) client.clear();
      previousId.current = nextId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}
function AuthLoading() {
  return <div className="auth-loading" role="status"><img src={`${basePath}/logo.svg`} alt="" /><span>Preparing your private workspace…</span></div>;
}
function LandingPage() {
  return <main className="landing-page">
    <header className="landing-header"><Link href="/" className="landing-brand" data-testid="link-landing-brand"><img src={`${basePath}/logo.svg`} alt="" /><span><strong>Little Oak</strong><small>Care & learning</small></span></Link><span className="landing-confidential"><ShieldCheck size={15} /> Private staff workspace</span></header>
    <section className="landing-hero">
      <div className="landing-copy">
        <div className="eyebrow"><span className="live-indicator" /> A calmer way to learn together</div>
        <h1>Safer days begin<br />with <em>noticing.</em></h1>
        <p>A confidential space for our team to record incidents, follow up with care, and make thoughtful improvements together.</p>
        <Link href="/sign-in" className="landing-cta" data-testid="link-staff-sign-in">Staff sign in <ArrowRight size={17} /></Link>
        <div className="landing-trust"><ShieldCheck size={16} /><span>For Little Oak staff only. Access is provided by your organisation.</span></div>
      </div>
      <div className="landing-art" aria-label="Illustration of a calm, welcoming early-years room">
        <div className="art-sun" /><div className="art-window"><div /><div /><div /><div /></div><div className="art-plant"><i /><i /><i /><b /></div>
        <div className="art-shelf"><span /><span /><span /></div><div className="art-rug" /><div className="art-block block-one">A</div><div className="art-block block-two">B</div>
        <div className="art-quote"><span className="quote-mark">“</span><p>Small observations<br />make a safer place.</p><span className="quote-line" /></div>
      </div>
    </section>
    <section className="landing-values"><div><span className="value-number">01</span><strong>Record with clarity</strong><p>Keep a factual, confidential account of what happened and the care given.</p></div><div><span className="value-number">02</span><strong>Notice the patterns</strong><p>Give managers a helpful view of incidents by room, place and type.</p></div><div><span className="value-number">03</span><strong>Learn and improve</strong><p>Turn shared learning into small actions that support everyday safety.</p></div></section>
    <footer className="landing-footer"><span>Little Oak · Internal staff resource</span><span><ShieldCheck size={14} /> Information is private and used for care and learning.</span></footer>
  </main>;
}
function SignInPage() {
  return <main className="sign-in-page">
    <div className="signin-context"><Link href="/" className="landing-brand" data-testid="link-signin-home"><img src={`${basePath}/logo.svg`} alt="" /><span><strong>Little Oak</strong><small>Care & learning</small></span></Link><p>Good to have you back.</p><span>Sign in to your confidential staff workspace.</span></div>
    <div className="signin-card">
      <SignIn routing="path" path={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/dashboard`} fallbackRedirectUrl={`${basePath}/dashboard`} appearance={clerkAppearance} />
      <div className="signin-confidential"><ShieldCheck size={15} /> Little Oak staff only · Access provided by your organisation</div>
    </div>
  </main>;
}
function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Redirect to="/dashboard" /> : <LandingPage />;
}
function ProtectedRoutes() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (!isSignedIn) return <Redirect to="/" />;
  return <RoutedErrorBoundary><AppShell><Switch>
    <Route path="/dashboard" component={Dashboard} />
    <Route path="/accidents" component={AccidentRegister} />
    <Route path="/accidents/new" component={RecordAccident} />
    <Route path="/actions" component={ActionsPage} />
    <Route component={NotFound} />
  </Switch></AppShell></RoutedErrorBoundary>;
}
function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    routerPush={(to: string) => setLocation(stripBase(to))}
    routerReplace={(to: string) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}><CacheOnIdentityChange /><TooltipProvider>
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/" component={HomeRedirect} />
        <Route component={ProtectedRoutes} />
      </Switch>
      <Toaster />
    </TooltipProvider></QueryClientProvider>
  </ClerkProvider>;
}
function App() {
  return <WouterRouter base={basePath}><ClerkRoutes /></WouterRouter>;
}
export default App;
