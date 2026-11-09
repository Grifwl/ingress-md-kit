/**
 * Fixed vocabularies describing a partner, shared by the Worker and the
 * frontend. "Partner" is the handbook's term for an entity that lets the
 * Mission Day use its logo; no money is implied.
 */

/** Kinds of entity that can be a partner. */
export const PARTNER_KINDS = [
  'city',
  'university',
  'tourism_board',
  'museum',
  'ngo',
  'other',
] as const;

/** A kind of partner. */
export type PartnerKind = (typeof PARTNER_KINDS)[number];

/** Stages of the conversation with a partner, in their usual order. */
export const PARTNER_STATUSES = [
  'candidate',
  'contacted',
  'in_talks',
  'accepted',
  'declined',
] as const;

/** A stage of the conversation with a partner. */
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];
