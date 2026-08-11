# 01 - Current Architecture Audit
**Mealiez - Production Codebase Reverse Engineering Report**
_Prepared by: Principal Software Architect_
_Audit Date: 2026-07-10_
_Basis: Full source code inspection - zero assumptions_

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack](#2-technology-stack)
3. [Repository Structure](#3-repository-structure)
4. [Application Architecture](#4-application-architecture)
5. [Runtime Architecture](#5-runtime-architecture)
6. [Shared Components](#6-shared-components)
7. [Shared Utilities](#7-shared-utilities)
8. [Configuration Management](#8-configuration-management)
9. [Environment Variables](#9-environment-variables)
10. [Dependency Graph](#10-dependency-graph)
11. [High-Level Request Lifecycle](#11-high-level-request-lifecycle)

---

## 1. Executive Summary

**Mealiez** is a multi-tenant SaaS application for managing organizational meal operations. It is deployed at https://portal.mealiez.in and serves:

- **Admins / Managers** - via a web dashboard (sidebar navigation, md+ screens)
- **Members** - via a mobile-first PWA accessible at /m/* routes (and optionally via a Capacitor-wrapped Android native app)
- **Platform Super Admins** (Mealiez team) - via a separate, isolated route group at /super/*

The system handles meal plan scheduling, attendance tracking via QR codes, pre-meal booking (requests), inventory management, branch management, and user management, all scoped to isolated tenant accounts.

**Architecture Pattern:** Single-codebase Next.js 14 application with two distinct frontends (web and mobile) rendered within separate route groups. All persistence is Supabase (PostgreSQL + Auth + Storage + Edge Functions). Row-Level Security (RLS) at the database layer is the primary authorization boundary.

**Key architectural decisions observed:**
- Tenant isolation via JWT app_metadata.tenant_id claim, enforced in PostgreSQL RLS
- Dual QR mode: short-lived session QR (HMAC-SHA256 signed, 15-minute TTL) + permanent member-identity QR (also HMAC-SHA256)
- Device-aware routing: middleware + client-side DeviceRedirector redirect between /dashboard (web) and /m/home (mobile) based on User-Agent or window.innerWidth
- Feature flags per tenant stored in tenant_features table; checked server-side on every layout render
- Members are **always** forced to mobile paths; admins are device-aware
- SMS invite service is a **mock** stub (no real SMS provider connected)
- Offline support: key data pre-fetched and cached in localStorage on the mobile client

---

## 2. Technology Stack

### 2.1 Languages

| Language | Role |
|---|---|
| TypeScript (5.x) | All application code - server, client, shared |
| SQL (PostgreSQL dialect) | All DB migrations, stored procedures, RLS |
| JavaScript (Node.js) | Build script (scripts/inject-version.js) |
| TypeScript / Deno | Supabase Edge Function (process-attendance-schedules) |
| CSS | Global base styles (app/globals.css), Tailwind utilities |

### 2.2 Frameworks

| Framework | Version | Role |
|---|---|---|
| Next.js | 14.2.15 | Full-stack application framework (App Router) |
| React | 18.x | UI rendering |
| Capacitor | 8.3.4 | Android native wrapper around the hosted PWA |

### 2.3 Build Tools

| Tool | Role |
|---|---|
| next build | Production bundle via webpack |
| scripts/inject-version.js | Pre-build: stamps CACHE_VERSION into public/sw.js from VERCEL_GIT_COMMIT_SHA or timestamp |
| postcss (^8) | CSS processing pipeline for Tailwind |
| tailwindcss (^3.4.1) | Utility-first CSS framework |
| eslint + eslint-config-next | Linting (build errors ignored in production config) |
| typescript (^5) | Type checking (build errors also ignored in production config) |
| @capacitor/cli | Android APK build toolchain (dev dependency) |

### 2.4 Libraries

#### Production Dependencies (selected)

| Library | Purpose |
|---|---|
| @supabase/ssr (^0.10.2) | Server-side Supabase client with cookie management |
| @supabase/supabase-js (^2.103.0) | Core Supabase client SDK |
| @radix-ui/react-alert-dialog | Accessible dialog primitive |
| @radix-ui/react-dropdown-menu | Accessible dropdown primitive |
| @base-ui/react (^1.5.0) | Additional headless UI components |
| class-variance-authority | Component variant logic (CVA) |
| clsx + tailwind-merge | Conditional class name merging |
| lucide-react | Icon library |
| shadcn | shadcn/ui component scaffolding CLI |
| zod (^4.3.6) | Schema validation |
| sonner | Toast notifications |
| recharts | Chart rendering |
| qrcode + qrcode.react | QR code generation |
| jsqr | QR code decoding (client-side camera scanning fallback) |
| react-qr-barcode-scanner | Camera-based QR/barcode scanning React component |
| html2canvas + jspdf | PDF/image export for reports |
| papaparse | CSV parsing and generation |
| resend | Transactional email provider SDK |
| @vercel/analytics | Production analytics |
| server-only | Package that throws at build time if imported in a browser bundle |
| tw-animate-css | CSS animation utilities |

#### Capacitor Plugins

| Plugin | Purpose |
|---|---|
| @capacitor-mlkit/barcode-scanning | Native ML Kit barcode scanning on Android |
| @capacitor/android | Android runtime |
| @capacitor/camera | Native device camera access |
| @capacitor/filesystem | Native file system access |
| @capacitor/local-notifications | Native push-like local notifications |
| @capacitor/network | Native network status monitoring |
| @capacitor/push-notifications | Native FCM push notifications |

### 2.5 Services and Third-Party Integrations

| Service | Integration Point |
|---|---|
| Supabase | Database (PostgreSQL), Auth, Storage, Edge Functions, Realtime |
| Resend | Transactional email (resend SDK, RESEND_API_KEY) |
| Netlify | Deployment host (netlify.toml present) |
| Vercel | Analytics (@vercel/analytics); VERCEL_GIT_COMMIT_SHA used in build |
| Google Fonts | Inter font loaded via next/font/google |
| pg_cron + pg_net | Supabase DB extensions for scheduled job execution |

> **Note:** SMS integration is a stub. lib/sms/sendInvite.ts returns { success: true } with a comment: MOCK - Simulate successful SMS send.

---

## 3. Repository Structure

### 3.1 Top-Level Layout

`
C:\Mealiez\
+-- install.cmd
+-- .vscode/
+-- mealiez/
    +-- app/
    +-- components/
    +-- hooks/
    +-- lib/
    +-- scripts/
    +-- supabase/
    +-- public/
    +-- docs/
    +-- next.config.mjs
    +-- tailwind.config.ts
    +-- components.json
    +-- capacitor.config.ts
    +-- netlify.toml
    +-- middleware.ts
    +-- tsconfig.json
    +-- postcss.config.mjs
    +-- package.json
    +-- .env.local
`

### 3.2 app/ - Route Tree

The App Router uses route groups (parentheses syntax) to separate concerns without affecting URL paths.

| Route Group | URL Prefix | Auth Requirement | Purpose |
|---|---|---|---|
| (auth)/ | /login, /register, etc. | None | Public auth flows |
| (web)/ | /dashboard, /users, /meals, etc. | requireAuth() | Desktop admin/manager/member UI |
| (mobile)/ | /m/home, /m/attendance, etc. | Client-side useAuthGuard | Mobile PWA |
| (superadmin)/ | /super/dashboard, /super/messes | requireSuperAdmin() | Platform admin panel |
| api/ | /api/* | Per-route | Next.js API route handlers |

### 3.3 components/ - UI Component Packages

| Directory | Responsibility |
|---|---|
| components/ui/ | shadcn/ui primitives: button, card, input, select, table, tabs, badge, dropdown-menu, alert-dialog, skeleton, label |
| components/web/ | Desktop: Sidebar, NavLink, SidebarSignOut, UserBadge, UserAttendanceLogs, MemberScannerModal, MyQRModal |
| components/mobile/ | MobileBottomNav - role-aware tab bar for mobile |
| components/inventory/ | DualBarcodeScanner, InventorySidebar, items/ and recipes/ sub-folders |
| components/pwa/ | install-prompt.tsx, pwa-updater.tsx, install-manager.ts |
| DeviceRedirector.tsx | Root-level client component; redirects between web/mobile based on device/role |

### 3.4 lib/ - Shared Business Logic

| Path | Responsibility |
|---|---|
| lib/supabase/client.ts | Browser Supabase client factory (createBrowserClient) |
| lib/supabase/server.ts | Server Supabase client factory (createServerClient) with cookie read/write |
| lib/supabase/middleware.ts | Middleware Supabase client; refreshes session; enforces must_change_password |
| lib/supabase/admin.ts | Admin (service-role) client factory; browser guard; lazy secret loading |
| lib/auth/roles.ts | TenantRole type; ROLE_RANK map; role comparison helpers |
| lib/auth/session.ts | Server-only: getSession, getCurrentUser, getSuperAdminUser, requireAuth |
| lib/auth/guards.ts | Server-only: requireAuth, requireAdmin, requireManager, requireSuperAdmin |
| lib/auth/client-session.ts | Client-side: getClientUser (with localStorage offline cache), signOut, onAuthStateChange |
| lib/features/gate.ts | checkFeatureEnabled(tenantId, featureKey) via is_feature_enabled RPC |
| lib/attendance/token.ts | HMAC-SHA256 token signing and verification for QR codes |
| lib/email/resend.ts | Resend SDK singleton |
| lib/email/sendInvite.ts | sendInviteEmail() with 3-retry logic |
| lib/email/otp.ts | OTP generation/sending via Resend |
| lib/sms/sendInvite.ts | Stub - returns success without a real SMS provider |
| lib/dashboard/cards.ts | Dashboard metric calculations |
| lib/validations/ | Zod schemas for all forms |
| lib/utils.ts | cn() (clsx + twMerge), getDashboardPath() |
| lib/utils/meal-times.ts | Timezone-aware meal window open/close logic |
| lib/utils/phone.ts | Phone number formatting utilities |

### 3.5 supabase/ - Database and Backend

| Path | Content |
|---|---|
| supabase/config.toml | Supabase CLI local dev config (project_id, DB port 54322, API port 54321, PG major v17) |
| supabase/migrations/ | 54 ordered SQL migration files defining the full schema |
| supabase/functions/process-attendance-schedules/index.ts | Deno Edge Function called by pg_cron every minute |
| supabase/setup_cron.sql | Manual SQL to register the pg_cron job |

### 3.6 Build Configuration

| File | Key Settings |
|---|---|
| next.config.mjs | images.unoptimized: true; ESLint and TypeScript build errors both ignored |
| netlify.toml | build.command = npm run build, publish = .next |
| capacitor.config.ts | appId: com.mealiez.app; server.url: https://portal.mealiez.in/ |
| package.json build script | node scripts/inject-version.js && next build |

---

## 4. Application Architecture

### 4.1 Frontend Architecture

The application maintains two distinct frontends within a single Next.js codebase, separated by route groups.

`mermaid
graph TB
    subgraph Single Next.js App
        Root[app/layout.tsx Inter font + DeviceRedirector + Analytics]
        Root --> WebGroup[(web) group Desktop /dashboard /users /meals]
        Root --> MobileGroup[(mobile) group Mobile PWA /m/home /m/attendance]
        Root --> SuperGroup[(superadmin) group Platform Admin /super/dashboard]
        Root --> AuthGroup[(auth) group Public /login /register]
    end
    WebGroup --> WebLayout[WebLayout Server Component requireAuth() fetches tenant_features renders Sidebar]
    MobileGroup --> MobileServerLayout[MobileLayout Server PWA metadata + manifest]
    MobileServerLayout --> MobileClientLayout[MobileClientLayout Client auth state + offline detection + prefetch + bottom nav]
    SuperGroup --> SuperLayout[SuperLayout requireSuperAdmin()]
`

**Web Frontend (Desktop):**
- Server Component layout calls requireAuth() - redirects to /login if unauthenticated
- Fetches tenant_features on every layout render to filter the sidebar
- Renders Sidebar (client component, collapsible) + top header
- Navigation items filtered by both feature flags and user role

**Mobile Frontend (PWA/Capacitor):**
- Server layout sets PWA metadata (manifest.json, apple-web-app, themeColor)
- MobileClientLayout (use client) manages: auth state, online/offline detection, offline path enforcement, background pre-fetching, admin-on-mobile block
- MobileBottomNav renders different nav items per role (memberNav vs managerNav)
- Capacitor wraps the hosted URL - no local bundle served from native

### 4.2 Backend Architecture

`mermaid
graph LR
    Browser[Browser / PWA] -- HTTP fetch --> APIRoutes[Next.js API Routes app/api/]
    APIRoutes -- supabase-js anon key --> SupabaseRLS[Supabase DB RLS enforced]
    APIRoutes -- admin client service_role --> SupabaseAdmin[Supabase DB RLS bypassed]
    APIRoutes -- Resend SDK --> ResendEmail[Resend Email API]
    SupabaseAdmin -- is_feature_enabled RPC --> FeatureGate[Feature Gate]
`

API Route Pattern:
1. Routes that check auth call createClient() (server) and call supabase.auth.getUser()
2. Routes needing privileged operations call createAdminClient()
3. Routes requiring a feature call checkFeatureEnabled(tenantId, featureKey) before processing

### 4.3 Supabase Architecture

#### Core Database Schema

`mermaid
erDiagram
    tenants {
        uuid id PK
        text name
        text slug
        text plan
        boolean is_active
        text logo_url
    }
    users {
        uuid id PK
        uuid tenant_id FK
        uuid auth_id FK
        text role
        text full_name
        boolean is_active
        uuid branch_id FK
        text avatar_url
        boolean must_change_password
    }
    tenant_features {
        uuid id PK
        uuid tenant_id FK
        text feature_key
        boolean is_enabled
    }
    branches {
        uuid id PK
        uuid tenant_id FK
        text name
        text code
        boolean is_active
    }
    meal_plans {
        uuid id PK
        uuid tenant_id FK
        text name
        date start_date
        date end_date
        boolean is_active
    }
    meal_plan_items {
        uuid id PK
        uuid plan_id FK
        date meal_date
        text meal_type
        text name
        boolean is_available
    }
    attendance_sessions {
        uuid id PK
        uuid tenant_id FK
        date session_date
        text meal_type
        boolean is_active
        uuid branch_id FK
    }
    attendance_records {
        uuid id PK
        uuid session_id FK
        uuid user_id FK
        timestamptz marked_at
        text method
    }
    meal_requests {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        date session_date
        text meal_type
        text status
    }
    tenants ||--o{ users : has
    tenants ||--o{ tenant_features : has
    tenants ||--o{ branches : has
    tenants ||--o{ meal_plans : has
    tenants ||--o{ attendance_sessions : has
    tenants ||--o{ meal_requests : has
    meal_plans ||--o{ meal_plan_items : has
    attendance_sessions ||--o{ attendance_records : has
    users ||--o{ attendance_records : marks
    branches ||--o{ users : assigned
`

#### Key PostgreSQL Stored Procedures / RPCs

| Function | Purpose | Caller |
|---|---|---|
| onboard_new_tenant(...) | Atomically creates tenant + admin user + feature seeds | api/onboarding/register (admin client) |
| seed_tenant_features(tenant_id) | Inserts default feature flags for a new tenant | Called by onboard_new_tenant |
| is_feature_enabled(tenant_id, feature) | Returns boolean for feature gate | lib/features/gate.ts |
| get_tenant_id() | Extracts tenant_id from JWT app_metadata | RLS policies |
| get_user_role() | Extracts role from JWT app_metadata | RLS policies |
| get_role_rank(role) | Returns numeric rank (admin=3, manager=2, member=1) | RLS policies |
| is_super_admin() | Returns boolean from JWT app_metadata.is_super_admin | RLS policies |
| activate_meal_plan(plan_id, tenant_id) | Deactivates all others; activates target | Meal management API |
| get_todays_meals(tenant_id) | Returns today meal plan items for active plan | API |
| get_session_attendance_summary(session_id) | Returns session + all records as JSONB | Attendance API |
| process_attendance_schedules() | Auto-creates attendance sessions per schedule config | Edge Function (pg_cron) |
| get_branch_stats(branch_id) | Returns member count + today attendance | Branch API |
| check_user_email_in_tenant(email, tenant_id) | Email conflict check before invite | API (admin client) |
| check_email_exists_globally(email) | Global email uniqueness check | API (admin client) |
| repair_user_metadata(auth_id) | Repairs broken JWT metadata from DB | Admin utility |

#### Supabase Storage

One bucket: **avatar** (public read, authenticated write)
- Stores tenant logos (logo_url in tenants) and user avatars (avatar_url in users)

#### Edge Functions

One function: **process-attendance-schedules**
- Runtime: Deno
- Called every minute by pg_cron via pg_net.http_post()
- Calls the process_attendance_schedules() RPC using service role key

### 4.4 Authentication Flow

`mermaid
sequenceDiagram
    participant U as User Browser
    participant MW as Next.js Middleware
    participant SA as Supabase Auth
    participant DB as PostgreSQL users table

    U->>SA: signIn(email, password)
    SA-->>U: JWT access_token in sb-cookie
    Note over SA: app_metadata contains tenant_id and role

    U->>MW: GET /dashboard with sb-cookie
    MW->>SA: supabase.auth.getUser() validates JWT
    SA-->>MW: user object
    MW->>DB: SELECT must_change_password WHERE auth_id = user.id
    DB-->>MW: profile row
    alt must_change_password = true
        MW-->>U: 302 redirect to /change-password
    else
        MW-->>U: 200 continue to server component
    end

    Note over U: Web Layout Server Component
    U->>DB: getCurrentUser() SELECT users JOIN tenants
    DB-->>U: AuthUser with id tenant_id role full_name branch_id
`

**Token storage:** Supabase SSR stores JWT in HTTP-only sb-* cookies. Middleware reads these, calls supabase.auth.getUser() (validates against Supabase Auth server), and refreshes if expired.

**Offline fallback:** getClientUser() falls back to localStorage(mealiez_auth_user) when offline.

### 4.5 Authorization

Three layers:

**Layer 1: Next.js Middleware** - User-Agent redirect at /; runs updateSession() on all paths

**Layer 2: Server Component Guards** (lib/auth/guards.ts)

`	ypescript
requireAuth()       // any authenticated tenant user
requireAdmin()      // role >= admin (rank 3)
requireManager()    // role >= manager (rank 2)
requireSuperAdmin() // is_super_admin === true in app_metadata
`

**Layer 3: PostgreSQL RLS** - Every table enforces:

`sql
tenant_id = public.get_tenant_id()
-- where get_tenant_id() extracts from JWT app_metadata
-- Super admins bypass via OR public.is_super_admin()
`

### 4.6 Tenant Architecture

`mermaid
graph TD
    Platform[Mealiez Platform]
    Platform --> T1[Tenant A]
    Platform --> T2[Tenant B]
    Platform --> T3[Tenant N]
    T1 --> Users1[Users: admin / manager / members]
    T1 --> Features1[Feature Flags per tenant meal_management=ON attendance_tracking=ON inventory_management=OFF pre_meal_requests=OFF custom_reports=OFF billing=ON branch_management=OFF]
    T1 --> Branches1[Branches optional]
    T1 --> MealPlans1[Meal Plans]
`

**Tenant isolation:** One auth.users record = one tenant. tenant_id embedded in JWT at onboarding. All public tables have tenant_id FK + RLS policy.

**Plans:** free | basic | pro | enterprise in tenants.plan. Feature enablement controlled separately via tenant_features table.

**Feature Keys (migration 20240047):** meal_management, attendance_tracking, inventory_management, pre_meal_requests, custom_reports, billing, branch_management, settings_module

### 4.7 State Management

No global state library. All state is local:

| Layer | Mechanism |
|---|---|
| Server Components | Inline fetch per request |
| Client Components | React useState + useEffect |
| Auth (mobile) | Supabase onAuthStateChange subscription |
| Offline cache | localStorage (mealiez_* keys) |
| Session (server) | React cache() wrapping getSession() |

### 4.8 Storage

| Storage | Key | Contents |
|---|---|---|
| Supabase Storage (avatar bucket) | Per-tenant/per-user paths | Tenant logos, user avatars |
| localStorage | mealiez_auth_user | Cached AuthUser for offline |
| localStorage | mealiez_attendance_logs | Cached attendance history |
| localStorage | mealiez_meal_requests | Cached meal request history |
| localStorage | mealiez_meals_today + mealiez_meals_today_date | Today meal menu |
| localStorage | mealiez_member_qr | Cached signed member QR token |
| localStorage | mealiez_active_sessions | Cached attendance sessions |
| Service Worker | CACHE_VERSION stamped at build | PWA shell assets |

### 4.9 Routing

`mermaid
graph LR
    Root[/] -- UA: mobile --> MHome[/m/home]
    Root -- UA: desktop --> Dashboard[/dashboard]
    Dashboard -- unauthenticated --> Login[/login]
    Dashboard -- must_change_password --> ChangePW[/change-password]
    Dashboard -- admin on mobile device --> MHome
    MHome -- role admin --> BlockedScreen[Access Denied screen]
    MHome -- no auth --> Login
    Login -- super admin --> SuperDash[/super/dashboard]
    Login -- tenant user --> Root
`

Routing layers in execution order:
1. Edge Middleware - User-Agent redirect; updateSession()
2. Server Component redirect - requireAuth() calls redirect(/login)
3. Client DeviceRedirector - Re-checks role and device width after hydration
4. useAuthGuard hook - Mobile pages check requiredRole; redirect to /m/unauthorized

**Path matcher in middleware:** All paths except api/onboarding, _next/static, _next/image, favicon.ico, and static image extensions.

### 4.10 API Layer

All API routes are Next.js Route Handlers in app/api/. Standard pattern:

`	ypescript
export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isEnabled = await checkFeatureEnabled(tenantId, 'feature_key')
  if (!isEnabled) return featureDisabledResponse()

  // Business logic...
}
`

Privileged operations use createAdminClient() (SUPABASE_SECRET_KEY, bypasses RLS).

**QR Attendance API flow:**

`mermaid
sequenceDiagram
    participant M as Mobile Member
    participant API as /api/attendance/mark
    participant Tok as lib/attendance/token.ts
    participant DB as Supabase DB

    M->>M: Camera scans QR code
    M->>API: POST with HMAC token and Bearer JWT
    API->>Tok: verifyQRToken(token)
    Tok->>Tok: HMAC-SHA256 verify + expiry check (15 min TTL)
    Tok-->>API: valid=true with session_id payload
    API->>DB: INSERT attendance_records UNIQUE session+user constraint
    DB-->>API: success or duplicate key
    API-->>M: marked=true or error already marked
`

---

## 5. Runtime Architecture

`mermaid
graph TB
    subgraph Client
        Browser[Desktop Browser Web Dashboard]
        PWA[Mobile Browser PWA /m/ routes]
        APK[Android APK Capacitor WebView portal.mealiez.in]
    end
    subgraph Netlify Edge and Nodejs
        MW[Next.js Middleware Edge Runtime]
        SC[Server Components Nodejs]
        API[API Routes Nodejs]
        SW[Service Worker Browser PWA Shell]
    end
    subgraph Supabase Cloud
        Auth[Supabase Auth JWT + GoTrue]
        DB[PostgreSQL 17 RLS + Stored Procs]
        Storage[Supabase Storage avatar bucket]
        EF[Edge Function Deno process-attendance-schedules]
        Cron[pg_cron every minute]
    end
    subgraph External Services
        Resend[Resend Email]
        Analytics[Vercel Analytics]
        GFonts[Google Fonts Inter]
    end
    Browser --> MW
    PWA --> MW
    APK --> MW
    MW --> SC
    MW --> API
    SC --> DB
    SC --> Auth
    API --> DB
    API --> Auth
    API --> Storage
    API --> Resend
    Cron --> EF
    EF --> DB
    Browser --> Analytics
    Browser --> GFonts
    SW --> Browser
`

Execution contexts:
- **Edge** (Middleware): Cookie reads, redirects, Supabase Auth session refresh
- **Node.js** (Server Components + API Routes): Business logic, Supabase queries, Resend, HMAC signing
- **Browser** (Client Components): React state, Supabase browser client, camera, localStorage
- **Deno** (Edge Function): Supabase Admin client, RPC invocation

---

## 6. Shared Components

| Component | Location | Used By |
|---|---|---|
| ui/button | components/ui/button.tsx | Web Sidebar, mobile pages, forms |
| ui/card | components/ui/card.tsx | Dashboard cards, mobile home |
| ui/input | components/ui/input.tsx | All forms |
| ui/select | components/ui/select.tsx | Meal type selectors, filters |
| ui/table | components/ui/table.tsx | Attendance logs, user lists, inventory |
| ui/tabs | components/ui/tabs.tsx | Inventory, reports |
| ui/badge | components/ui/badge.tsx | Role display, status indicators |
| ui/alert-dialog | components/ui/alert-dialog.tsx | Confirmation dialogs |
| ui/dropdown-menu | components/ui/dropdown-menu.tsx | Action menus |
| ui/skeleton | components/ui/skeleton.tsx | Loading states |
| ui/label | components/ui/label.tsx | Form labels |
| inventory/DualBarcodeScanner | components/inventory/DualBarcodeScanner.tsx | Web and mobile inventory |
| DeviceRedirector | components/DeviceRedirector.tsx | Root layout (all routes) |

Design system: shadcn/ui base-nova style, neutral base color, HSL CSS variables, lucide-react icons, Tailwind utility classes.

---

## 7. Shared Utilities

Available to both server and client contexts:

| Utility | File | Notes |
|---|---|---|
| cn() | lib/utils.ts | clsx + tailwind-merge class helper |
| getDashboardPath() | lib/utils.ts | Device-aware route target; works client and server |
| getMealSessionStatus() | lib/utils/meal-times.ts | Timezone-aware meal window calculation |
| getMealSequenceStatus() | lib/utils/meal-times.ts | All-meal window status in one call |
| Phone formatting | lib/utils/phone.ts | Phone number normalization |
| Zod schemas | lib/validations/*.ts | Form validation |

Server-only utilities (enforced by import server-only or browser guard):

| Utility | File |
|---|---|
| generateQRToken / verifyQRToken | lib/attendance/token.ts (requires node:crypto) |
| generateMemberQRToken / verifyMemberQRToken | lib/attendance/token.ts |
| checkFeatureEnabled() | lib/features/gate.ts |
| createAdminClient() | lib/supabase/admin.ts (browser guard throws) |
| createClient() server | lib/supabase/server.ts (imports server-only) |
| getCurrentUser() | lib/auth/session.ts |
| requireAuth/Admin/Manager/SuperAdmin() | lib/auth/guards.ts |
| sendInviteEmail() | lib/email/sendInvite.ts |

---

## 8. Configuration Management

### 8.1 Supabase Client Configuration

Four distinct factory functions:

| Factory | File | Key | Context |
|---|---|---|---|
| createBrowserClient | lib/supabase/client.ts | Publishable (anon) | Client Components |
| createServerClient (server) | lib/supabase/server.ts | Publishable (anon) | Server Components, API Routes |
| createServerClient (middleware) | lib/supabase/middleware.ts | Publishable (anon) | Next.js Middleware |
| createClient (admin) | lib/supabase/admin.ts | Secret (service_role) | Privileged API Routes only |

All use lazy initialization (secrets loaded inside functions) to prevent build-time crashes and Webpack leakage.

### 8.2 Feature Flag Configuration

Flags in tenant_features table evaluated at:
- **Layout level** (web): fetched in app/(web)/layout.tsx, passed to Sidebar
- **API level**: checked via checkFeatureEnabled() RPC before processing

Default states from migration 20240032:
- meal_management: enabled by default
- attendance_tracking: enabled by default
- billing: enabled by default
- inventory_management: disabled by default
- pre_meal_requests: disabled by default
- custom_reports: disabled by default
- branch_management: disabled by default
- settings_module: conditional (migration 20240047)

### 8.3 Next.js Configuration

- images.unoptimized: true - avoids image optimization pipeline
- eslint.ignoreDuringBuilds: true - ESLint errors do NOT block builds
- typescript.ignoreBuildErrors: true - TypeScript errors do NOT block builds
- No output: export - SSR is active (previously commented out for Capacitor)

---

## 9. Environment Variables

| Variable | Prefix | Runtime | Purpose |
|---|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | NEXT_PUBLIC_ | All | Supabase project API URL |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | NEXT_PUBLIC_ | All | Supabase anon/publishable key (safe for browser) |
| SUPABASE_SECRET_KEY | - | Server only | Supabase service_role key (bypasses RLS) |
| ATTENDANCE_QR_SECRET | - | Server only | HMAC-SHA256 secret for session QR token signing |
| MEMBER_QR_SECRET | - | Server only | HMAC-SHA256 secret for member identity QR signing |
| RESEND_API_KEY | - | Server only | Resend transactional email API key |
| EMAIL_FROM | - | Server only | Sender address (no-reply@notify.mealiez.in) |
| APP_URL | - | Server only | Base URL (https://portal.mealiez.in) |
| VERCEL_GIT_COMMIT_SHA | - | Build time | Service worker cache busting |
| NEXT_PUBLIC_APP_VERSION | NEXT_PUBLIC_ | Build time | Alternative version string for service worker cache |

> **Security:** Dynamic property access (process.env[KEY]) used for all server secrets to prevent Webpack static analysis from inlining values into client bundles.

---

## 10. Dependency Graph

`mermaid
graph TD
    subgraph Next.js App Entry
        MW[middleware.ts]
        RL[app/layout.tsx Root]
    end
    subgraph Auth System
        SA[lib/supabase/admin.ts]
        SC[lib/supabase/client.ts]
        SS[lib/supabase/server.ts]
        SM[lib/supabase/middleware.ts]
        AR[lib/auth/roles.ts]
        ASS[lib/auth/session.ts]
        AG[lib/auth/guards.ts]
        ACS[lib/auth/client-session.ts]
        UG[hooks/useAuthGuard.ts]
    end
    subgraph Feature System
        FG[lib/features/gate.ts]
    end
    subgraph Domain Libraries
        AT[lib/attendance/token.ts]
        ES[lib/email/sendInvite.ts]
        ER[lib/email/resend.ts]
        UT[lib/utils.ts]
    end
    subgraph UI Layer
        WL[(web)/layout.tsx]
        MCL[(mobile)/mobile-client-layout.tsx]
        SB[components/web/Sidebar.tsx]
        MBN[components/mobile/MobileBottomNav.tsx]
        DR[components/DeviceRedirector.tsx]
    end
    subgraph API Routes
        OB[api/onboarding/register]
        ATT[api/attendance/mark]
        MQR[api/member-qr]
    end
    MW --> SM
    RL --> DR
    RL --> SC
    SM --> SS
    ASS --> SS
    ASS --> AR
    AG --> ASS
    AG --> AR
    ACS --> SC
    ACS --> AR
    UG --> ACS
    WL --> AG
    WL --> SS
    WL --> SB
    MCL --> ACS
    MCL --> MBN
    SB --> UT
    MBN --> ACS
    FG --> SA
    OB --> SA
    ATT --> SS
    ATT --> AT
    MQR --> SS
    MQR --> AT
    ES --> ER
    DR --> ACS
    DR --> UT
`

---

## 11. High-Level Request Lifecycle

### 11.1 Authenticated Web Page Request (GET /dashboard)

`mermaid
sequenceDiagram
    participant B as Browser
    participant MW as Middleware Edge
    participant SC as Server Component
    participant DB as Supabase DB
    participant Auth as Supabase Auth

    B->>MW: GET /dashboard with sb-cookie
    MW->>Auth: getUser() validates JWT
    Auth-->>MW: user or null
    alt must_change_password
        MW-->>B: 302 redirect to /change-password
    end
    MW->>MW: set x-pathname header
    MW-->>SC: forward request
    SC->>SC: requireAuth() in web layout
    SC->>Auth: getUser() cached via React cache()
    Auth-->>SC: user
    SC->>DB: SELECT users JOIN tenants WHERE auth_id = user.id
    DB-->>SC: AuthUser with id role tenant_id full_name
    SC->>DB: SELECT tenant_features WHERE tenant_id
    DB-->>SC: enabled features array
    SC->>SC: render Sidebar filtered by role and features
    SC->>SC: render page Server Component
    SC-->>B: HTML response
`

### 11.2 Mobile PWA Attendance QR Scan

`mermaid
sequenceDiagram
    participant M as Mobile Member
    participant PWA as MobileClientLayout
    participant Cam as Camera or jsqr
    participant API as /api/attendance/mark
    participant Tok as lib/attendance/token.ts
    participant DB as Supabase DB

    M->>PWA: navigate to /m/attendance/scan
    PWA->>PWA: useAuthGuard() verify session from localStorage
    PWA->>Cam: open camera stream
    M->>Cam: point at QR code
    Cam->>Cam: decode QR to token string
    Cam->>API: POST with token and Authorization Bearer JWT
    API->>Tok: verifyQRToken(token)
    Tok->>Tok: HMAC-SHA256 verify + 15 min expiry check
    Tok-->>API: valid=true with session_id payload
    API->>DB: INSERT attendance_records with UNIQUE session+user constraint
    DB-->>API: success or duplicate key
    API-->>M: marked=true or error already marked
`

### 11.3 New Tenant Onboarding (Registration)

`mermaid
sequenceDiagram
    participant U as New User Browser
    participant SA as Supabase Auth
    participant API as /api/onboarding/register (public)
    participant Admin as createAdminClient()
    participant DB as Supabase DB service_role

    U->>SA: signUp(email, password)
    SA-->>U: auth.user.id (uid)
    U->>API: POST with uid fullName orgName logoUrl
    API->>Admin: createAdminClient()
    API->>DB: rpc(onboard_new_tenant) with uid fullName orgName
    DB->>DB: INSERT tenants with slug = slugify + random suffix
    DB->>DB: INSERT users with role=admin and tenant_id
    DB->>DB: seed_tenant_features for this tenant_id
    DB-->>API: tenant_id user_id slug role
    API->>Admin: auth.admin.updateUserById set app_metadata tenant_id and role
    Admin-->>API: updated user
    API-->>U: success true
    U->>SA: signIn(email, password)
    SA->>SA: embed tenant_id and role in JWT app_metadata
    SA-->>U: JWT + cookie then redirect to /dashboard
`

---

_End of audit document. Every statement above is sourced directly from the repository source code. No inferences or assumptions have been made beyond what is explicitly present in the source files._
