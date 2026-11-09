import { describe, expect, it } from 'vitest';
import { parseCoordinates } from './coordinates';

describe('parseCoordinates', () => {
  it.each([
    ['0.5, -1.25', { lat: 0.5, lng: -1.25 }],
    ['0.5 -1.25', { lat: 0.5, lng: -1.25 }],
    ['https://intel.ingress.com/?pll=10.5,20.25', { lat: 10.5, lng: 20.25 }],
    ['https://intel.ingress.com/intel?ll=1,1&z=17&pll=-3.5,4', { lat: -3.5, lng: 4 }],
  ])('reads "%s"', (input, expected) => {
    expect(parseCoordinates(input)).toEqual(expected);
  });

  it.each(['', 'hello', '91, 0', '0, 181', '1,2,3'])('rejects "%s"', (input) => {
    expect(parseCoordinates(input)).toBeNull();
  });
});
