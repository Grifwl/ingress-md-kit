/**
 * Team of a Mission Day, mounted at /api/admin/mission-days/:slug/members.
 *
 * Any member can see who else is on the team. Only owners add, change or
 * remove members, and anyone can leave a team by removing themself. An
 * instance administrator may manage any team, even one they are not part
 * of, so that a Mission Day whose owners have all gone can be recovered;
 * that is the only part of a Mission Day open to them without membership.
 */
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { MembershipRole } from '../../shared/types';
import type { AppVariables, Env } from '../env';
import { isInstanceAdmin } from '../lib/access';
import { findMissionDayBySlug } from '../lib/db';
import { parseMemberCreate, parseMemberRole } from '../lib/input';
import {
  addMember,
  findRole,
  listMembers,
  removeMember,
  setMemberRole,
  type MemberChange,
} from '../lib/members';
import { jsonBody } from './helpers';

/** Variables of these routes: the requester's role may be absent here. */
interface TeamEnv {
  Bindings: Env;
  Variables: Pick<AppVariables, 'email' | 'missionDay'> & {
    teamRole: MembershipRole | null;
    canManageTeam: boolean;
  };
}

/** Context of a request to these routes. */
type TeamContext = Context<TeamEnv>;

/**
 * Loads the Mission Day and decides what the requester may do with its
 * team. Someone who is neither a member nor an instance administrator
 * gets the same answer as for a Mission Day that does not exist.
 *
 * @param c - Request context.
 * @param next - Next handler.
 */
const loadTeam: MiddlewareHandler<TeamEnv> = async (c, next) => {
  const missionDay = await findMissionDayBySlug(c.env.DB, c.req.param('slug') ?? '');
  const email = c.get('email');
  const role = missionDay === null ? null : await findRole(c.env.DB, missionDay.id, email);
  const admin = isInstanceAdmin(email, c.env);
  if (missionDay === null || (role === null && !admin)) {
    throw new HTTPException(404, { message: 'not_found' });
  }
  c.set('missionDay', missionDay);
  c.set('teamRole', role);
  c.set('canManageTeam', role === 'owner' || admin);
  await next();
};

/**
 * Stops the request unless the requester may manage the team.
 *
 * @param c - Request context.
 */
function assertManager(c: TeamContext): void {
  if (!c.get('canManageTeam')) {
    throw new HTTPException(403, { message: 'owner_required' });
  }
}

/**
 * Turns the outcome of a guarded change into a response.
 *
 * @param c - Request context.
 * @param outcome - What the database reported.
 * @returns The updated team.
 */
async function answerChange(c: TeamContext, outcome: MemberChange): Promise<Response> {
  if (outcome === 'not_found') {
    throw new HTTPException(404, { message: 'not_found' });
  }
  if (outcome === 'last_owner') {
    throw new HTTPException(409, { message: 'last_owner' });
  }
  return c.json(await listMembers(c.env.DB, c.get('missionDay').id));
}

/**
 * Reads the member named in the path. Hono has already decoded it.
 *
 * @param c - Request context.
 * @returns The lowercase email.
 */
function memberParam(c: TeamContext): string {
  return (c.req.param('email') ?? '').trim().toLowerCase();
}

const members = new Hono<TeamEnv>();
members.use('*', loadTeam);

members.get('/', async (c) => c.json(await listMembers(c.env.DB, c.get('missionDay').id)));

members.post('/', async (c) => {
  assertManager(c);
  const { email, role } = parseMemberCreate(await jsonBody(c));
  const { id } = c.get('missionDay');
  if (!(await addMember(c.env.DB, id, email, role))) {
    throw new HTTPException(409, { message: 'already_member' });
  }
  return c.json(await listMembers(c.env.DB, id), 201);
});

members.patch('/:email', async (c) => {
  assertManager(c);
  const role = parseMemberRole(await jsonBody(c));
  const outcome = await setMemberRole(c.env.DB, c.get('missionDay').id, memberParam(c), role);
  return answerChange(c, outcome);
});

members.delete('/:email', async (c) => {
  const email = memberParam(c);
  if (email !== c.get('email')) {
    assertManager(c);
  }
  return answerChange(c, await removeMember(c.env.DB, c.get('missionDay').id, email));
});

export default members;
