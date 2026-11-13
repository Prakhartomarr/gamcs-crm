import { dealCardCells, dealFacts, qualification } from '@/utils/gamcs'

describe('GAMCS E65 deal card and qualification', () => {
  const fields = ['contact_name', 'service_summary', 'base_acv', 'probability', 'expected_closure_date', 'deal_owner', 'next_step', 'next_action_date']

  it('folds ACV, probability and close date into one line, INR with lakh grouping', () => {
    const c = dealCardCells({ base_acv: 1200000, probability: 40, expected_closure_date: '2026-11-30' }, fields)
    expect(c.base_acv.label).toBe('₹12,00,000 · 40% · Close 30 Nov 2026')
    expect(c.probability.label).toBe('')
    expect(c.expected_closure_date.label).toBe('')
  })

  it('shows the next action with its due date and flags overdue', () => {
    const c = dealCardCells({ next_step: 'Call Peter', next_action_date: '2000-01-01' }, fields)
    expect(c.next_step.label).toBe('Call Peter')
    expect(c.next_step.overdue).toBe(true)
    expect(c.next_action_date.label).toBe('')
    const later = dealCardCells({ next_action_date: '2999-01-01' }, fields)
    expect(later.next_step.label).toBe('Follow up')
    expect(later.next_step.overdue).toBe(false)
  })

  it('leaves fields a saved board does not show alone', () => {
    const c = dealCardCells({ base_acv: 5 }, ['organization', 'email'])
    expect(c).toEqual({})
  })

  it('counts the five advisory items', () => {
    expect(qualification({}).done).toBe(0)
    const q = qualification({ budget_known: 1, decision_maker: 'CFO', proposal_required: 'No', requirement_description: 'MIS' })
    expect([q.done, q.total]).toEqual([4, 5])
  })

  it('adds owner, source and service to the deal summary', () => {
    const labels = dealFacts({ acv: 10, currency: 'INR', source: 'Referral', service_summary: 'FP&A' }, 'Om').map((f) => f.label)
    expect(labels).toEqual(['ACV', 'Owner', 'Source', 'Service'])
  })
})
