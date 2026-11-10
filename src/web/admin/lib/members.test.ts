import { describe, expect, it } from 'vitest';
import type { Member } from '../../../shared/types';
import { organiserName, removesLastOwner } from './members';

const OWNER: Member = { email: 'a@example.org', codename: 'Alpha', faction: 'RES', role: 'owner' };
const EDITOR: Member = { email: 'b@example.org', codename: '', faction: null, role: 'editor' };

describe('organiserName', () => {
  it('prefers the codename and falls back to the email', () => {
    expect(organiserName(OWNER.email, [OWNER, EDITOR])).toBe('Alpha');
    expect(organiserName(EDITOR.email, [OWNER, EDITOR])).toBe(EDITOR.email);
    expect(organiserName('gone@example.org', [OWNER])).toBe('gone@example.org');
  });
});

describe('removesLastOwner', () => {
  it('flags demoting or removing the only owner', () => {
    expect(removesLastOwner([OWNER, EDITOR], OWNER.email, 'editor')).toBe(true);
    expect(removesLastOwner([OWNER, EDITOR], OWNER.email, null)).toBe(true);
  });

  it('allows changes that keep an owner', () => {
    expect(removesLastOwner([OWNER, EDITOR], EDITOR.email, null)).toBe(false);
    expect(removesLastOwner([OWNER, EDITOR], OWNER.email, 'owner')).toBe(false);
    const second = { ...EDITOR, role: 'owner' as const };
    expect(removesLastOwner([OWNER, second], OWNER.email, null)).toBe(false);
  });
});
