export type InterestMethod = 'flat' | 'reducing' | 'interest-free' | 'fixed'
export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'single'

export interface ScheduleInput {
  principal: number
  annualRate: number
  fees: number
  installments: number
  firstDueDate: string
  frequency: Frequency
  method: InterestMethod
  fixedTotal?: number
}

export interface Installment {
  number: number
  dueDate: string
  openingBalance: number
  principalDue: number
  interestDue: number
  feesDue: number
  totalDue: number
  paid: number
  status: 'Upcoming' | 'Due today' | 'Overdue' | 'Paid' | 'Partially paid'
}

export const money = (value: number) =>
  new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(value)

export const normalizeTanzanianPhone = (raw: string) => {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('255') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+255${digits.slice(1)}`
  if (digits.length === 9) return `+255${digits}`
  return raw
}

const addPeriod = (date: Date, frequency: Frequency, index: number) => {
  const next = new Date(date)
  if (frequency === 'weekly') next.setDate(next.getDate() + 7 * index)
  if (frequency === 'biweekly') next.setDate(next.getDate() + 14 * index)
  if (frequency === 'monthly') next.setMonth(next.getMonth() + index)
  return next
}

const round = (n: number) => Math.round(n)

export function generateSchedule(input: ScheduleInput, today = new Date()): Installment[] {
  const count = input.frequency === 'single' ? 1 : Math.max(1, input.installments)
  const first = new Date(`${input.firstDueDate}T12:00:00`)
  const ratePerPeriod = input.frequency === 'weekly'
    ? input.annualRate / 100 / 52
    : input.frequency === 'biweekly'
      ? input.annualRate / 100 / 26
      : input.frequency === 'monthly'
        ? input.annualRate / 100 / 12
        : input.annualRate / 100

  let balance = input.principal
  const flatInterest = round(input.principal * input.annualRate / 100)
  const fixedInterest = Math.max(0, (input.fixedTotal ?? input.principal) - input.principal - input.fees)

  return Array.from({ length: count }, (_, i) => {
    const opening = balance
    const principalDue = i === count - 1 ? balance : round(input.principal / count)
    let interestDue = 0
    if (input.method === 'flat') interestDue = i === count - 1
      ? flatInterest - round(flatInterest / count) * (count - 1)
      : round(flatInterest / count)
    if (input.method === 'reducing') interestDue = round(opening * ratePerPeriod)
    if (input.method === 'fixed') interestDue = i === count - 1
      ? fixedInterest - round(fixedInterest / count) * (count - 1)
      : round(fixedInterest / count)
    const feesDue = i === 0 ? round(input.fees) : 0
    const due = addPeriod(first, input.frequency, i)
    balance = Math.max(0, balance - principalDue)
    const day = due.toISOString().slice(0, 10)
    const current = today.toISOString().slice(0, 10)
    return {
      number: i + 1,
      dueDate: day,
      openingBalance: opening,
      principalDue,
      interestDue,
      feesDue,
      totalDue: principalDue + interestDue + feesDue,
      paid: 0,
      status: day < current ? 'Overdue' : day === current ? 'Due today' : 'Upcoming',
    }
  })
}

export const allocatePayment = (amount: number, due: { penalty: number; fees: number; interest: number; principal: number }) => {
  let remainder = Math.max(0, amount)
  const take = (value: number) => {
    const allocated = Math.min(remainder, Math.max(0, value))
    remainder -= allocated
    return allocated
  }
  return {
    penalty: take(due.penalty),
    fees: take(due.fees),
    interest: take(due.interest),
    principal: take(due.principal),
    overpayment: remainder,
  }
}
