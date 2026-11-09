/**
 * Access to D1. Maps rows to the shared domain types.
 *
 * Every function working on a mission takes the Mission Day identifier and
 * filters by it. That scoping is what keeps one Mission Day's organisers
 * from reaching another's data by guessing a mission identifier.
 */
import type {
  CropRect,
  LetterSections,
  Mission,
  MissionDay,
  MissionDayWithRole,
  MembershipRole,
  Team,
  Waypoint,
} from '../../shared/types';
import type { MissionFormat } from '../../shared/rules';
import type { MissionDayCreateInput, MissionDayPatch, MissionPatch } from './input';

/** Row of `mission_days`. */
interface MissionDayRow {
  id: string;
  slug: string;
  city: string;
  year: number;
  date: string | null;
  format: MissionFormat;
  status: MissionDay['status'];
  team_json: string;
  letter_json: string;
  my_maps_url: string | null;
  participant_view_enabled: number;
}

/** Row of `missions`. */
interface MissionRow {
  id: string;
  mission_day_id: string;
  landmark: string;
  description_json: string;
  photo_key: string | null;
  photo_version: number;
  crop_json: string | null;
  selected: number;
  recommended_order: number | null;
  notes: string;
  colour: string;
}

/** Row of `waypoints`. */
interface WaypointRow {
  mission_id: string;
  position: number;
  portal_guid: string | null;
  title: string;
  lat: number;
  lng: number;
  image_url: string | null;
}

const EMPTY_CONTACT = { codename: '', contact: '' };

// One colour per mission, used on maps and in exports. The list repeats
// after 24 entries because a route is told apart by its neighbours only.
const MISSION_COLOURS = [
  '#e6194b',
  '#3cb44b',
  '#4363d8',
  '#f58231',
  '#911eb4',
  '#008080',
  '#f032e6',
  '#9a6324',
  '#800000',
  '#808000',
  '#000075',
  '#469990',
  '#dc143c',
  '#2e8b57',
  '#1e90ff',
  '#ff8c00',
  '#8a2be2',
  '#20b2aa',
  '#c71585',
  '#a0522d',
  '#b22222',
  '#6b8e23',
  '#191970',
  '#5f9ea0',
];

/**
 * Converts a Mission Day row, filling sections never saved with empty values.
 *
 * @param row - Database row.
 * @returns The domain object.
 */
function toMissionDay(row: MissionDayRow): MissionDay {
  const team: Team = {
    enlPoc: EMPTY_CONTACT,
    resPoc: EMPTY_CONTACT,
    others: [],
    ...(JSON.parse(row.team_json) as Partial<Team>),
  };
  const letter: LetterSections = {
    aboutUs: {},
    whatIsIngress: {},
    whatIsMissionDay: {},
    whyThisCity: {},
    closing: {},
    ...(JSON.parse(row.letter_json) as Partial<LetterSections>),
  };
  return {
    id: row.id,
    slug: row.slug,
    city: row.city,
    year: row.year,
    date: row.date,
    format: row.format,
    status: row.status,
    team,
    letter,
    myMapsUrl: row.my_maps_url,
    participantViewEnabled: row.participant_view_enabled === 1,
  };
}

/**
 * Converts a waypoint row.
 *
 * @param row - Database row.
 * @returns The domain object.
 */
function toWaypoint(row: WaypointRow): Waypoint {
  return {
    position: row.position,
    portalGuid: row.portal_guid,
    title: row.title,
    lat: row.lat,
    lng: row.lng,
    imageUrl: row.image_url,
  };
}

/**
 * Converts a mission row.
 *
 * @param row - Database row.
 * @param waypoints - Its waypoints, in order.
 * @returns The domain object.
 */
