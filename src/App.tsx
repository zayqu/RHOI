import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, CalendarDays,
  Check, ChevronRight, CircleDollarSign, ClipboardList, Download, FileText,
  HandCoins, Home, Menu, MessageCircle, MoreHorizontal, Plus, Receipt,
  Search, Settings, ShieldCheck, TrendingUp, UserRound, Users, X
} from 'lucide-react'
import { Frequency, generateSchedule, InterestMethod, money, normalizeTanzanianPhone } from './finance'
import { clientNumber, isSupabaseConfigured, supabase } from './supabase'

type View = 'dashboard' | 'clients' | 'loans' | 'payments' | 'followups' | 'reports' | 'settings'
type Detail = { kind: 'client' | 'loan' | 'receipt'; id: string }
interface UiClient {
  dbId?: string
  id: string
  name: string
  phone: string
  initials: string
  active: number
  balance: number
  status: string
  tone: string
}
interface UiLoan {
  id: string
  client: string
  principal: number
  balance: number
  next: string
  status: string
  progress: number
}
interface UiPayment {
  receipt: string
  client: string
  loan: string
  amount: number
  method: string
  time: string
}

const initialClients: UiClient[] = []
const loans: UiLoan[] = []
const payments: UiPayment[] = []

const nav = [
  { id: 'dashboard' as View, label: 'Overview', icon: Home },
  { id: 'clients' as View, label: 'Clients', icon: Users },
  { id: 'loans' as View, label: 'Loans', icon: HandCoins },
  { id: 'payments' as View, label: 'Payments', icon: Receipt },
  { id: 'followups' as View, label: 'Follow-ups', icon: MessageCircle },
  { id: 'reports' as View, label: 'Reports', icon: TrendingUp },
]

function Logo() {
  return <div className="logo"><span>R</span><strong>RHOI</strong></div>
}

