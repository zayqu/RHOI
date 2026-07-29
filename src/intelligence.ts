export interface IntelligenceClient {
  id: string
  name: string
  phone: string
  status: string
}

export interface IntelligenceLoan {
  id: string
  client: string
  balance: number
  status: string
  next: string
}

export interface IntelligencePayment {
  receipt: string
  client: string
  amount: number
  unallocated?: number
  reversed?: boolean
}

export interface PortfolioInsight {
  id: string
  severity: 'urgent' | 'warning' | 'info'
  title: string
  detail: string
  action: string
}

export function analyzePortfolio(
  clients: IntelligenceClient[],
  loans: IntelligenceLoan[],
  payments: IntelligencePayment[],
): PortfolioInsight[] {
  const insights: PortfolioInsight[] = []
  const phoneOwners = new Map<string, IntelligenceClient[]>()
  clients.forEach(client => {
    const normalized = client.phone.replace(/\D/g, '').slice(-9)
    phoneOwners.set(normalized, [...(phoneOwners.get(normalized) ?? []), client])
  })
  phoneOwners.forEach(matches => {
    if (matches.length > 1) {
      insights.push({
        id: `duplicate-${matches[0].phone}`,
        severity: 'warning',
        title: 'Possible duplicate clients',
        detail: `${matches.map(client => client.name).join(', ')} share ${matches[0].phone}.`,
        action: 'Review profiles before issuing another loan.',
      })
    }
  })

  loans.filter(loan => loan.status.toLowerCase() === 'overdue').forEach(loan => {
    insights.push({
      id: `overdue-${loan.id}`,
      severity: 'urgent',
      title: `${loan.client} needs follow-up`,
      detail: `${loan.id} is overdue with ${Math.round(loan.balance).toLocaleString('en-TZ')} TZS outstanding.`,
      action: 'Confirm the reason for delay and record a next action.',
    })
  })

  payments.filter(payment => Number(payment.unallocated ?? 0) > 0 && !payment.reversed).forEach(payment => {
    insights.push({
      id: `unallocated-${payment.receipt}`,
      severity: 'warning',
      title: 'Payment has an unallocated balance',
      detail: `${payment.receipt} has ${Math.round(payment.unallocated ?? 0).toLocaleString('en-TZ')} TZS not applied to scheduled debt.`,
      action: 'Review the loan balance and refund or document the excess.',
    })
  })

  const restrictedWithDebt = clients.filter(client => ['restricted', 'blacklisted'].includes(client.status.toLowerCase()))
  restrictedWithDebt.forEach(client => {
    const balance = loans.filter(loan => loan.client === client.name).reduce((sum, loan) => sum + loan.balance, 0)
    if (balance > 0) insights.push({
      id: `restricted-${client.id}`,
      severity: 'urgent',
      title: `${client.name} is restricted with an open balance`,
      detail: `${Math.round(balance).toLocaleString('en-TZ')} TZS remains outstanding.`,
      action: 'Do not issue new credit; review the account with an authorized user.',
    })
  })

  if (!insights.length && (clients.length || loans.length || payments.length)) {
    insights.push({
      id: 'portfolio-clear',
      severity: 'info',
      title: 'No immediate data risks detected',
      detail: 'Current records have no duplicate phone, overdue loan, restricted-balance, or unallocated-payment signals.',
      action: 'Continue monitoring upcoming instalments.',
    })
  }
  return insights
}
