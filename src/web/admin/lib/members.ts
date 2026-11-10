/**
 * How organisers are named on screen.
 */
import type { Member, MembershipRole } from '../../../shared/types';

/**
 * Names an organiser by codename when the team knows one, and by email
 * otherwise, which also covers people who have since left the team.
 *
 * @param email - Email recorded for the action.
 * @param members - Current team.
 * @returns The text to display.
 */
export function organiserName(email: string, members: readonly Member[]): string {
  const codename = members.find((member) => member.email === email)?.codename ?? '';
  return codename === '' ? email : codename;
}

/**
 * Tells whether a change of role would leave the team without an owner,
 * so that the screen can disable it instead of waiting for the refusal.
 *
 * @param members - Current team.
 * @param email - Member whose role would change, or who would leave.
 * @param role - New role, or null when they would leave.
 * @returns True when the change would remove the last owner.
 */
export function removesLastOwner(
  members: readonly Member[],
  email: string,
  role: MembershipRole | null,
): boolean {
  const owners = members.filter((member) => member.role === 'owner');
  return role !== 'owner' && owners.length === 1 && owners[0]!.email === email;
}
