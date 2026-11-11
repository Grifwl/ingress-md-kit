import { describe, expect, it } from 'vitest';
import { parseRoute } from './routes';

describe('parseRoute', () => {
  it.each([
    ['/admin', { name: 'home' }],
    ['/admin/', { name: 'home' }],
    ['/admin/new', { name: 'newMissionDay' }],
    ['/admin/new/extra', { name: 'notFound' }],
    ['/admin/letter-defaults', { name: 'letterDefaults' }],
    ['/admin/letter-defaults/extra', { name: 'notFound' }],
    ['/admin/instance', { name: 'instanceSettings' }],
    ['/admin/instance/extra', { name: 'notFound' }],
    ['/admin/example-2027', { name: 'missions', slug: 'example-2027' }],
    ['/admin/example-2027/missions', { name: 'missions', slug: 'example-2027' }],
    ['/admin/example-2027/missions/m1', { name: 'mission', slug: 'example-2027', missionId: 'm1' }],
    ['/admin/example-2027/partners', { name: 'partners', slug: 'example-2027' }],
    ['/admin/example-2027/partners/p1', { name: 'partner', slug: 'example-2027', partnerId: 'p1' }],
    ['/admin/example-2027/exports', { name: 'exports', slug: 'example-2027' }],
    ['/admin/example-2027/map', { name: 'map', slug: 'example-2027' }],
    ['/admin/example-2027/selection', { name: 'selection', slug: 'example-2027' }],
    ['/admin/example-2027/settings', { name: 'settings', slug: 'example-2027' }],
    ['/admin/example-2027/team', { name: 'team', slug: 'example-2027' }],
    ['/admin/profile', { name: 'profile' }],
    ['/admin/profile/extra', { name: 'notFound' }],
    ['/admin/example-2027/unknown', { name: 'notFound' }],
    ['/admin/example-2027/map/extra', { name: 'notFound' }],
    ['/admin/example-2027/missions/m1/extra', { name: 'notFound' }],
    ['/elsewhere', { name: 'notFound' }],
  ])('parses %s', (path, expected) => {
    expect(parseRoute(path)).toEqual(expected);
  });
});
