import { describe, expect, it } from 'vitest'
import { analyzePortfolio } from './intelligence'

describe('portfolio intelligence', () => {
  it('detects duplicate phone numbers', () => {
    const insights = analyzePortfolio([
      { id: '1', name: 'A', phone: '+255 712 000 000', status: 'Active' },
      { id: '2', name: 'B', phone: '0712000000', status: 'Active' },
    ], [], [])
    expect(insights.some(item => item.id.startsWith('duplicate-'))).toBe(true)
  })

  it('prioritizes overdue balances and unallocated payments', () => {
    const insights = analyzePortfolio([], [
      { id: 'L1', client: 'A', balance: 50000, status: 'Overdue', next: '2026-01-01' },
    ], [
      { receipt: 'R1', client: 'A', amount: 70000, unallocated: 20000 },
    ])
    expect(insights.filter(item => item.severity !== 'info')).toHaveLength(2)
  })

  it('returns a clear signal when live data has no detected risks', () => {
    const insights = analyzePortfolio([
      { id: '1', name: 'A', phone: '+255712000000', status: 'Active' },
    ], [], [])
    expect(insights[0].id).toBe('portfolio-clear')
  })
})