function toMission(row: MissionRow, waypoints: Waypoint[]): Mission {
  return {
    id: row.id,
    missionDayId: row.mission_day_id,
    landmark: row.landmark,
    description: JSON.parse(row.description_json),
    photoVersion: row.photo_version,
    hasPhoto: row.photo_key !== null,
    crop: row.crop_json === null ? null : (JSON.parse(row.crop_json) as CropRect),
    selected: row.selected === 1,
    recommendedOrder: row.recommended_order,
    notes: row.notes,
    colour: row.colour,
    waypoints,
  };
}

/**
 * Lists the Mission Days an organiser belongs to.
 *
 * @param db - D1 binding.
 * @param email - Organiser's email.
 * @returns The Mission Days, newest first.
 */
export async function listMissionDaysForOrganiser(
  db: D1Database,
  email: string,
): Promise<MissionDayWithRole[]> {
  const { results } = await db
    .prepare(
      `SELECT md.*, m.role AS role
       FROM mission_days md
       JOIN memberships m ON m.mission_day_id = md.id
       WHERE m.organiser_email = ?
       ORDER BY md.year DESC, md.slug`,
    )
    .bind(email)
    .all<MissionDayRow & { role: MembershipRole }>();
  return results.map((row) => ({ ...toMissionDay(row), role: row.role }));
}

/**
 * Finds a Mission Day together with the requester's role in it.
 *
 * @param db - D1 binding.
 * @param slug - Mission Day slug.
 * @param email - Organiser's email.
 * @returns The Mission Day, or null if it is missing or they are not a member.
 */
export async function findMissionDayForOrganiser(
  db: D1Database,
  slug: string,
  email: string,
): Promise<MissionDayWithRole | null> {
  const row = await db
    .prepare(
      `SELECT md.*, m.role AS role
       FROM mission_days md
       JOIN memberships m ON m.mission_day_id = md.id
       WHERE md.slug = ? AND m.organiser_email = ?`,
    )
    .bind(slug, email)
    .first<MissionDayRow & { role: MembershipRole }>();
  return row === null ? null : { ...toMissionDay(row), role: row.role };
}

/**
 * Tells whether a slug is already taken.
 *
 * @param db - D1 binding.
 * @param slug - Slug to look for.
 * @returns True if a Mission Day uses it.
 */
export async function slugExists(db: D1Database, slug: string): Promise<boolean> {
  const row = await db.prepare('SELECT 1 FROM mission_days WHERE slug = ?').bind(slug).first();
  return row !== null;
}

/**
 * Creates a Mission Day and its first owner in one atomic batch.
 *
 * @param db - D1 binding.
 * @param input - Validated fields.
 * @param ownerEmail - Email of the first owner.
 * @returns The new Mission Day's identifier.
 */
export async function createMissionDay(
  db: D1Database,
  input: MissionDayCreateInput,
  ownerEmail: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare('INSERT INTO mission_days (id, slug, city, year, format) VALUES (?, ?, ?, ?, ?)')
      .bind(id, input.slug, input.city, input.year, input.format),
    db.prepare('INSERT OR IGNORE INTO organisers (email) VALUES (?)').bind(ownerEmail),
    db
      .prepare(
        `INSERT INTO memberships (mission_day_id, organiser_email, role) VALUES (?, ?, 'owner')`,
      )
      .bind(id, ownerEmail),
  ]);
  return id;
}

/**
 * Saves changes to a Mission Day. The column list is fixed in code and
 * only the values are bound, so request data never reaches the SQL text.
 *
 * @param db - D1 binding.
 * @param missionDay - Current state, which supplies unchanged fields.
 * @param patch - Validated changes.
 */
export async function updateMissionDay(
  db: D1Database,
  missionDay: MissionDay,
  patch: MissionDayPatch,
): Promise<void> {
  const next = { ...missionDay, ...patch };
  await db
    .prepare(
      `UPDATE mission_days
       SET city = ?, year = ?, date = ?, format = ?, status = ?,
           team_json = ?, letter_json = ?, my_maps_url = ?
       WHERE id = ?`,
    )
    .bind(
      next.city,
      next.year,
      next.date,
      next.format,
      next.status,
      JSON.stringify(next.team),
      JSON.stringify(next.letter),
      next.myMapsUrl,
      missionDay.id,
    )
    .run();
}