function Status({ value }: { value: string }) {
  const style = value.toLowerCase().replace(/ /g, '-')
  return <span className={`status ${style}`}>{value}</span>
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [clients, setClients] = useState(() => {
    if (isSupabaseConfigured) return initialClients
    try {
      const saved = localStorage.getItem('rhoi-clients-v1')
      return saved ? JSON.parse(saved) as UiClient[] : initialClients
    } catch {
      return initialClients
    }
  })
  const [view, setView] = useState<View>('dashboard')
  const [sheet, setSheet] = useState<'loan' | 'payment' | 'client' | null>(null)
  const [detail, setDetail] = useState<Detail | null>(null)
  const [menu, setMenu] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return [
      ...clients.filter(item => `${item.name} ${item.phone} ${item.id}`.toLowerCase().includes(q)).map(item => ({ kind: 'client' as const, id: item.id, label: item.name, meta: item.id })),
      ...loans.filter(item => `${item.client} ${item.id}`.toLowerCase().includes(q)).map(item => ({ kind: 'loan' as const, id: item.id, label: item.client, meta: item.id })),
      ...payments.filter(item => `${item.client} ${item.receipt} ${item.loan}`.toLowerCase().includes(q)).map(item => ({ kind: 'receipt' as const, id: item.receipt, label: item.client, meta: item.receipt })),
    ].slice(0, 6)
  }, [query])

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) return
    const client = supabase
    const load = async () => {
      const profileResult = await client.from('profiles').select('organization_id').eq('id', session.user.id).single()
      if (profileResult.error) {
        notify(`Profile error: ${profileResult.error.message}`)
        return
      }
      setOrganizationId(profileResult.data.organization_id)
      const clientResult = await client.from('clients').select('*').order('created_at', { ascending: false })
      if (clientResult.error) {
        notify(`Client loading error: ${clientResult.error.message}`)
        return
      }
      setClients(clientResult.data.map(row => ({
        dbId: row.id,
        id: row.client_number,
        name: row.full_name,
        phone: row.phone,
        initials: row.full_name.split(/\s+/).slice(0, 2).map((part: string) => part[0]?.toUpperCase()).join(''),
        active: 0,
        balance: 0,
        status: row.status.charAt(0).toUpperCase() + row.status.slice(1),
        tone: 'lime',
      })))
    }
    void load()
  }, [session])

  const addClient = async (client: UiClient) => {
    if (supabase && session && organizationId) {
      const result = await supabase.from('clients').insert({
        organization_id: organizationId,
        client_number: client.id,
        full_name: client.name,
        phone: client.phone,
        status: 'active',
        created_by: session.user.id,
      }).select('id').single()
      if (result.error) throw result.error
      setClients(current => [{ ...client, dbId: result.data.id }, ...current])
      return
    }
    setClients(current => {
      const next = [client, ...current]
      localStorage.setItem('rhoi-clients-v1', JSON.stringify(next))
      return next
    })
  }
  const updateClient = async (updated: UiClient) => {
    if (supabase && updated.dbId) {
      const result = await supabase.from('clients').update({
        full_name: updated.name,
        phone: normalizeTanzanianPhone(updated.phone),
        status: updated.status.toLowerCase(),
        updated_at: new Date().toISOString(),
      }).eq('id', updated.dbId)
      if (result.error) throw result.error
    }
    setClients(current => {
      const next = current.map(client => client.id === updated.id ? updated : client)
      if (!supabase) localStorage.setItem('rhoi-clients-v1', JSON.stringify(next))
      return next
    })
  }

  if (!authReady) return <div className="auth-loading"><Logo /><p>Connecting securely…</p></div>
  if (isSupabaseConfigured && !session) return <AuthScreen notify={notify} />

  return (
    <div className="app-shell">
      <aside className={menu ? 'sidebar open' : 'sidebar'}>
        <div className="side-head"><Logo /><button className="icon-btn close-menu" onClick={() => setMenu(false)}><X /></button></div>
        <nav>
          <p className="nav-label">Workspace</p>
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? 'nav-item active' : 'nav-item'} onClick={() => { setView(id); setMenu(false) }}>
              <Icon size={19} /><span>{label}</span>{id === 'followups' && <b>4</b>}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button className={view === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => { setView('settings'); setMenu(false) }}><Settings size={19} /><span>Settings</span></button>
          <button className="profile profile-button" onClick={() => supabase?.auth.signOut()}><div className="avatar lime">ZM</div><div><strong>{session?.user.user_metadata.full_name ?? 'RHOI Owner'}</strong><small>Owner / Admin · Sign out</small></div><MoreHorizontal size={18} /></button>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenu(true)}><Menu /></button>
          <div className="mobile-logo"><Logo /></div>
          <div className="search global-search"><Search size={18} /><input aria-label="Search RHOI" placeholder="Search clients, loans, receipts…" value={query} onChange={event => setQuery(event.target.value)} />
            {query && <div className="search-results">{searchResults.length ? searchResults.map(result => <button key={`${result.kind}-${result.id}`} onClick={() => { setDetail({ kind: result.kind, id: result.id }); setQuery('') }}><span>{result.label}</span><small>{result.meta}</small></button>) : <p>No matching records</p>}</div>}
          </div>
          <button className="icon-btn bell" aria-label="Notifications" onClick={() => setNotifications(value => !value)}><Bell size={20} /><i /></button>
          {notifications && <div className="notification-panel"><div><strong>Notifications</strong><button className="text-btn" onClick={() => { setNotifications(false); notify('Notifications reviewed') }}>Close</button></div><div className="empty-state">No new notifications.</div></div>}
          <button className="primary desktop-only" onClick={() => setSheet('payment')}><Plus size={18} /> Record payment</button>
        </header>

        <div className="content">
          {view === 'dashboard' && <Dashboard loans={loans} payments={payments} setView={setView} open={setSheet} />}
          {view === 'clients' && <Clients clients={clients} open={setSheet} showDetail={id => setDetail({ kind: 'client', id })} notify={notify} />}
          {view === 'loans' && <Loans open={setSheet} showDetail={id => setDetail({ kind: 'loan', id })} />}
          {view === 'payments' && <Payments open={setSheet} showDetail={id => setDetail({ kind: 'receipt', id })} notify={notify} />}
          {view === 'followups' && <Followups notify={notify} />}
          {view === 'reports' && <Reports notify={notify} />}
          {view === 'settings' && <SettingsPage notify={notify} />}
        </div>

        <button className="fab" onClick={() => setSheet('payment')} aria-label="Record payment"><Plus /></button>
        <nav className="bottom-nav">
          {nav.slice(0, 4).map(({ id, label, icon: Icon }) => (
            <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon /><span>{label}</span></button>
          ))}
        </nav>
      </main>

      {sheet && <Modal clients={clients} type={sheet} close={() => setSheet(null)} notify={notify} onClientCreated={addClient} />}
      {detail && <DetailModal clients={clients} detail={detail} close={() => setDetail(null)} openPayment={() => { setDetail(null); setSheet('payment') }} updateClient={updateClient} notify={notify} />}
      {toast && <div className="toast"><Check size={18} />{toast}</div>}
    </div>
  )
}

