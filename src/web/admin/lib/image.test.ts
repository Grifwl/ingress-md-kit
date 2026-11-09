import { describe, expect, it } from 'vitest';
import { clampCrop, defaultCrop, resizeCrop } from './image';

describe('defaultCrop', () => {
  it('centres the largest square of a landscape image', () => {
    expect(defaultCrop(1000, 600)).toEqual({ x: 200, y: 0, size: 600 });
  });

  it('centres the largest square of a portrait image', () => {
    expect(defaultCrop(600, 1000)).toEqual({ x: 0, y: 200, size: 600 });
  });
});

describe('clampCrop', () => {
  it('keeps a crop inside the image', () => {
    expect(clampCrop({ x: -10, y: 990, size: 100 }, 1000, 1000)).toEqual({
      x: 0,
      y: 900,
      size: 100,
    });
  });

  it('never lets the crop outgrow the image', () => {
    expect(clampCrop({ x: 0, y: 0, size: 5000 }, 800, 600)).toEqual({ x: 0, y: 0, size: 600 });
  });

  it('accepts images smaller than the minimum crop', () => {
    expect(clampCrop({ x: 0, y: 0, size: 1 }, 10, 20).size).toBe(10);
  });
});

describe('resizeCrop', () => {
  it('zooms around the centre', () => {
    expect(resizeCrop({ x: 100, y: 100, size: 200 }, 100, 1000, 1000)).toEqual({
      x: 150,
      y: 150,
      size: 100,
    });
  });

  it('stays inside the image when zooming out near an edge', () => {
    expect(resizeCrop({ x: 0, y: 0, size: 100 }, 300, 1000, 1000)).toEqual({
      x: 0,
      y: 0,
      size: 300,
    });
  });
});
