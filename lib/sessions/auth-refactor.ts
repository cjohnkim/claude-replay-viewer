import type {
  Session, ReplayEvent, FileChange, Snapshot, Checkpoint, FeatureState, Project,
} from "../types";

const project: Project = {
  id: "acme-saas",
  name: "Acme SaaS",
  description: "B2B analytics product. Multi-tenant, Postgres + Next.js, on the bumpy road from MVP to series-A.",
};

// --- File fixtures ---

const AUTH_V0 = `// lib/auth.ts — legacy cookie auth
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SESSION_COOKIE = "acme_sid";

export async function getSession() {
  const sid = cookies().get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const row = await db.session.findUnique({ where: { id: sid } });
  if (!row || row.expiresAt < new Date()) return null;
  return { userId: row.userId, expiresAt: row.expiresAt };
}

export async function signIn(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error("no user");
  const ok = await verify(password, user.passwordHash);
  if (!ok) throw new Error("bad password");
  const sid = crypto.randomUUID();
  await db.session.create({ data: { id: sid, userId: user.id, expiresAt: in30Days() } });
  cookies().set(SESSION_COOKIE, sid, { httpOnly: true, sameSite: "lax", secure: true });
  return user.id;
}
`;

const AUTH_V1 = `// lib/auth.ts — NextAuth + email + refresh
import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    }),
    CredentialsProvider({
      name: "Password",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const u = await db.user.findUnique({ where: { email: creds!.email as string } });
        if (!u) return null;
        const ok = await verify(creds!.password as string, u.passwordHash);
        return ok ? { id: u.id, email: u.email } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.uid) session.user.id = token.uid as string;
      return session;
    },
  },
});
`;

const AUTH_V2 = `// lib/auth.ts — NextAuth + email + refresh + auto-rotate
import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

const ROTATE_AFTER = 60 * 60 * 24 * 7; // rotate weekly

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  providers: [
    EmailProvider({
      server: process.env.EMAIL_SERVER!,
      from: process.env.EMAIL_FROM!,
    }),
    CredentialsProvider({
      name: "Password",
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const u = await db.user.findUnique({ where: { email: creds!.email as string } });
        if (!u) return null;
        const ok = await verify(creds!.password as string, u.passwordHash);
        return ok ? { id: u.id, email: u.email } : null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) token.uid = user.id;
      const now = Math.floor(Date.now() / 1000);
      if (!token.rotatedAt) token.rotatedAt = now;
      if (now - (token.rotatedAt as number) > ROTATE_AFTER) {
        token.rotatedAt = now;
        token.jti = crypto.randomUUID();
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.uid) session.user.id = token.uid as string;
      session.expiresAt = token.exp;
      return session;
    },
  },
});
`;

const MIDDLEWARE_V1 = `// middleware.ts — guard protected routes
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const PUBLIC = ["/", "/sign-in", "/sign-up", "/about", "/pricing"];

export default auth((req) => {
  if (PUBLIC.some((p) => req.nextUrl.pathname.startsWith(p))) return;
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});

export const config = { matcher: ["/((?!api|_next/static|_next/image|.*\\\\.png$).*)"] };
`;

const LAYOUT_BEFORE = `// app/layout.tsx
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body>{children}</body></html>
  );
}
`;

const LAYOUT_AFTER = `// app/layout.tsx — wrap with SessionProvider
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        <SessionProvider session={session}>{children}</SessionProvider>
      </body>
    </html>
  );
}
`;

// --- File changes ---

