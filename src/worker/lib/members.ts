/**
 * Access to D1 for organisers and the teams of each Mission Day.
 *
 * Every Mission Day must keep at least one owner, otherwise nobody could
 * manage its team or delete it. The statements that could remove the last
 * owner carry that condition inside the SQL itself, so two organisers
 * acting at the same moment can never both succeed.
 */
import type {
  Faction,
  InstanceMissionDay,
  Member,
  MembershipRole,
  OrganiserProfile,
} from '../../shared/types';

/** Row of `organisers`, joined with a membership when listing a team. */
interface MemberRow {
  email: string;
  codename: string | null;
  faction: Faction | null;
  role: MembershipRole;
}

// Counts the owners of the Mission Day bound as the last parameter.
const OWNER_COUNT = `(SELECT COUNT(*) FROM memberships
  WHERE mission_day_id = ? AND role = 'owner')`;

/**
 * Reads an organiser's profile. Someone who has never saved one, or who
 * has no row yet, gets an empty profile rather than an error.
 *
 * @param db - D1 binding.
 * @param email - Lowercase email of the organiser.
 * @returns The profile.
 */
export async function getProfile(db: D1Database, email: string): Promise<OrganiserProfile> {
  const row = await db
    .prepare('SELECT codename, faction FROM organisers WHERE email = ?')
    .bind(email)
    .first<{ codename: string; faction: Faction | null }>();
  return { email, codename: row?.codename ?? '', faction: row?.faction ?? null };
}

/**
 * Saves an organiser's own profile, creating their row if needed.
 *
 * @param db - D1 binding.
 * @param email - Lowercase email of the organiser.
 * @param codename - Agent name.
 * @param faction - Faction, or null when not given.
 */
export async function saveProfile(
  db: D1Database,
  email: string,
  codename: string,
  faction: Faction | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO organisers (email, codename, faction) VALUES (?, ?, ?)
       ON CONFLICT (email) DO UPDATE SET codename = excluded.codename, faction = excluded.faction`,
    )
    .bind(email, codename, faction)
    .run();
}

/**
 * Lists the team of a Mission Day, owners first.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day already checked by the caller.
 * @returns The members.
 */
export async function listMembers(db: D1Database, missionDayId: string): Promise<Member[]> {
  const { results } = await db
    .prepare(
      `SELECT o.email, o.codename, o.faction, m.role
       FROM memberships m
       JOIN organisers o ON o.email = m.organiser_email
       WHERE m.mission_day_id = ?
       ORDER BY m.role = 'owner' DESC, o.email`,
    )
    .bind(missionDayId)
    .all<MemberRow>();
  return results.map((row) => ({
    email: row.email,
    codename: row.codename ?? '',
    faction: row.faction,
    role: row.role,
  }));
}

/**
 * Reads the role of one person in a Mission Day.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day to look in.
 * @param email - Lowercase email.
 * @returns The role, or null when they are not a member.
 */
export async function findRole(
  db: D1Database,
  missionDayId: string,
  email: string,
): Promise<MembershipRole | null> {
  return db
    .prepare('SELECT role FROM memberships WHERE mission_day_id = ? AND organiser_email = ?')
    .bind(missionDayId, email)
    .first<MembershipRole>('role');
}

/**
 * Adds someone to a team. Their organiser row is created if this is the
 * first Mission Day they join; an existing profile is left untouched.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day being edited.
 * @param email - Lowercase email of the new member.
 * @param role - Their role.
 * @returns False when they were already a member.
 */
export async function addMember(
  db: D1Database,
  missionDayId: string,
  email: string,
  role: MembershipRole,
): Promise<boolean> {
  const [, inserted] = await db.batch([
    db.prepare('INSERT OR IGNORE INTO organisers (email) VALUES (?)').bind(email),
    db
      .prepare(
        `INSERT OR IGNORE INTO memberships (mission_day_id, organiser_email, role)
         VALUES (?, ?, ?)`,
      )
      .bind(missionDayId, email, role),
  ]);
  return (inserted?.meta.changes ?? 0) > 0;
}

/** Outcome of a change that must leave at least one owner. */
export type MemberChange = 'done' | 'not_found' | 'last_owner';

/**
 * Tells why a guarded statement changed nothing.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day being edited.
 * @param email - Member the statement aimed at.
 * @param changes - Rows changed by the statement.
 * @returns The outcome.
 */
async function explain(
  db: D1Database,
  missionDayId: string,
  email: string,
  changes: number,
): Promise<MemberChange> {
  if (changes > 0) {
    return 'done';
  }
  return (await findRole(db, missionDayId, email)) === null ? 'not_found' : 'last_owner';
}

/**
 * Changes a member's role. Turning the last owner into an editor is
 * refused; making an owner an owner again changes nothing and succeeds.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day being edited.
 * @param email - Lowercase email of the member.
 * @param role - New role.
 * @returns The outcome.
 */
export async function setMemberRole(
  db: D1Database,
  missionDayId: string,
  email: string,
  role: MembershipRole,
): Promise<MemberChange> {
  const result = await db
    .prepare(
      `UPDATE memberships SET role = ?
       WHERE mission_day_id = ? AND organiser_email = ?
         AND (? = 'owner' OR role <> 'owner' OR ${OWNER_COUNT} > 1)`,
    )
    .bind(role, missionDayId, email, role, missionDayId)
    .run();
  return explain(db, missionDayId, email, result.meta.changes);
}

/**
 * Removes someone from a team, unless they are its last owner. Their
 * organiser row stays, since they may belong to other Mission Days.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day being edited.
 * @param email - Lowercase email of the member.
 * @returns The outcome.
 */
export async function removeMember(
  db: D1Database,
  missionDayId: string,
  email: string,
): Promise<MemberChange> {
  const result = await db
    .prepare(
      `DELETE FROM memberships
       WHERE mission_day_id = ? AND organiser_email = ?
         AND (role <> 'owner' OR ${OWNER_COUNT} > 1)`,
    )
    .bind(missionDayId, email, missionDayId)
    .run();
  return explain(db, missionDayId, email, result.meta.changes);
}

/**
 * Lists every Mission Day of the instance with the requester's role in
 * each. Only for instance administrators.
 *
 * @param db - D1 binding.
 * @param email - Lowercase email of the administrator.
 * @returns The Mission Days, newest first.
 */
export async function listAllMissionDays(
  db: D1Database,
  email: string,
): Promise<InstanceMissionDay[]> {
  const { results } = await db
    .prepare(
      `SELECT md.slug, md.city, md.year, m.role
       FROM mission_days md
       LEFT JOIN memberships m ON m.mission_day_id = md.id AND m.organiser_email = ?
       ORDER BY md.year DESC, md.slug`,
    )
    .bind(email)
    .all<InstanceMissionDay>();
  return results;
}
