/**
 * The Hono application: API routes, the admin page and static files.
 */
import { Hono, type Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from './env';
import admin from './routes/admin';
import publicApi, { serveParticipantPage, serveProposalPage, serveSample } from './routes/public';

/**
 * Answers an admin page request. The admin is a single-page application,
 * so every deep link receives the same HTML document; paths that look like
 * files are left to the static assets.
 *
 * @param c - Request context.
 * @returns The response.
 */
function serveAdminPage(c: Context<AppEnv>): Promise<Response> {
  const url = new URL(c.req.url);
  const lastSegment = url.pathname.split('/').pop() ?? '';
  if (lastSegment.includes('.')) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  url.pathname = '/admin/';
  url.search = '';
  return c.env.ASSETS.fetch(new Request(url, c.req.raw));
}

const app = new Hono<AppEnv>();

app.route('/api/admin', admin);
app.route('/api/public', publicApi);
app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

app.get('/admin', serveAdminPage);
app.get('/admin/*', serveAdminPage);

app.get('/:slug', serveParticipantPage);
app.get('/:slug/sample', serveSample);
app.get('/:slug/:segment', serveProposalPage);

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }
  console.error(error);
  return c.json({ error: 'internal_error' }, 500);
});

export default app;