const fileChanges: Record<string, FileChange> = {
  fc_auth_v1: {
    id: "fc_auth_v1", eventId: "ev_edit_auth", filePath: "lib/auth.ts",
    changeType: "modified", beforeContent: AUTH_V0, afterContent: AUTH_V1,
    diffSummary: "+38 / −18",
  },
  fc_middleware_new: {
    id: "fc_middleware_new", eventId: "ev_write_middleware", filePath: "middleware.ts",
    changeType: "created", beforeContent: null, afterContent: MIDDLEWARE_V1,
    diffSummary: "+18 / −0",
  },
  fc_layout_wrap: {
    id: "fc_layout_wrap", eventId: "ev_edit_layout", filePath: "app/layout.tsx",
    changeType: "modified", beforeContent: LAYOUT_BEFORE, afterContent: LAYOUT_AFTER,
    diffSummary: "+9 / −2",
  },
  fc_auth_v2: {
    id: "fc_auth_v2", eventId: "ev_edit_refresh", filePath: "lib/auth.ts",
    changeType: "modified", beforeContent: AUTH_V1, afterContent: AUTH_V2,
    diffSummary: "+12 / −2",
  },
};

// --- Snapshots ---

const snapshots: Record<string, Snapshot> = {
  snap_signin: {
    id: "snap_signin", eventId: "ev_snap_signin",
    title: "Sign-in page · v1",
    description: "Passwordless email + password sign-in with NextAuth.",
    route: "/sign-in",
    placeholder: {
      background: "linear-gradient(135deg, #0f1729 0%, #1e293b 50%, #0f1729 100%)",
      label: "🔐  Sign in",
      sublabel: "Email link · or password",
      accent: "#60a5fa",
    },
  },
  snap_refresh: {
    id: "snap_refresh", eventId: "ev_snap_refresh",
    title: "Token rotation works · v2",
    description: "Long-lived session survives token rotation without forcing re-auth.",
    route: "/sign-in",
    placeholder: {
      background: "linear-gradient(135deg, #0a2540 0%, #1e3a5f 50%, #0a2540 100%)",
      label: "🔁  rotated",
      sublabel: "JWT rotated · session intact",
      accent: "#22d3ee",
    },
  },
};

// --- Feature states ---

const v1Features: FeatureState[] = [
  { name: "Email magic-link sign-in",       status: "shipped", description: "NextAuth EmailProvider via SES." },
  { name: "Password sign-in",               status: "shipped", description: "Credentials provider against existing users." },
  { name: "Route guarding middleware",      status: "shipped", description: "Matcher excludes /api and assets; redirects with ?next= preserved." },
  { name: "SessionProvider on RSC layout",  status: "shipped", description: "Server-resolved session passed into client tree." },
  { name: "Auto-rotating JWT",              status: "not_started", description: "Token rotation not yet wired — sessions expire abruptly." },
];

const v2Features: FeatureState[] = [
  { name: "Email magic-link sign-in",       status: "shipped", description: "NextAuth EmailProvider via SES." },
  { name: "Password sign-in",               status: "shipped", description: "Credentials provider against existing users." },
  { name: "Route guarding middleware",      status: "shipped", description: "Matcher excludes /api and assets; redirects with ?next= preserved." },
  { name: "SessionProvider on RSC layout",  status: "shipped", description: "Server-resolved session passed into client tree." },
  { name: "Auto-rotating JWT",              status: "shipped", description: "JTI rotates weekly; session survives transparently." },
  { name: "Expiry surfaced in session obj", status: "shipped", description: "session.expiresAt exposed to client for refresh banners." },
];

// --- Checkpoints ---

const checkpoints: Record<string, Checkpoint> = {
  ck_v1: {
    id: "ck_v1", eventId: "ev_ck_v1", label: "v1 — NextAuth wired",
    shippedStateSummary: "Legacy cookie auth replaced with NextAuth. Email link + password both work; 12 protected routes guarded by middleware. No automatic refresh yet — sessions hard-expire at 30 days.",
    featureState: v1Features,
  },
  ck_v2: {
    id: "ck_v2", eventId: "ev_ck_v2", label: "v2 — session refresh shipped",
    shippedStateSummary: "JWT auto-rotates weekly using a rotatedAt timestamp; existing sessions survive without re-auth. Session object now carries expiresAt so the UI can render a refresh banner.",
    featureState: v2Features,
  },
};

