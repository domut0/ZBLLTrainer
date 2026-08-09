// `readFilter` is the only piece of Issue 10 that has to cope with data written
// by the previous version of the app. Everything else keys off the case id,
// which did not change; the stored drill filter did.
import { describe, expect, it } from 'vitest'
import { readFilter } from './DrillView'
import { groupsInAlgSet } from '@/data'

const firstGroup = groupsInAlgSet('ZBLL')[0]

describe('readFilter', () => {
  it('defaults when there is nothing stored', () => {
    expect(readFilter(null, 'ZBLL')).toEqual({ type: 'all', subset: 'T', group: firstGroup })
  })

  it('defaults rather than throwing on junk', () => {
    expect(readFilter('not json', 'ZBLL').type).toBe('all')
    expect(readFilter('null', 'ZBLL').type).toBe('all')
    expect(readFilter('[]', 'ZBLL').type).toBe('all')
  })

  // The pre-Issue-10 shape. `type: 'set'` meant what is now `type: 'subset'`,
  // and the subset lived under a key called `set`. A user who had picked "Set
  // Pi" must still find themselves on Pi after the update.
  it('migrates the old set-shaped filter', () => {
    const stored = JSON.stringify({ type: 'set', set: 'Pi', group: firstGroup })
    expect(readFilter(stored, 'ZBLL')).toEqual({
      type: 'subset',
      subset: 'Pi',
      group: firstGroup,
    })
  })

  it('leaves the other old filter types alone', () => {
    for (const type of ['all', 'group', 'slowest'] as const) {
      const stored = JSON.stringify({ type, set: 'H', group: firstGroup })
      expect(readFilter(stored, 'ZBLL').type).toBe(type)
    }
  })

  /**
   * A subset or group belonging to a different set would filter the pool down
   * to nothing, and the empty state says "you have ticked nothing" — which is a
   * lie the user cannot debug. Falling back to the set's own default is the
   * recoverable failure.
   */
  it('discards a subset the current set does not have', () => {
    const stored = JSON.stringify({ type: 'subset', subset: 'not-a-zbll-subset', group: firstGroup })
    expect(readFilter(stored, 'ZBLL').subset).toBe('T')
  })

  it('discards a group the current set does not have', () => {
    const stored = JSON.stringify({ type: 'group', subset: 'T', group: 'LXS 12: nonsense' })
    expect(readFilter(stored, 'ZBLL').group).toBe(firstGroup)
  })
})