/**
 * Deletes a Mission Day; foreign keys remove everything scoped to it.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day to delete.
 */
export async function deleteMissionDay(db: D1Database, missionDayId: string): Promise<void> {
  await db.prepare('DELETE FROM mission_days WHERE id = ?').bind(missionDayId).run();
}

/**
 * Lists all candidate missions of a Mission Day with their portals.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day to read.
 * @returns The missions in creation order.
 */
export async function listMissions(db: D1Database, missionDayId: string): Promise<Mission[]> {
  const [missions, waypoints] = await db.batch<MissionRow | WaypointRow>([
    db.prepare('SELECT * FROM missions WHERE mission_day_id = ? ORDER BY rowid').bind(missionDayId),
    db
      .prepare(
        `SELECT w.* FROM waypoints w
         JOIN missions m ON m.id = w.mission_id
         WHERE m.mission_day_id = ?
         ORDER BY w.mission_id, w.position`,
      )
      .bind(missionDayId),
  ]);

  const byMission = new Map<string, Waypoint[]>();
  for (const row of (waypoints?.results ?? []) as WaypointRow[]) {
    const list = byMission.get(row.mission_id) ?? [];
    list.push(toWaypoint(row));
    byMission.set(row.mission_id, list);
  }
  return ((missions?.results ?? []) as MissionRow[]).map((row) =>
    toMission(row, byMission.get(row.id) ?? []),
  );
}

/**
 * Reads one mission.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day it must belong to.
 * @param missionId - Mission to read.
 * @returns The mission, or null when not found in that Mission Day.
 */
export async function findMission(
  db: D1Database,
  missionDayId: string,
  missionId: string,
): Promise<Mission | null> {
  const row = await db
    .prepare('SELECT * FROM missions WHERE id = ? AND mission_day_id = ?')
    .bind(missionId, missionDayId)
    .first<MissionRow>();
  if (row === null) {
    return null;
  }
  const { results } = await db
    .prepare('SELECT * FROM waypoints WHERE mission_id = ? ORDER BY position')
    .bind(missionId)
    .all<WaypointRow>();
  return toMission(row, results.map(toWaypoint));
}

/**
 * Creates a candidate mission with the next colour of the palette.
 *
 * @param db - D1 binding.
 * @param missionDayId - Owning Mission Day.
 * @param patch - Initial fields.
 * @returns The new mission's identifier.
 */
