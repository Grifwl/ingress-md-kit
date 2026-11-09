/**
 * Access to the partners stored in D1. As with missions, every read and
 * write that comes from an organiser is scoped to one Mission Day.
 */
import type { PartnerKind, PartnerStatus } from '../../shared/partners';
import type { Language } from '../../shared/rules';
import type { MissionDay, Partner, PartnerStatusChange } from '../../shared/types';
import type { PartnerPatch } from './input';

/** Row of `partners`. */
interface PartnerRow {
  id: string;
  mission_day_id: string;
  name: string;
  kind: PartnerKind;
  contact_person: string;
  contact_email: string;
  why_you: string;
  logo_request_json: string;
  letter_language: Language;
  proposal_token: string;
  status: PartnerStatus;
  logo_key: string | null;
  logo_version: number;
  overlay_key: string | null;
  overlay_version: number;
  approval_key: string | null;
  approval_version: number;
  approval_name: string | null;
}

/** Row of `partner_status_history`. */
interface HistoryRow {
  partner_id: string;
  status: PartnerStatus;
  note: string;
  changed_at: string;
  changed_by: string;
}

/** The files a partner can have. */
export type PartnerFileKind = 'logo' | 'overlay' | 'approval';

/** A stored file of a partner. */
export interface PartnerFile {
  key: string;
  type: string;
  name: string | null;
}

/** Bytes of randomness in a proposal token: 24 characters once encoded. */
const PROPOSAL_TOKEN_BYTES = 18;

/**
 * Creates a proposal token that cannot be guessed.
 *
 * @returns A URL-safe random string.
 */
function generateProposalToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PROPOSAL_TOKEN_BYTES));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Converts a history row.
 *
 * @param row - Database row.
 * @returns The domain object.
 */
function toStatusChange(row: HistoryRow): PartnerStatusChange {
  return {
    status: row.status,
    note: row.note,
    changedAt: row.changed_at,
    changedBy: row.changed_by,
  };
}

/**
 * Converts a partner row. Storage keys stay out of the domain object.
 *
 * @param row - Database row.
 * @param statusHistory - Its status changes, oldest first.
 * @returns The domain object.
 */
function toPartner(row: PartnerRow, statusHistory: PartnerStatusChange[]): Partner {
  return {
    id: row.id,
    missionDayId: row.mission_day_id,
    name: row.name,
    kind: row.kind,
    contactPerson: row.contact_person,
    contactEmail: row.contact_email,
    whyYou: row.why_you,
    logoRequest: JSON.parse(row.logo_request_json),
    letterLanguage: row.letter_language,
    proposalToken: row.proposal_token,
    status: row.status,
    statusHistory,
    hasLogo: row.logo_key !== null,
    logoVersion: row.logo_version,
    hasOverlay: row.overlay_key !== null,
    overlayVersion: row.overlay_version,
    hasApproval: row.approval_key !== null,
    approvalVersion: row.approval_version,
    approvalName: row.approval_name,
  };
}

/**
 * Prepares the statement recording a status change.
 *
 * @param db - D1 binding.
 * @param partnerId - Partner that changed.
 * @param status - New status.
 * @param note - Free comment.
 * @param email - Organiser making the change.
 * @returns The statement.
 */
function historyInsert(
  db: D1Database,
  partnerId: string,
  status: PartnerStatus,
  note: string,
  email: string,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO partner_status_history (partner_id, status, note, changed_at, changed_by)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(partnerId, status, note, new Date().toISOString(), email);
}

/**
 * Lists the partners of a Mission Day.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day to read.
 * @returns The partners, in creation order.
 */
export async function listPartners(db: D1Database, missionDayId: string): Promise<Partner[]> {
  const [partners, history] = await db.batch<PartnerRow | HistoryRow>([
    db.prepare('SELECT * FROM partners WHERE mission_day_id = ? ORDER BY rowid').bind(missionDayId),
    db
      .prepare(
        `SELECT h.* FROM partner_status_history h
         JOIN partners p ON p.id = h.partner_id
         WHERE p.mission_day_id = ?
         ORDER BY h.id`,
      )
      .bind(missionDayId),
  ]);

  const byPartner = new Map<string, PartnerStatusChange[]>();
  for (const row of (history?.results ?? []) as HistoryRow[]) {
    byPartner.set(row.partner_id, [...(byPartner.get(row.partner_id) ?? []), toStatusChange(row)]);
  }
  return ((partners?.results ?? []) as PartnerRow[]).map((row) =>
    toPartner(row, byPartner.get(row.id) ?? []),
  );
}

/**
 * Adds the status history to a partner row.
 *
 * @param db - D1 binding.
 * @param row - Partner row.
 * @returns The complete partner.
 */
async function withHistory(db: D1Database, row: PartnerRow): Promise<Partner> {
  const { results } = await db
    .prepare('SELECT * FROM partner_status_history WHERE partner_id = ? ORDER BY id')
    .bind(row.id)
    .all<HistoryRow>();
  return toPartner(row, results.map(toStatusChange));
}

/**
 * Reads one partner.
 *
 * @param db - D1 binding.
 * @param missionDayId - Mission Day it must belong to.
 * @param partnerId - Partner to read.
 * @returns The partner, or null when not found in that Mission Day.
 */
export async function findPartner(
  db: D1Database,
  missionDayId: string,
  partnerId: string,
): Promise<Partner | null> {
  const row = await db
    .prepare('SELECT * FROM partners WHERE id = ? AND mission_day_id = ?')
    .bind(partnerId, missionDayId)
    .first<PartnerRow>();
  return row === null ? null : withHistory(db, row);
}

