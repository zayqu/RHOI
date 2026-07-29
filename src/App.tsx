import { useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Bell, CalendarDays,
  Check, ChevronRight, CircleDollarSign, ClipboardList, Download, FileText,
  HandCoins, Home, Menu, MessageCircle, MoreHorizontal, Plus, Receipt,
  Search, Settings, ShieldCheck, TrendingUp, UserRound, Users, X
} from 'lucide-react'
import { Frequency, generateSchedule, InterestMethod, money, normalizeTanzanianPhone } from './finance'

type View = 'dashboard' | 'clients' | 'loans' | 'payments' | 'followups' | 'reports' | 'settings'
type Detail = { kind: 'client' | 'loan' | 'receipt'; id: string }

const clients = [
  { id: 'RHC-00241', name: 'Amina Hassan', phone: '+255 754 213 091', initials: 'AH', active: 2, balance: 840000, status: 'Active', tone: 'lime' },
  { id: 'RHC-00240', name: 'Juma Omari', phone: '+255 712 883 440', initials: 'JO', active: 1, balance: 315000, status: 'Follow-up', tone: 'amber' },
  { id: 'RHC-00239', name: 'Neema Joseph', phone: '+255 687 100 219', initials: 'NJ', active: 1, balance: 1260000, status: 'Active', tone: 'blue' },
  { id: 'RHC-00238', name: 'Peter Mushi', phone: '+255 765 901 282', initials: 'PM', active: 0, balance: 0, status: 'Settled', tone: 'slate' },
]

const loans = [
  { id: 'RHL-1038', client: 'Amina Hassan', principal: 1000000, balance: 840000, next: '31 Jul', status: 'On track', progress: 16 },
  { id: 'RHL-1037', client: 'Juma Omari', principal: 500000, balance: 315000, next: 'Today', status: 'Due today', progress: 37 },
  { id: 'RHL-1036', client: 'Neema Joseph', principal: 1500000, balance: 1260000, next: '26 Jul', status: 'Overdue', progress: 16 },
  { id: 'RHL-1035', client: 'Rehema Ally', principal: 800000, balance: 280000, next: '02 Aug', status: 'On track', progress: 65 },
]

const payments = [
  { receipt: 'RCP-00891', client: 'Amina Hassan', loan: 'RHL-1038', amount: 160000, method: 'M-Pesa', time: 'Today, 09:42' },
  { receipt: 'RCP-00890', client: 'Rehema Ally', loan: 'RHL-1035', amount: 120000, method: 'Cash', time: 'Yesterday, 16:10' },
  { receipt: 'RCP-00889', client: 'Juma Omari', loan: 'RHL-1037', amount: 65000, method: 'Tigo Pesa', time: '28 Jul, 11:03' },
]

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
          <div className="profile"><div className="avatar lime">ZM</div><div><strong>Zayqu M.</strong><small>Owner / Admin</small></div><MoreHorizontal size={18} /></div>
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
          {notifications && <div className="notification-panel"><div><strong>Notifications</strong><button className="text-btn" onClick={() => { setNotifications(false); notify('All notifications marked as read') }}>Mark all read</button></div><button onClick={() => { setView('followups'); setNotifications(false) }}><AlertTriangle /><span><b>6 loans are overdue</b><small>Review today’s follow-up queue</small></span></button><button onClick={() => { setView('payments'); setNotifications(false) }}><Receipt /><span><b>Payment received</b><small>Amina Hassan · {money(160000)}</small></span></button></div>}
          <button className="primary desktop-only" onClick={() => setSheet('payment')}><Plus size={18} /> Record payment</button>
        </header>

        <div className="content">
          {view === 'dashboard' && <Dashboard setView={setView} open={setSheet} notify={notify} />}
          {view === 'clients' && <Clients open={setSheet} showDetail={id => setDetail({ kind: 'client', id })} notify={notify} />}
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

      {sheet && <Modal type={sheet} close={() => setSheet(null)} notify={notify} />}
      {detail && <DetailModal detail={detail} close={() => setDetail(null)} openPayment={() => { setDetail(null); setSheet('payment') }} />}
      {toast && <div className="toast"><Check size={18} />{toast}</div>}
    </div>
  )
}