export async function createMission(
  db: D1Database,
  missionDayId: string,
  patch: MissionPatch,
): Promise<string> {
  const id = crypto.randomUUID();
  const count = await db
    .prepare('SELECT COUNT(*) AS total FROM missions WHERE mission_day_id = ?')
    .bind(missionDayId)
    .first<number>('total');
  const colour = patch.colour ?? MISSION_COLOURS[(count ?? 0) % MISSION_COLOURS.length]!;
  await db
    .prepare(
      `INSERT INTO missions (id, mission_day_id, landmark, description_json, notes, colour)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      missionDayId,
      patch.landmark ?? '',
      JSON.stringify(patch.description ?? {}),
      patch.notes ?? '',
      colour,
    )
    .run();
  return id;
}

/**
 * Saves changes to a mission.
 *
 * @param db - D1 binding.
 * @param mission - Current state, which supplies unchanged fields.
 * @param patch - Validated changes.
 */
export async function updateMission(
  db: D1Database,
  mission: Mission,
  patch: MissionPatch,
): Promise<void> {
  const next = { ...mission, ...patch };
  await db
    .prepare(
      `UPDATE missions SET landmark = ?, description_json = ?, notes = ?, colour = ?
       WHERE id = ? AND mission_day_id = ?`,
    )
    .bind(
      next.landmark,
      JSON.stringify(next.description),
      next.notes,
      next.colour,
      mission.id,
      mission.missionDayId,
    )
    .run();
}

/**
 * Deletes a mission and, through foreign keys, its waypoints.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day it must belong to.
 * @param missionId - Mission to delete.
 */
export async function deleteMission(
  db: D1Database,
  missionDayId: string,
  missionId: string,
): Promise<void> {
  await db
    .prepare('DELETE FROM missions WHERE id = ? AND mission_day_id = ?')
    .bind(missionId, missionDayId)
    .run();
}

/**
 * Replaces the portal list of a mission atomically. The caller must have
 * confirmed that the mission belongs to the Mission Day being edited.
 *
 * @param db - D1 binding.
 * @param missionId - Mission to change.
 * @param waypoints - New list, in order.
 */
export async function replaceWaypoints(
  db: D1Database,
  missionId: string,
  waypoints: readonly Waypoint[],
): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM waypoints WHERE mission_id = ?').bind(missionId),
    ...waypoints.map((waypoint) =>
      db
        .prepare(
          `INSERT INTO waypoints (mission_id, position, portal_guid, title, lat, lng, image_url)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          missionId,
          waypoint.position,
          waypoint.portalGuid,
          waypoint.title,
          waypoint.lat,
          waypoint.lng,
          waypoint.imageUrl,
        ),
    ),
  ]);
}

/**
 * Returns the R2 key of a mission's current photo.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day it must belong to.
 * @param missionId - Mission to read.
 * @returns The key, or null if there is no photo.
 */
export async function findPhotoKey(
  db: D1Database,
  missionDayId: string,
  missionId: string,
): Promise<string | null> {
  return db
    .prepare('SELECT photo_key FROM missions WHERE id = ? AND mission_day_id = ?')
    .bind(missionId, missionDayId)
    .first<string | null>('photo_key');
}

/**
 * Records a newly stored photo.
 *
 * @param db - D1 binding.
 * @param mission - The mission that owns it.
 * @param photoKey - R2 key of the new photo.
 * @param version - New photo version.
 * @param crop - Region of the original that was used.
 */
export async function savePhoto(
  db: D1Database,
  mission: Mission,
  photoKey: string,
  version: number,
  crop: CropRect,
): Promise<void> {
  await db
    .prepare(
      `UPDATE missions SET photo_key = ?, photo_version = ?, crop_json = ?
       WHERE id = ? AND mission_day_id = ?`,
    )
    .bind(photoKey, version, JSON.stringify(crop), mission.id, mission.missionDayId)
    .run();
}

/**
 * Counts how many of the given missions belong to a Mission Day.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day to check against.
 * @param missionIds - Identifiers received from the client.
 * @returns How many exist within it.
 */
export async function countOwnMissions(
  db: D1Database,
  missionDayId: string,
  missionIds: readonly string[],
): Promise<number> {
  const owned = new Set(
    (
      await db
        .prepare('SELECT id FROM missions WHERE mission_day_id = ?')
        .bind(missionDayId)
        .all<{ id: string }>()
    ).results.map((row) => row.id),
  );
  return missionIds.filter((id) => owned.has(id)).length;
}

/**
 * Stores the final selection in one atomic batch, so that a failure never
 * leaves a half-applied order.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day being edited.
 * @param missionIds - Selected missions, in recommended order.
 */
export async function saveSelection(
  db: D1Database,
  missionDayId: string,
  missionIds: readonly string[],
): Promise<void> {
  await db.batch([
    db
      .prepare(
        'UPDATE missions SET selected = 0, recommended_order = NULL WHERE mission_day_id = ?',
      )
      .bind(missionDayId),
    ...missionIds.map((id, index) =>
      db
        .prepare(
          `UPDATE missions SET selected = 1, recommended_order = ?
           WHERE id = ? AND mission_day_id = ?`,
        )
        .bind(index + 1, id, missionDayId),
    ),
  ]);
}