// --- Events ---

const t0 = new Date("2026-05-12T10:08:00").getTime();
const at = (s: number) => new Date(t0 + s * 1000).toISOString();

const events: ReplayEvent[] = [
  {
    id: "ev_prompt_initial", sequenceNumber: 1, timestamp: at(0), type: "user_prompt",
    title: "Initial request",
    content:
`Our legacy cookie auth is brittle — sessions don't refresh, and the cookie store is leaking on logout. I want to migrate to NextAuth: email magic links + password. Should guard ~12 protected routes via middleware.`,
  },
  {
    id: "ev_response_plan", sequenceNumber: 2, timestamp: at(8), type: "assistant_response",
    title: "Plan: NextAuth + middleware + SessionProvider",
    content:
`I'll install next-auth + @auth/prisma-adapter, configure Email + Credentials providers with a JWT session strategy, drop a middleware.ts route guard, and wrap the RSC root layout in SessionProvider so client components can read the session synchronously.`,
  },
  {
    id: "ev_edit_auth", sequenceNumber: 3, timestamp: at(38), type: "tool_call",
    title: "Edit lib/auth.ts — replace cookie auth with NextAuth",
    description: "Drop the legacy session-table cookie scheme; configure NextAuth with two providers.",
    metadata: { tool: "Edit", parentEventId: "ev_response_plan" },
    relatedFilePaths: ["lib/auth.ts"], diffIds: ["fc_auth_v1"],
  },
  {
    id: "ev_write_middleware", sequenceNumber: 4, timestamp: at(64), type: "tool_call",
    title: "Write middleware.ts",
    description: "Public route allow-list, redirect with ?next= to preserve intent.",
    metadata: { tool: "Write", parentEventId: "ev_response_plan" },
    relatedFilePaths: ["middleware.ts"], diffIds: ["fc_middleware_new"],
  },
  {
    id: "ev_edit_layout", sequenceNumber: 5, timestamp: at(82), type: "tool_call",
    title: "Edit app/layout.tsx — wrap with SessionProvider",
    metadata: { tool: "Edit", parentEventId: "ev_response_plan" },
    relatedFilePaths: ["app/layout.tsx"], diffIds: ["fc_layout_wrap"],
  },
  {
    id: "ev_cmd_build", sequenceNumber: 6, timestamp: at(96), type: "command",
    title: "pnpm build",
    description: "Type-check + compile all routes.",
    metadata: { tool: "Bash", command: "pnpm build", exitCode: 0, durationMs: 23410 },
  },
  {
    id: "ev_test_routes", sequenceNumber: 7, timestamp: at(132), type: "test_result",
    title: "Smoke: 12 protected routes guarded",
    metadata: {
      tests: [
        { name: "GET /dashboard unauth → /sign-in",   status: "pass", durationMs: 41 },
        { name: "GET /settings unauth → /sign-in",    status: "pass", durationMs: 38 },
        { name: "GET /api/me unauth → 401",           status: "pass", durationMs: 12 },
        { name: "Email magic-link round-trip",        status: "pass", durationMs: 1820 },
        { name: "Password sign-in → /dashboard",      status: "pass", durationMs: 64 },
        { name: "Sign-out clears cookie",             status: "pass", durationMs: 28 },
      ],
    },
  },
  {
    id: "ev_snap_signin", sequenceNumber: 8, timestamp: at(160), type: "snapshot",
    title: "Snapshot · /sign-in renders",
    snapshotIds: ["snap_signin"],
  },
  {
    id: "ev_ck_v1", sequenceNumber: 9, timestamp: at(180), type: "checkpoint",
    title: "v1 — NextAuth wired",
    description: "Migration complete. Awaiting load test + UX review.",
    metadata: { commitSha: "9c1ab27" },
  },
  {
    id: "ev_prompt_followup", sequenceNumber: 10, timestamp: at(1840), type: "user_prompt",
    title: "User feedback: hard expiry is ugly",
    content:
`Sign-in works but at day-30 the session just dies mid-request. Want a rolling refresh so active users never get bounced. Ideally a weekly rotation under the hood with no UX change.`,
  },
  {
    id: "ev_response_refresh", sequenceNumber: 11, timestamp: at(1858), type: "assistant_response",
    title: "Plan: weekly JWT rotation in the jwt callback",
    content:
`I'll tag the token with rotatedAt and regenerate jti every 7 days inside the jwt callback. Existing tokens continue working; the next request after the rotation window swaps the underlying jti without a re-auth.`,
  },
  {
    id: "ev_edit_refresh", sequenceNumber: 12, timestamp: at(1888), type: "tool_call",
    title: "Edit lib/auth.ts — add JWT rotation",
    metadata: { tool: "Edit", parentEventId: "ev_response_refresh" },
    relatedFilePaths: ["lib/auth.ts"], diffIds: ["fc_auth_v2"],
  },
  {
    id: "ev_test_rotate", sequenceNumber: 13, timestamp: at(1922), type: "test_result",
    title: "Rotation tests",
    metadata: {
      tests: [
        { name: "token < 7d old: jti stable", status: "pass", durationMs: 9 },
        { name: "token > 7d old: jti rotates", status: "pass", durationMs: 11 },
        { name: "session survives rotation", status: "pass", durationMs: 18 },
        { name: "expiresAt exposed in session", status: "pass", durationMs: 4 },
      ],
    },
  },
  {
    id: "ev_snap_refresh", sequenceNumber: 14, timestamp: at(1948), type: "snapshot",
    title: "Snapshot · session intact after rotation",
    snapshotIds: ["snap_refresh"],
  },
  {
    id: "ev_ck_v2", sequenceNumber: 15, timestamp: at(1970), type: "checkpoint",
    title: "v2 — session refresh shipped",
    description: "Auto-rotation in place. Active users no longer hit hard expiry.",
    metadata: { commitSha: "4af9d10" },
  },
];