function PageTitle({ eyebrow, title, copy, action }: { eyebrow?: string; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="page-title"><div>{eyebrow && <small>{eyebrow}</small>}<h1>{title}</h1><p>{copy}</p></div>{action}</div>
}

function Dashboard({ setView, open, notify }: { setView: (v: View) => void; open: (v: 'loan' | 'payment' | 'client') => void; notify: (s: string) => void }) {
  return <>
    <PageTitle eyebrow="Wednesday, 29 July" title="Good morning, Zayqu." copy="Here’s what needs your attention today."
      action={<button className="primary" onClick={() => open('loan')}><Plus size={18} /> New loan</button>} />

    <section className="metrics">
      <article className="metric hero-metric"><div className="metric-icon"><CircleDollarSign /></div><span>Outstanding portfolio</span><h2>{money(8426000)}</h2><p><ArrowUpRight /> 4.8% from last month</p><i className="spark" /></article>
      <article className="metric"><div className="metric-icon"><CalendarDays /></div><span>Due this week</span><h2>{money(1245000)}</h2><p className="muted">Across 12 instalments</p></article>
      <article className="metric alert-metric"><div className="metric-icon"><AlertTriangle /></div><span>Overdue</span><h2>{money(680000)}</h2><p className="negative"><ArrowDownRight /> 6 clients need follow-up</p></article>
      <article className="metric"><div className="metric-icon"><Activity /></div><span>Collected this month</span><h2>{money(3160000)}</h2><p><ArrowUpRight /> 12.5% vs last month</p></article>
    </section>

    <section className="attention">
      <div className="section-heading"><div><span className="eyebrow">Priority queue</span><h2>Needs attention</h2></div><button className="text-btn" onClick={() => setView('followups')}>View all <ChevronRight /></button></div>
      <div className="attention-grid">
        <article className="attention-card urgent"><div className="avatar amber">NJ</div><div className="grow"><div><strong>Neema Joseph</strong><Status value="8 days overdue" /></div><p>Instalment #3 · {money(240000)}</p><small>Last contacted 3 days ago</small></div><button className="secondary" onClick={() => notify('WhatsApp follow-up opened')}><MessageCircle size={17} /> Follow up</button></article>
        <article className="attention-card"><div className="avatar blue">JO</div><div className="grow"><div><strong>Juma Omari</strong><Status value="Due today" /></div><p>Instalment #5 · {money(95000)}</p><small>Promise to pay by 4:00 PM</small></div><button className="secondary" onClick={() => open('payment')}><Receipt size={17} /> Record</button></article>
      </div>
    </section>

    <div className="two-col">
      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">Cash flow</span><h2>Collections</h2></div><select aria-label="Chart period"><option>Last 6 months</option></select></div>
        <div className="chart" aria-label="Collections chart">
          {[44, 61, 54, 75, 67, 89].map((height, i) => <div key={i}><i style={{ height: `${height}%` }} /><span>{['Feb','Mar','Apr','May','Jun','Jul'][i]}</span></div>)}
        </div>
      </section>
      <section className="panel">
        <div className="section-heading"><div><span className="eyebrow">Latest</span><h2>Recent payments</h2></div><button className="text-btn" onClick={() => setView('payments')}>View all <ChevronRight /></button></div>
        <div className="compact-list">{payments.map(p => <div key={p.receipt}><div className="mini-icon"><ArrowDownRight /></div><div><strong>{p.client}</strong><small>{p.method} · {p.time}</small></div><b>{money(p.amount)}</b></div>)}</div>
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

function Clients({ open, showDetail, notify }: { open: (v: 'client') => void; showDetail: (id: string) => void; notify: (s: string) => void }) {
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
    <div className="followup-board">
      {[
        ['Overdue', '6 accounts', 'Neema Joseph', '8 days late', 240000],
        ['Promises today', '3 accounts', 'Juma Omari', 'Due by 4:00 PM', 95000],
        ['Due soon', '12 accounts', 'Amina Hassan', 'Due in 2 days', 160000],
      ].map(([title, count, name, detail, amount]) => <section className="panel" key={title as string}><div className="section-heading"><h2>{title}</h2><span className="count">{count}</span></div><article className="followup-item"><div className="avatar lime">{(name as string).split(' ').map(n => n[0]).join('')}</div><div><strong>{name}</strong><small>{detail} · {money(amount as number)}</small></div><button className="icon-btn" onClick={() => notify(`Follow-up logged for ${name}`)}><MessageCircle /></button></article></section>)}
    </div>
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
    <div className="report-grid">{cards.map(([title, copy, Icon]) => <button className="report-card" key={title} onClick={() => { downloadCsv(`${title.toLowerCase().replace(/ /g, '-')}.csv`, [['RHOI report', title], ['Generated', new Date().toISOString()], ['Outstanding portfolio TZS', 8426000], ['Collected this month TZS', 3160000], ['Overdue TZS', 680000]]); notify(`${title} downloaded`) }}><i><Icon /></i><div><h3>{title}</h3><p>{copy}</p></div><Download /></button>)}</div>
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

function DetailModal({ detail, close, openPayment }: { detail: Detail; close: () => void; openPayment: () => void }) {
  const client = detail.kind === 'client' ? clients.find(item => item.id === detail.id) : undefined
  const loan = detail.kind === 'loan' ? loans.find(item => item.id === detail.id) : undefined
  const payment = detail.kind === 'receipt' ? payments.find(item => item.receipt === detail.id) : undefined
  const title = client?.name ?? loan?.client ?? payment?.receipt ?? 'Record'
  return <div className="modal-wrap" role="dialog" aria-modal="true" aria-label={`${detail.kind} details`}><div className="backdrop" onClick={close} /><section className="modal detail-modal">
    <div className="modal-head"><div><span className="eyebrow">{detail.kind} record</span><h2>{title}</h2></div><button className="icon-btn" onClick={close} aria-label="Close details"><X /></button></div>
    <div className="detail-body">
      {client && <><div className="detail-hero"><div className="avatar lime">{client.initials}</div><div><h3>{client.name}</h3><p>{client.phone} · {client.id}</p></div><Status value={client.status} /></div><dl><div><dt>Active loans</dt><dd>{client.active}</dd></div><div><dt>Outstanding</dt><dd>{money(client.balance)}</dd></div><div><dt>Notification</dt><dd>WhatsApp</dd></div><div><dt>Identity status</dt><dd>Verified</dd></div></dl></>}
      {loan && <><div className="detail-hero"><div className="mini-icon"><HandCoins /></div><div><h3>{loan.id}</h3><p>{loan.client}</p></div><Status value={loan.status} /></div><dl><div><dt>Principal</dt><dd>{money(loan.principal)}</dd></div><div><dt>Outstanding</dt><dd>{money(loan.balance)}</dd></div><div><dt>Repaid</dt><dd>{loan.progress}%</dd></div><div><dt>Next due</dt><dd>{loan.next}</dd></div></dl><div className="progress"><i style={{ width: `${loan.progress}%` }} /></div></>}
      {payment && <><div className="receipt-mark"><Check /><span>Payment received</span></div><dl><div><dt>Client</dt><dd>{payment.client}</dd></div><div><dt>Loan</dt><dd>{payment.loan}</dd></div><div><dt>Amount</dt><dd>{money(payment.amount)}</dd></div><div><dt>Method</dt><dd>{payment.method}</dd></div><div><dt>Date</dt><dd>{payment.time}</dd></div><div><dt>Receipt</dt><dd>{payment.receipt}</dd></div></dl><button className="secondary" onClick={() => window.print()}><FileText /> Print receipt</button></>}
    </div>
    <div className="modal-actions"><button className="secondary" onClick={close}>Close</button>{detail.kind !== 'receipt' && <button className="primary" onClick={openPayment}><Receipt /> Record payment</button>}</div>
  </section></div>
}

function Modal({ type, close, notify }: { type: 'loan' | 'payment' | 'client'; close: () => void; notify: (s: string) => void }) {
  const [step, setStep] = useState(1)
  const [principal, setPrincipal] = useState(1000000)
  const [rate, setRate] = useState(12)
  const [fees, setFees] = useState(10000)
  const [installments, setInstallments] = useState(6)
  const [method, setMethod] = useState<InterestMethod>('flat')
  const [frequency, setFrequency] = useState<Frequency>('monthly')
  const schedule = useMemo(() => generateSchedule({ principal, annualRate: rate, fees, installments, method, frequency, firstDueDate: '2026-08-31' }), [principal, rate, fees, installments, method, frequency])
  const total = schedule.reduce((s, i) => s + i.totalDue, 0)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    notify(type === 'loan' ? 'Loan draft created' : type === 'payment' ? 'Payment recorded and receipt created' : 'Client profile created')
    close()
  }

  return <div className="modal-wrap" role="dialog" aria-modal="true"><div className="backdrop" onClick={close} /><form className="modal" onSubmit={submit}>
    <div className="modal-head"><div><span className="eyebrow">{type === 'loan' ? `Step ${step} of 2` : 'Secure entry'}</span><h2>{type === 'loan' ? 'Create a new loan' : type === 'payment' ? 'Record payment' : 'Add a client'}</h2></div><button className="icon-btn" type="button" onClick={close}><X /></button></div>
    {type === 'client' && <div className="form-grid">
      <label>Full name<input required placeholder="e.g. Asha Mussa" /></label>
      <label>Mobile number<input required defaultValue="+255 " onBlur={e => e.currentTarget.value = normalizeTanzanianPhone(e.currentTarget.value)} /></label>
      <label>National ID<input placeholder="Optional" /></label><label>Occupation<input placeholder="Business or employment" /></label>
      <label className="wide">Physical address<textarea placeholder="Street, ward, district, region" /></label>
    </div>}
    {type === 'payment' && <div className="form-grid">
      <label className="wide">Client / loan<select><option>Amina Hassan · RHL-1038</option><option>Juma Omari · RHL-1037</option></select></label>
      <label>Amount received (TZS)<input required type="number" defaultValue="160000" /></label><label>Payment date<input type="date" defaultValue="2026-07-29" /></label>
      <label>Method<select><option>M-Pesa</option><option>Cash</option><option>Tigo Pesa</option><option>Bank transfer</option></select></label><label>Transaction reference<input placeholder="Unique reference" /></label>
      <div className="allocation wide"><strong>Automatic allocation</strong><span>Penalty <b>{money(0)}</b></span><span>Fees <b>{money(10000)}</b></span><span>Interest <b>{money(20000)}</b></span><span>Principal <b>{money(130000)}</b></span></div>
    </div>}
    {type === 'loan' && step === 1 && <div className="form-grid">
      <label className="wide">Borrower<select><option>Amina Hassan · RHC-00241</option><option>Juma Omari · RHC-00240</option></select></label>
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
