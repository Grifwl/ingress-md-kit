import { describe, expect, it } from 'vitest';
import type { Mission } from '../../../shared/types';
import { applySelection, candidatesForList, placeInSelection, selectedInOrder } from './selection';

/**
 * Builds a mission with only the fields these functions read.
 *
 * @param id - Identifier.
 * @param recommendedOrder - Position, or null if not selected.
 * @returns The mission.
 */
function mission(id: string, recommendedOrder: number | null): Mission {
  return { id, recommendedOrder, selected: recommendedOrder !== null } as Mission;
}

describe('placeInSelection', () => {
  it('adds a new mission at the position given', () => {
    expect(placeInSelection(['a', 'b'], 'c', 1)).toEqual(['a', 'c', 'b']);
  });

  it('moves a mission within the list', () => {
    expect(placeInSelection(['a', 'b', 'c'], 'a', 1)).toEqual(['b', 'a', 'c']);
  });

  it('limits positions past either end', () => {
    expect(placeInSelection(['a', 'b'], 'c', 99)).toEqual(['a', 'b', 'c']);
    expect(placeInSelection(['a', 'b'], 'c', -5)).toEqual(['c', 'a', 'b']);
  });
});

describe('selectedInOrder', () => {
  it('sorts selected missions and leaves out the rest', () => {
    const missions = [mission('b', 2), mission('x', null), mission('a', 1)];
    expect(selectedInOrder(missions).map((item) => item.id)).toEqual(['a', 'b']);
  });
});

describe('candidatesForList', () => {
  it('puts selected missions first in order, then the rest as received', () => {
    const missions = [
      mission('first-created', 2),
      mission('not-selected-a', null),
      mission('second-created', 1),
      mission('not-selected-b', null),
    ];
    expect(candidatesForList(missions).map((item) => item.id)).toEqual([
      'second-created',
      'first-created',
      'not-selected-a',
      'not-selected-b',
    ]);
  });
});

describe('applySelection', () => {
  it('sets order and membership, and clears missions left out', () => {
    const result = applySelection([mission('a', 1), mission('b', null)], ['b']);
    expect(result[0]).toMatchObject({ selected: false, recommendedOrder: null });
    expect(result[1]).toMatchObject({ selected: true, recommendedOrder: 1 });
  });
});