function AuthScreen({ notify }: { notify: (message: string) => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    const values = new FormData(event.currentTarget)
    const email = String(values.get('email') ?? '').trim()
    const password = String(values.get('password') ?? '')
    if (mode === 'signin') {
      const result = await supabase.auth.signInWithPassword({ email, password })
      if (result.error) setMessage(result.error.message)
      else notify('Signed in securely')
    } else {
      const fullName = String(values.get('fullName') ?? '').trim()
      const result = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: fullName, organization_name: 'RHOI' },
        },
      })
      if (result.error) setMessage(result.error.message)
      else setMessage(result.data.session ? 'Owner account created.' : 'Check your email to confirm the owner account, then sign in.')
    }
    setBusy(false)
  }

  return <main className="auth-page">
    <section className="auth-brand"><Logo /><div><span className="eyebrow">Secure lending operations</span><h1>Know every balance.<br />Follow every payment.</h1><p>RHOI keeps client records, loan schedules, collections and follow-ups in one protected workspace.</p></div><small>Database access is protected by Supabase authentication and Row-Level Security.</small></section>
    <section className="auth-panel"><form onSubmit={submit}>
      <span className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'First-time setup'}</span>
      <h2>{mode === 'signin' ? 'Sign in to RHOI' : 'Create owner account'}</h2>
      <p>{mode === 'signin' ? 'Use your authorized account to continue.' : 'The first account will own a new RHOI organization.'}</p>
      {mode === 'signup' && <label>Full name<input name="fullName" required autoComplete="name" placeholder="Your full name" /></label>}
      <label>Email address<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label>
      <label>Password<input name="password" type="password" minLength={8} required autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" /></label>
      {message && <div className="auth-message">{message}</div>}
      <button className="primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in securely' : 'Create owner account'}</button>
      <button className="auth-switch" type="button" onClick={() => { setMode(current => current === 'signin' ? 'signup' : 'signin'); setMessage('') }}>{mode === 'signin' ? 'First time? Create the owner account' : 'Already registered? Sign in'}</button>
    </form></section>
  </main>
}

