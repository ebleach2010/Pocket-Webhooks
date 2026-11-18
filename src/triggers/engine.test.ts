import { describe, expect, it } from 'vitest';

import { matchTriggers } from './engine';

const phrases = { calendar: ['add to my calendar', 'calendar this'] };

describe('matchTriggers', () => {
  it('finds a phrase inside free text', () => {
    expect(matchTriggers('Please add to my calendar dinner at 8', phrases)).toEqual({
      calendar: ['add to my calendar'],
    });
  });

  it('is punctuation- and case-insensitive', () => {
    expect(matchTriggers('Calendar, THIS please!', phrases)).toEqual({
      calendar: ['calendar this'],
    });
  });

  it('returns nothing when no phrase matches', () => {
    expect(matchTriggers('just a normal note', phrases)).toEqual({});
  });
});
