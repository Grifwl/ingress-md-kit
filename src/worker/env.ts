/**
 * Types of the Worker environment and of the per-request context.
 */
import type { MembershipRole, MissionDay } from '../shared/types';

/** Bindings and variables declared in wrangler.toml or .dev.vars. */
export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  INSTANCE_ADMINS: string;
  DEV_USER_EMAIL?: string;
}

/** Values the middleware stores for the route handlers. */
export interface AppVariables {
  email: string;
  missionDay: MissionDay;
  role: MembershipRole;
}

/** Hono generic binding the Worker's bindings and variables together. */
export interface AppEnv {
  Bindings: Env;
  Variables: AppVariables;
}