function PageTitle({ eyebrow, title, copy, action }: { eyebrow?: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="page-title"><div>{eyebrow && <small>{eyebrow}</small>}<h1>{title}</h1><p>{copy}</p></div>{action}</div>
}

function Dashboard({ loans, payments, setView, open }: { loans: UiLoan[]; payments: UiPayment[]; setView: (v: View) => void; open: (v: 'loan' | 'payment' | 'client') => void }) {
  const outstanding = loans.reduce((sum, loan) => sum + loan.balance, 0)
  const overdueLoans = loans.filter(loan => loan.status.toLowerCase() === 'overdue')
  const overdue = overdueLoans.reduce((sum, loan) => sum + loan.balance, 0)
  const collected = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const todayLabel = new Intl.DateTimeFormat('en-TZ', { timeZone: 'Africa/Dar_es_Salaam', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return <>
    <PageTitle eyebrow={todayLabel} title="Portfolio overview" copy="Live information from your RHOI database."
      action={<button className="primary" onClick={() => open('loan')}><Plus size={18} /> New loan</button>} />

    <section className="metrics">
      <article className="metric hero-metric"><div className="metric-icon"><CircleDollarSign /></div><span>Outstanding portfolio</span><h2>{money(outstanding)}</h2><p>{loans.length} active records</p><i className="spark" /></article>
      <article className="metric"><div className="metric-icon"><CalendarDays /></div><span>Due this week</span><h2>{money(0)}</h2><p className="muted">Calculated from live schedules</p></article>
      <article className="metric alert-metric"><div className="metric-icon"><AlertTriangle /></div><span>Overdue</span><h2>{money(overdue)}</h2><p className={overdueLoans.length ? 'negative' : 'muted'}>{overdueLoans.length} loans need follow-up</p></article>
      <article className="metric"><div className="metric-icon"><Activity /></div><span>Total collected</span><h2>{money(collected)}</h2><p className="muted">{payments.length} payment records</p></article>
    </section>

    <section className="attention">
      <div className="section-heading"><div><span className="eyebrow">Priority queue</span><h2>Needs attention</h2></div><button className="text-btn" onClick={() => setView('followups')}>View all <ChevronRight /></button></div>
      <div className="attention-grid">{overdueLoans.length ? overdueLoans.slice(0, 2).map(loan => <article className="attention-card urgent" key={loan.id}><div className="avatar amber">{loan.client.split(/\s+/).slice(0, 2).map(part => part[0]).join('')}</div><div className="grow"><div><strong>{loan.client}</strong><Status value="Overdue" /></div><p>{loan.id} · {money(loan.balance)}</p><small>Requires follow-up</small></div><button className="secondary" onClick={() => setView('followups')}><MessageCircle size={17} /> Follow up</button></article>) : <div className="empty-state panel">No accounts currently require attention.</div>}</div>
    </section>

    <div className="two-col">
      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">Cash flow</span><h2>Collections</h2></div><select aria-label="Chart period"><option>Last 6 months</option></select></div>
        <div className="chart empty-chart" aria-label="Collections chart"><p>Collection trends will appear after payments are recorded.</p></div>
      </section>
      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">Latest</span><h2>Recent payments</h2></div><button className="text-btn" onClick={() => setView('payments')}>View all <ChevronRight /></button></div>
        <div className="compact-list">{payments.length ? payments.slice(0, 5).map(p => <div key={p.receipt}><div className="mini-icon"><ArrowDownRight /></div><div><strong>{p.client}</strong><small>{p.method} · {p.time}</small></div><b>{money(p.amount)}</b></div>) : <div className="empty-state">No payments recorded yet.</div>}</div>
      </section>
    </div>
  </>
}

const downloadCsv = (filename: string, rows: Array<Array<string | number>>) => {
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function Clients({ clients, open, showDetail, notify }: { clients: UiClient[]; open: (v: 'client') => void; showDetail: (id: string) => void; notify: (s: string) => void }) {
  const [filter, setFilter] = useState('')
  const visible = clients.filter(client => `${client.name} ${client.phone} ${client.id}`.toLowerCase().includes(filter.toLowerCase()))
  const exportClients = () => {
    downloadCsv('rhoi-clients.csv', [['Client number', 'Name', 'Phone', 'Active loans', 'Outstanding TZS', 'Status'], ...clients.map(c => [c.id, c.name, c.phone, c.active, c.balance, c.status])])
    notify('Client CSV downloaded')
  }
  return <>
    <PageTitle title="Clients" copy="Manage borrowers, contacts, documents and borrowing history." action={<button className="primary" onClick={() => open('client')}><Plus /> Add client</button>} />
    <section className="panel table-panel">
      <div className="table-tools"><div className="search inner"><Search /><input aria-label="Filter clients" placeholder="Search name, phone or ID…" value={filter} onChange={event => setFilter(event.target.value)} /></div><button className="secondary" onClick={exportClients}><Download /> Export CSV</button></div>
      <div className="data-table">
        <div className="tr th"><span>Client</span><span>Client no.</span><span>Active loans</span><span>Outstanding</span><span>Status</span><span /></div>
        {visible.map(c => <div className="tr" key={c.id}><span className="person"><i className={`avatar ${c.tone}`}>{c.initials}</i><b>{c.name}<small>{c.phone}</small></b></span><span>{c.id}</span><span>{c.active}</span><span><b>{money(c.balance)}</b></span><span><Status value={c.status} /></span><button className="icon-btn" aria-label={`View ${c.name}`} onClick={() => showDetail(c.id)}><ChevronRight /></button></div>)}
        {!visible.length && <div className="empty-state">No clients match your search.</div>}
      </div>
    </section>
  </>
}

function Loans({ open, showDetail }: { open: (v: 'loan') => void; showDetail: (id: string) => void }) {
  return <>
    <PageTitle title="Loans" copy="Monitor every facility, schedule and outstanding balance." action={<button className="primary" onClick={() => open('loan')}><Plus /> New loan</button>} />
    <div className="loan-grid">{loans.map(l => <article className="loan-card" key={l.id}>
      <div className="loan-top"><span>{l.id}</span><Status value={l.status} /></div><h3>{l.client}</h3>
      <div className="loan-numbers"><div><small>Outstanding</small><b>{money(l.balance)}</b></div><div><small>Original</small><b>{money(l.principal)}</b></div></div>
      <div className="progress"><i style={{ width: `${l.progress}%` }} /></div>
      <footer><span>Next due</span><b>{l.next}</b><button onClick={() => showDetail(l.id)}>View loan <ChevronRight /></button></footer>
    </article>)}</div>
  </>
}

function Payments({ open, showDetail, notify }: { open: (v: 'payment') => void; showDetail: (id: string) => void; notify: (s: string) => void }) {
  const [filter, setFilter] = useState('')
  const visible = payments.filter(payment => `${payment.receipt} ${payment.client} ${payment.loan} ${payment.method}`.toLowerCase().includes(filter.toLowerCase()))
  const exportPayments = () => {
    downloadCsv('rhoi-payments.csv', [['Receipt', 'Client', 'Loan', 'Method', 'Date', 'Amount TZS'], ...payments.map(p => [p.receipt, p.client, p.loan, p.method, p.time, p.amount])])
    notify('Payment CSV downloaded')
  }
  return <>
    <PageTitle title="Payments" copy="Traceable collection records, allocations and receipts." action={<button className="primary" onClick={() => open('payment')}><Plus /> Record payment</button>} />
    <section className="panel table-panel">
      <div className="table-tools"><div className="search inner"><Search /><input aria-label="Filter payments" placeholder="Search receipt, client or reference…" value={filter} onChange={event => setFilter(event.target.value)} /></div><button className="secondary" onClick={exportPayments}><Download /> Export</button></div>
      <div className="data-table payments-table"><div className="tr th"><span>Receipt</span><span>Client</span><span>Loan</span><span>Method</span><span>Date</span><span>Amount</span></div>
        {visible.map(p => <button className="tr payment-row" key={p.receipt} onClick={() => showDetail(p.receipt)}><span><b>{p.receipt}</b></span><span>{p.client}</span><span>{p.loan}</span><span><Status value={p.method} /></span><span>{p.time}</span><span><b>{money(p.amount)}</b></span></button>)}
        {!visible.length && <div className="empty-state">No payments match your search.</div>}
      </div>
    </section>
  </>
}

function Followups({ notify }: { notify: (s: string) => void }) {
  return <>
    <PageTitle title="Follow-ups" copy="A focused queue of overdue accounts and promises to pay." />
    <section className="panel empty-state"><MessageCircle /><h2>No follow-ups yet</h2><p>Live collection priorities will appear after loan schedules and follow-up records are created.</p><button className="secondary" onClick={() => notify('Follow-up creation will be enabled with loan persistence')}>Add follow-up</button></section>
  </>
}

function Reports({ notify }: { notify: (s: string) => void }) {
  const cards = [
    ['Portfolio summary', 'Balances, arrears and portfolio quality', TrendingUp],
    ['Collections report', 'Principal, interest, fees and penalties', HandCoins],
    ['Repayment register', 'Every schedule and allocation', ClipboardList],
    ['Audit trail', 'Immutable financial activity history', ShieldCheck],
  ] as const
  return <>
    <PageTitle title="Reports" copy="Understand performance, cash flow and portfolio risk." />
    <div className="report-grid">{cards.map(([title, copy, Icon]) => <button className="report-card" key={title} onClick={() => { downloadCsv(`${title.toLowerCase().replace(/ /g, '-')}.csv`, [['RHOI report', title], ['Generated', new Date().toISOString()], ['Status', 'No qualifying live records']]); notify(`${title} downloaded`) }}><i><Icon /></i><div><h3>{title}</h3><p>{copy}</p></div><Download /></button>)}</div>
  </>
}

function SettingsPage({ notify }: { notify: (s: string) => void }) {
  const [saved, setSaved] = useState({ reminderDays: '3', timeout: '15', allocation: 'Penalty, fees, interest, principal' })
  return <>
    <PageTitle title="Settings" copy="Configure portfolio rules, reminders and security preferences." />
    <form className="panel settings-form" onSubmit={event => { event.preventDefault(); notify('Settings saved successfully') }}>
      <div><h2>Loan rules</h2><p>Defaults applied to newly created loans.</p></div>
      <label>Reminder lead time (days)<input type="number" min="0" value={saved.reminderDays} onChange={event => setSaved({ ...saved, reminderDays: event.target.value })} /></label>
      <label>Payment allocation order<select value={saved.allocation} onChange={event => setSaved({ ...saved, allocation: event.target.value })}><option>Penalty, fees, interest, principal</option><option>Principal, interest, fees, penalty</option></select></label>
      <label>Session timeout (minutes)<select value={saved.timeout} onChange={event => setSaved({ ...saved, timeout: event.target.value })}><option>15</option><option>30</option><option>60</option></select></label>
      <button className="primary" type="submit">Save settings</button>
    </form>
  </>
}

function DetailModal({ clients, detail, close, openPayment, updateClient, notify }: { clients: UiClient[]; detail: Detail; close: () => void; openPayment: () => void; updateClient: (client: UiClient) => Promise<void>; notify: (message: string) => void }) {
  const client = detail.kind === 'client' ? clients.find(item => item.id === detail.id) : undefined
  const loan = detail.kind === 'loan' ? loans.find(item => item.id === detail.id) : undefined
  const payment = detail.kind === 'receipt' ? payments.find(item => item.receipt === detail.id) : undefined
  const title = client?.name ?? loan?.client ?? payment?.receipt ?? 'Record'
  const [editing, setEditing] = useState(false)
  const saveClient = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!client) return
    const values = new FormData(event.currentTarget)
    const name = String(values.get('name') ?? '').trim()
    const phone = normalizeTanzanianPhone(String(values.get('phone') ?? '').trim())
    const status = String(values.get('status') ?? 'Active')
    try {
      await updateClient({ ...client, name, phone, status, initials: name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') })
      notify('Client updated successfully')
      setEditing(false)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Unable to update client')
    }
  }
  return <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={`${detail.kind} details`}><div className="backdrop" onClick={close} /><section className="modal detail-modal">
    <div className="modal-head"><div><span className="eyebrow">{detail.kind} record</span><h2>{title}</h2></div><button className="icon-btn" onClick={close} aria-label="Close details"><X /></button></div>
    <div className="detail-body">
      {client && !editing && <><div className="detail-hero"><div className="avatar lime">{client.initials}</div><div><h3>{client.name}</h3><p>{client.phone} · {client.id}</p></div><Status value={client.status} /></div><dl><div><dt>Active loans</dt><dd>{client.active}</dd></div><div><dt>Outstanding</dt><dd>{money(client.balance)}</dd></div><div><dt>Notification</dt><dd>WhatsApp</dd></div><div><dt>Identity status</dt><dd>Verified</dd></div></dl><button className="secondary" onClick={() => setEditing(true)}>Edit client</button></>}
      {client && editing && <form className="detail-edit" onSubmit={saveClient}><label>Full name<input name="name" required defaultValue={client.name} /></label><label>Phone number<input name="phone" required defaultValue={client.phone} /></label><label>Status<select name="status" defaultValue={client.status}><option>Active</option><option>Inactive</option><option>Restricted</option><option>Blacklisted</option></select></label><div><button className="secondary" type="button" onClick={() => setEditing(false)}>Cancel</button><button className="primary">Save changes</button></div></form>}
      {loan && <><div className="detail-hero"><div className="mini-icon"><HandCoins /></div><div><h3>{loan.id}</h3><p>{loan.client}</p></div><Status value={loan.status} /></div><dl><div><dt>Principal</dt><dd>{money(loan.principal)}</dd></div><div><dt>Outstanding</dt><dd>{money(loan.balance)}</dd></div><div><dt>Repaid</dt><dd>{loan.progress}%</dd></div><div><dt>Next due</dt><dd>{loan.next}</dd></div></dl><div className="progress"><i style={{ width: `${loan.progress}%` }} /></div></>}
      {payment && <><div className="receipt-mark"><Check /><span>Payment received</span></div><dl><div><dt>Client</dt><dd>{payment.client}</dd></div><div><dt>Loan</dt><dd>{payment.loan}</dd></div><div><dt>Amount</dt><dd>{money(payment.amount)}</dd></div><div><dt>Method</dt><dd>{payment.method}</dd></div><div><dt>Date</dt><dd>{payment.time}</dd></div><div><dt>Receipt</dt><dd>{payment.receipt}</dd></div></dl><button className="secondary" onClick={() => window.print()}><FileText /> Print receipt</button></>}
    </div>
    <div className="modal-actions"><button className="secondary" onClick={close}>Close</button>{detail.kind !== 'receipt' && !editing && <button className="primary" onClick={openPayment}><Receipt /> Record payment</button>}</div>
  </section></div>
}

function Modal({ clients, type, close, notify, onClientCreated }: { clients: UiClient[]; type: 'loan' | 'payment' | 'client'; close: () => void; notify: (s: string) => void; onClientCreated: (client: UiClient) => Promise<void> }) {
  const [step, setStep] = useState(1)
  const [principal, setPrincipal] = useState(1000000)
  const [rate, setRate] = useState(12)
  const [fees, setFees] = useState(10000)
  const [installments, setInstallments] = useState(6)
  const [method, setMethod] = useState<InterestMethod>('flat')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const firstDueDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const schedule = useMemo(() => generateSchedule({ principal, annualRate: rate, fees, installments, method, frequency, firstDueDate }), [principal, rate, fees, installments, method, frequency, firstDueDate])
  const total = schedule.reduce((s, i) => s + i.totalDue, 0)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (type === 'client') {
      const values = new FormData(event.currentTarget as HTMLFormElement)
      const name = String(values.get('fullName') ?? '').trim()
      const phone = normalizeTanzanianPhone(String(values.get('phone') ?? '').trim())
      if (!name || !phone) return
      try {
        await onClientCreated({
          id: clientNumber(),
          name,
          phone,
          initials: name.split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join(''),
          active: 0,
          balance: 0,
          status: 'Active',
          tone: 'lime',
        })
      } catch (error) {
        notify(error instanceof Error ? error.message : 'Unable to create client')
        return
      }
    }
    notify(type === 'loan' ? 'Loan draft created' : type === 'payment' ? 'Payment recorded and receipt created' : 'Client profile created')
    close()
  }

  return <div className="modal-wrap" role="dialog" aria-modal="true"><div className="backdrop" onClick={close} /><form className="modal" onSubmit={submit}>
    <div className="modal-head"><div><span className="eyebrow">{type === 'loan' ? `Step ${step} of 2` : 'Secure entry'}</span><h2>{type === 'loan' ? 'Create a new loan' : type === 'payment' ? 'Record payment' : 'Add a client'}</h2></div><button className="icon-btn" type="button" onClick={close}><X /></button></div>
    {type === 'client' && <div className="form-grid">
      <label>Full name<input name="fullName" required placeholder="e.g. Asha Mussa" /></label>
      <label>Mobile number<input name="phone" required defaultValue="+255 " onBlur={e => e.currentTarget.value = normalizeTanzanianPhone(e.currentTarget.value)} /></label>
      <label>National ID<input name="nationalId" placeholder="Optional" /></label><label>Occupation<input name="occupation" placeholder="Business or employment" /></label>
      <label className="wide">Physical address<textarea name="address" placeholder="Street, ward, district, region" /></label>
    </div>}
    {type === 'payment' && <div className="form-grid">
      <label className="wide">Client / loan<select required><option value="">Select an active loan</option></select></label>
      <label>Amount received (TZS)<input required type="number" min="1" /></label><label>Payment date<input type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
      <label>Method<select><option>M-Pesa</option><option>Cash</option><option>Tigo Pesa</option><option>Bank transfer</option></select></label><label>Transaction reference<input placeholder="Unique reference" /></label>
      <div className="allocation wide"><strong>Automatic allocation</strong><span>Penalty <b>{money(0)}</b></span><span>Fees <b>{money(10000)}</b></span><span>Interest <b>{money(20000)}</b></span><span>Principal <b>{money(130000)}</b></span></div>
    </div>}
    {type === 'loan' && step === 1 && <div className="form-grid">
      <label className="wide">Borrower<select required defaultValue=""><option value="" disabled>Select a client</option>{clients.map(client => <option value={client.dbId ?? client.id} key={client.id}>{client.name} · {client.id}</option>)}</select></label>
      <label>Principal (TZS)<input type="number" value={principal} onChange={e => setPrincipal(+e.target.value)} /></label>
      <label>Interest method<select value={method} onChange={e => setMethod(e.target.value as InterestMethod)}><option value="flat">Flat rate</option><option value="reducing">Reducing balance</option><option value="interest-free">Interest free</option><option value="fixed">Fixed total</option></select></label>
      <label>Annual rate (%)<input type="number" value={rate} onChange={e => setRate(+e.target.value)} disabled={method === 'interest-free'} /></label>
      <label>Fees (TZS)<input type="number" value={fees} onChange={e => setFees(+e.target.value)} /></label>
      <label>Frequency<select value={frequency} onChange={e => setFrequency(e.target.value as Frequency)}><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="single">Single repayment</option></select></label>
      <label>Instalments<input type="number" min="1" value={installments} onChange={e => setInstallments(+e.target.value)} /></label>
    </div>}
    {type === 'loan' && step === 2 && <div className="preview">
      <div className="preview-summary"><span>Principal<b>{money(principal)}</b></span><span>Interest & fees<b>{money(total - principal)}</b></span><span>Total repayable<b>{money(total)}</b></span></div>
      <div className="schedule"><div><b>#</b><b>Due date</b><b>Principal</b><b>Total</b></div>{schedule.slice(0, 6).map(i => <div key={i.number}><span>{i.number}</span><span>{i.dueDate}</span><span>{money(i.principalDue)}</span><b>{money(i.totalDue)}</b></div>)}</div>
    </div>}
    <div className="modal-actions"><button className="secondary" type="button" onClick={step === 2 ? () => setStep(1) : close}>{step === 2 ? 'Back' : 'Cancel'}</button>{type === 'loan' && step === 1 ? <button className="primary" type="button" onClick={() => setStep(2)}>Preview schedule <ChevronRight /></button> : <button className="primary" type="submit">{type === 'payment' ? 'Record & issue receipt' : type === 'client' ? 'Create client' : 'Create loan'}</button>}</div>
  </form></div>
}

export default App