// --- Session ---

export const authRefactorSession: Session = {
  id: "sess_auth_refactor_2026_05_12",
  project,
  title: "Auth refactor — cookie → NextAuth + JWT rotation",
  shortDescription: "Replaced legacy cookie auth with NextAuth (email + password). Caught hard-expiry UX; added weekly JWT rotation so active users never get bounced.",
  tags: ["auth", "nextauth", "migration", "refactor"],
  startedAt: at(0), endedAt: at(1970),
  finalSummary:
`Migrated Acme SaaS from a brittle cookie-table session scheme to NextAuth in two passes.

The v1 pass installed NextAuth with Email and Credentials providers, dropped a middleware that guards 12 protected routes (preserving intent via ?next=), and wrapped the RSC root layout in SessionProvider. Build clean; 6 smoke tests green.

User flagged that sessions hard-expired at day 30, kicking active users mid-request. The v2 pass added a rolling JWT rotation inside the jwt() callback — token rotatedAt tag, weekly jti regeneration, and an expiresAt now exposed on the session object so the UI can surface a refresh banner if needed. Rotation tests confirmed seamless behavior across the 7-day boundary.`,
  events, fileChanges, snapshots, checkpoints,
  filePaths: ["lib/auth.ts", "middleware.ts", "app/layout.tsx"],
  shippedSummary: {
    headline: "NextAuth migration with rolling session refresh.",
    features: v2Features,
    files: ["lib/auth.ts", "middleware.ts", "app/layout.tsx"],
    knownGaps: [
      "No social providers yet (Google/GitHub) — only email + password.",
      "Refresh banner in UI is not implemented — expiresAt is exposed but unused.",
      "Magic-link email template still uses the NextAuth default.",
    ],
  },
};
