import { describe, expect, it } from 'vitest'
import { allocatePayment, generateSchedule, normalizeTanzanianPhone } from './finance'

describe('RHOI finance engine', () => {
  it('normalizes Tanzanian mobile numbers', () => {
    expect(normalizeTanzanianPhone('0712 345 678')).toBe('+255712345678')
  })
  it('keeps flat principal exact after rounding', () => {
    const schedule = generateSchedule({ principal: 1_000_000, annualRate: 12, fees: 10_000, installments: 3, firstDueDate: '2027-01-01', frequency: 'monthly', method: 'flat' })
    expect(schedule.reduce((sum, item) => sum + item.principalDue, 0)).toBe(1_000_000)
    expect(schedule.reduce((sum, item) => sum + item.interestDue, 0)).toBe(120_000)
  })
  it('allocates payments in configured priority', () => {
    expect(allocatePayment(75, { penalty: 10, fees: 20, interest: 30, principal: 100 }))
      .toEqual({ penalty: 10, fees: 20, interest: 30, principal: 15, overpayment: 0 })
  })
})