/**
 * Finds the partner holding a proposal token.
 *
 * @param db - D1 binding.
 * @param token - Token from a public address.
 * @returns The partner, or null when the token is not valid.
 */
export async function findPartnerByToken(db: D1Database, token: string): Promise<Partner | null> {
  const row = await db
    .prepare('SELECT * FROM partners WHERE proposal_token = ?')
    .bind(token)
    .first<PartnerRow>();
  return row === null ? null : withHistory(db, row);
}

/**
 * Creates a partner. The permission request starts as a copy of the
 * Mission Day's, so it can later be adapted to this partner alone.
 *
 * @param db - D1 binding.
 * @param missionDay - Owning Mission Day.
 * @param input - Validated fields, including the name.
 * @param email - Organiser creating it.
 * @returns The new partner's identifier.
 */
export async function createPartner(
  db: D1Database,
  missionDay: MissionDay,
  input: PartnerPatch & { name: string; letterLanguage: Language },
  email: string,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO partners (id, mission_day_id, name, kind, contact_person, contact_email,
           why_you, logo_request_json, letter_language, proposal_token)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        missionDay.id,
        input.name,
        input.kind ?? 'other',
        input.contactPerson ?? '',
        input.contactEmail ?? '',
        input.whyYou ?? '',
        JSON.stringify(input.logoRequest ?? missionDay.letter.logoRequest),
        input.letterLanguage,
        generateProposalToken(),
      ),
    historyInsert(db, id, 'candidate', '', email),
  ]);
  return id;
}

/**
 * Saves changes to a partner.
 *
 * @param db - D1 binding.
 * @param partner - Current state, which supplies unchanged fields.
 * @param patch - Validated changes.
 */
export async function updatePartner(
  db: D1Database,
  partner: Partner,
  patch: PartnerPatch,
): Promise<void> {
  const next = { ...partner, ...patch };
  await db
    .prepare(
      `UPDATE partners
       SET name = ?, kind = ?, contact_person = ?, contact_email = ?, why_you = ?,
           logo_request_json = ?, letter_language = ?
       WHERE id = ? AND mission_day_id = ?`,
    )
    .bind(
      next.name,
      next.kind,
      next.contactPerson,
      next.contactEmail,
      next.whyYou,
      JSON.stringify(next.logoRequest),
      next.letterLanguage,
      partner.id,
      partner.missionDayId,
    )
    .run();
}

/**
 * Deletes a partner and, through foreign keys, its status history.
 *
 * @param db - D1 binding.
 * @param partner - Partner to delete.
 */
export async function deletePartner(db: D1Database, partner: Partner): Promise<void> {
  await db
    .prepare('DELETE FROM partners WHERE id = ? AND mission_day_id = ?')
    .bind(partner.id, partner.missionDayId)
    .run();
}

/**
 * Records a new status and its place in the history, atomically.
 *
 * @param db - D1 binding.
 * @param partner - Partner that changed.
 * @param status - New status.
 * @param note - Free comment.
 * @param email - Organiser making the change.
 */
export async function changePartnerStatus(
  db: D1Database,
  partner: Partner,
  status: PartnerStatus,
  note: string,
  email: string,
): Promise<void> {
  await db.batch([
    db
      .prepare('UPDATE partners SET status = ? WHERE id = ? AND mission_day_id = ?')
      .bind(status, partner.id, partner.missionDayId),
    historyInsert(db, partner.id, status, note, email),
  ]);
}

/**
 * Replaces the proposal token, which revokes the previous link at once.
 *
 * @param db - D1 binding.
 * @param partner - Partner to change.
 */
export async function regenerateProposalToken(db: D1Database, partner: Partner): Promise<void> {
  await db
    .prepare('UPDATE partners SET proposal_token = ? WHERE id = ? AND mission_day_id = ?')
    .bind(generateProposalToken(), partner.id, partner.missionDayId)
    .run();
}

/**
 * Reads where a partner's file is stored. `kind` is a literal chosen by
 * the routes, never request data, so it is safe in the column names.
 *
 * @param db - D1 binding.
 * @param partnerId - Partner already checked by the caller.
 * @param kind - Which file.
 * @returns The file, or null when there is none.
 */
export async function findPartnerFile(
  db: D1Database,
  partnerId: string,
  kind: PartnerFileKind,
): Promise<PartnerFile | null> {
  const name = kind === 'approval' ? 'approval_name' : 'NULL';
  const row = await db
    .prepare(
      `SELECT ${kind}_key AS key, ${kind}_type AS type, ${name} AS name
              FROM partners WHERE id = ?`,
    )
    .bind(partnerId)
    .first<{ key: string | null; type: string | null; name: string | null }>();
  return row?.key === null || row === null || row.type === null
    ? null
    : { key: row.key, type: row.type, name: row.name };
}

/**
 * Records a newly stored file.
 *
 * @param db - D1 binding.
 * @param partnerId - Partner already checked by the caller.
 * @param kind - Which file.
 * @param file - Storage key, type and, for documents, the original name.
 * @param version - New version number.
 */
export async function savePartnerFile(
  db: D1Database,
  partnerId: string,
  kind: PartnerFileKind,
  file: PartnerFile,
  version: number,
): Promise<void> {
  const nameColumn = kind === 'approval' ? ', approval_name = ?' : '';
  const nameValue = kind === 'approval' ? [file.name] : [];
  await db
    .prepare(
      `UPDATE partners SET ${kind}_key = ?, ${kind}_type = ?, ${kind}_version = ?${nameColumn}
       WHERE id = ?`,
    )
    .bind(file.key, file.type, version, ...nameValue, partnerId)
    .run();
}
