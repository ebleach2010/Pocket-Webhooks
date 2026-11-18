/**
 * One-time helper: complete the Google OAuth flow and print a refresh token.
 *
 * Prerequisites (see README): a Google Cloud project with the Calendar API
 * enabled, an OAuth consent screen, and an OAuth client whose redirect URI
 * matches GOOGLE_REDIRECT_URI (default http://localhost:3000/oauth2/callback).
 *
 * Run:  npm run google-auth
 * Then open the printed URL, approve access, and copy GOOGLE_REFRESH_TOKEN
 * from the terminal into your .env.
 */
import { createServer } from 'node:http';
import { URL } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { google } from 'googleapis';

loadEnv();

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    console.error(`Missing ${name}. Set it in .env before running this script.`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const clientId = requireEnv('GOOGLE_CLIENT_ID');
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET');
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? 'http://localhost:3000/oauth2/callback';

  const redirect = new URL(redirectUri);
  const port = Number(redirect.port || '3000');
  const callbackPath = redirect.pathname;

  const oauth2 = new google.auth.OAuth2({ clientId, clientSecret, redirectUri });

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a refresh_token even on re-auth
    scope: SCOPES,
  });

  console.log('\n1) Open this URL in your browser and approve access:\n');
  console.log(authUrl);
  console.log(`\n2) Waiting for the redirect on ${redirectUri} ...\n`);

  const server = createServer(async (req, res) => {
    if (!req.url) return;
    const reqUrl = new URL(req.url, `http://localhost:${port}`);
    if (reqUrl.pathname !== callbackPath) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    const code = reqUrl.searchParams.get('code');
    if (!code) {
      res.statusCode = 400;
      res.end('Missing ?code in callback');
      return;
    }
    try {
      const { tokens } = await oauth2.getToken(code);
      res.setHeader('content-type', 'text/html');
      res.end('<h2>Success!</h2><p>You can close this tab and return to the terminal.</p>');

      if (tokens.refresh_token) {
        console.log('\n✅ Success. Add this to your .env:\n');
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      } else {
        console.log(
          '\n⚠️  No refresh_token returned. Revoke prior access at ' +
            'https://myaccount.google.com/permissions and run again ' +
            '(the script already requests prompt=consent).\n',
        );
      }
    } catch (err) {
      res.statusCode = 500;
      res.end('Token exchange failed; check the terminal.');
      console.error('Token exchange failed:', err);
    } finally {
      server.close();
      setTimeout(() => process.exit(0), 100);
    }
  });

  server.listen(port);
}

void main();
