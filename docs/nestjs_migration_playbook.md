# Mealiez → NestJS Backend: Detailed Migration Playbook

> **Scope:** Documentation only. No files in the Mealiez project are modified.
> **Goal:** Migrate all `app/api/*` route handlers into a standalone `mealiez-api/` NestJS project, and deploy the Next.js frontend as a separate application that calls the NestJS REST API.

---

## Table of Contents

1. [Project Bootstrap](#1-project-bootstrap)
2. [Folder Structure Convention](#2-folder-structure-convention)
3. [Environment Variables](#3-environment-variables)
4. [Core Infrastructure: SupabaseModule](#4-core-infrastructure-supabasemodule)
5. [Auth Strategy: Supabase JWT → NestJS Guards](#5-auth-strategy-supabase-jwt--nestjs-guards)
6. [Common Decorators](#6-common-decorators)
7. [Zod → class-validator: DTO Migration](#7-zod--class-validator-dto-migration)
8. [Module-by-Module Migration Guide](#8-module-by-module-migration-guide)
   - [8.1 AuthModule](#81-authmodule)
   - [8.2 UsersModule](#82-usersmodule)
   - [8.3 AttendanceModule](#83-attendancemodule)
   - [8.4 MealsModule](#84-mealsmodule)
   - [8.5 MealRequestsModule](#85-mealrequestsmodule)
   - [8.6 InventoryModule](#86-inventorymodule)
   - [8.7 BranchesModule](#87-branchesmodule)
   - [8.8 ReportsModule](#88-reportsmodule)
   - [8.9 SettingsModule](#89-settingsmodule)
   - [8.10 SuperAdminModule](#810-superadminmodule)
9. [Shared Services](#9-shared-services)
10. [Frontend Decoupling (Next.js)](#10-frontend-decoupling-nextjs)
11. [CORS, Cookies & Security](#11-cors-cookies--security)
12. [Deployment Architecture](#12-deployment-architecture)
13. [Week-by-Week Execution Plan](#13-week-by-week-execution-plan)
14. [Critical Rules & Anti-Patterns](#14-critical-rules--anti-patterns)

---

## 1. Project Bootstrap

### 1.1 Initialize the NestJS project

```bash
# From the C:\Mealiez root (sibling to mealiez/)
npx @nestjs/cli new mealiez-api --package-manager npm --skip-git

cd mealiez-api

# Install all required dependencies
npm install @nestjs/passport @nestjs/jwt passport passport-jwt
npm install @supabase/supabase-js
npm install @nestjs/config
npm install class-validator class-transformer
npm install @nestjs/common @nestjs/core @nestjs/platform-express
npm install resend
npm install reflect-metadata rxjs

# Dev
npm install -D @types/passport-jwt @types/node
```

### 1.2 Enable global pipes and validation in `main.ts`

```typescript
// mealiez-api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe (mirrors Zod safeParse behavior)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,         // strip unknown fields
    forbidNonWhitelisted: true,
    transform: true,         // auto-coerce query params to correct types
    transformOptions: { enableImplicitConversion: true },
  }));

  // CORS — configured separately in Section 11
  app.enableCors({ /* see Section 11 */ });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
```

---

## 2. Folder Structure Convention

```
mealiez-api/src/
├── main.ts
├── app.module.ts
│
├── common/                        ← Shared infrastructure
│   ├── supabase/
│   │   ├── supabase.module.ts
│   │   └── supabase.service.ts    ← Wraps admin + server clients
│   ├── guards/
│   │   ├── auth.guard.ts          ← Replaces getCurrentUser()
│   │   ├── roles.guard.ts         ← Replaces inline role checks
│   │   └── feature.guard.ts       ← Replaces checkFeatureEnabled()
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── roles.decorator.ts
│   │   └── require-feature.decorator.ts
│   └── types/
│       └── auth-user.type.ts      ← Mirrors lib/auth/roles.ts AuthUser
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── supabase-jwt.strategy.ts
│   │   └── super-admin-jwt.strategy.ts
│   └── dto/
│       ├── send-otp.dto.ts
│       └── verify-otp.dto.ts
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   └── dto/
│       ├── invite-user.dto.ts
│       ├── update-role.dto.ts
│       └── update-status.dto.ts
│
├── attendance/
│   ├── attendance.module.ts
│   ├── attendance.controller.ts
│   ├── attendance.service.ts
│   ├── token.service.ts           ← Ports lib/attendance/token.ts
│   └── dto/
│       ├── create-session.dto.ts
│       ├── mark-attendance.dto.ts
│       └── update-session.dto.ts
│
├── meals/
│   ├── meals.module.ts
│   ├── meals.controller.ts
│   ├── meals.service.ts
│   └── dto/
│
├── meal-requests/
│   ├── meal-requests.module.ts
│   ├── meal-requests.controller.ts
│   ├── meal-requests.service.ts
│   └── dto/
│
├── inventory/
│   ├── inventory.module.ts
│   ├── items/
│   ├── categories/
│   ├── batches/
│   ├── stock/
│   ├── transactions/
│   ├── recipes/
│   ├── alerts/
│   ├── gas/
│   ├── forecast/
│   └── barcode/
│
├── branches/
│   ├── branches.module.ts
│   ├── branches.controller.ts
│   ├── branches.service.ts
│   └── dto/
│
├── reports/
├── settings/
│   ├── designations/
│   └── meal-times/
│
└── super-admin/
    ├── super-admin.module.ts
    ├── super-admin.controller.ts
    ├── super-admin.service.ts
    └── dto/
```

---

## 3. Environment Variables

### 3.1 `mealiez-api/.env`

```bash
# Supabase (same values as mealiez/.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...           # Service role key — NEVER expose

# JWT secret used by Supabase to sign JWTs (found in Supabase Dashboard > API > JWT Secret)
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Cryptographic secrets (same as mealiez/.env.local)
ATTENDANCE_QR_SECRET=...
MEMBER_QR_SECRET=...

# Email
EMAIL_FROM=no-reply@notify.mealiez.in
RESEND_API_KEY=re_...

# App
APP_URL=https://app.mealiez.in      # Frontend URL
PORT=3001

# Super admin email list (comma-separated) OR rely on JWT app_metadata.is_super_admin
SUPER_ADMIN_EMAILS=admin@mealiez.in
```

### 3.2 `mealiez/.env.local` (frontend — add one line)

```bash
# New: point to NestJS backend
NEXT_PUBLIC_API_URL=https://api.mealiez.in

# All existing Supabase vars remain — frontend still needs them for direct auth
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

---

## 4. Core Infrastructure: SupabaseModule

This is the NestJS equivalent of `lib/supabase/admin.ts` and `lib/supabase/server.ts`.

### 4.1 `supabase.service.ts`

```typescript
// mealiez-api/src/common/supabase/supabase.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private _adminClient: SupabaseClient;

  constructor(private config: ConfigService) {}

  /**
   * getAdminClient()
   * Equivalent to createAdminClient() in lib/supabase/admin.ts
   * Bypasses RLS. Use for admin operations only.
   * SECURITY: Always scope queries with .eq('tenant_id', user.tenant_id)
   */
  getAdminClient(): SupabaseClient {
    if (!this._adminClient) {
      const url = this.config.getOrThrow('NEXT_PUBLIC_SUPABASE_URL');
      const key = this.config.getOrThrow('SUPABASE_SECRET_KEY');

      this._adminClient = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
    return this._adminClient;
  }

  /**
   * getAnonClient()
   * Equivalent to createClient() in lib/supabase/server.ts
   * Uses the anon key — respects RLS. Use when acting as the user.
   * NOTE: In NestJS, we don't have cookies. Pass the JWT manually.
   */
  getAnonClient(accessToken?: string): SupabaseClient {
    const url = this.config.getOrThrow('NEXT_PUBLIC_SUPABASE_URL');
    const key = this.config.getOrThrow('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

    const client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {},
      },
    });
    return client;
  }
}
```

### 4.2 `supabase.module.ts`

```typescript
// mealiez-api/src/common/supabase/supabase.module.ts
import { Global, Module } from '@nestjs/common';
import { SupabaseService } from './supabase.service';

@Global()  // Available in all modules without re-importing
@Module({
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}
```

---

## 5. Auth Strategy: Supabase JWT → NestJS Guards

This is the most critical and complex section. It completely replaces the Supabase SSR cookie system.

### 5.1 How the current auth works (Next.js)

```
Browser → Cookie (sb-*-auth-token)
  → Next.js middleware (updateSession) refreshes it
  → Server: createClient() reads cookie → supabase.auth.getUser()
  → getCurrentUser() assembles AuthUser from JWT + public.users profile
```

### 5.2 How auth will work in NestJS

```
Browser → sends Supabase JWT as Bearer token
  → NestJS AuthGuard extracts token from Authorization header
  → SupabaseJwtStrategy validates against Supabase JWT secret (JWKS)
  → @CurrentUser() decorator injects assembled AuthUser into controller
```

### 5.3 JWT Strategy — `supabase-jwt.strategy.ts`

```typescript
// mealiez-api/src/auth/strategies/supabase-jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { AuthUser } from '../../common/types/auth-user.type';

// Shape of the Supabase JWT payload
interface SupabaseJwtPayload {
  sub: string;           // auth.uid()
  email?: string;
  app_metadata: {
    tenant_id?: string;
    role?: string;
    branch_id?: string;
    is_super_admin?: boolean;
  };
  user_metadata: {
    is_super_admin?: boolean;
    full_name?: string;
  };
  exp: number;
}

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(Strategy, 'supabase-jwt') {
  constructor(
    config: ConfigService,
    private supabase: SupabaseService,
  ) {
    super({
      // Extract Bearer token from Authorization header
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Use the Supabase JWT secret (from Supabase Dashboard → API → JWT Secret)
      secretOrKey: config.getOrThrow('SUPABASE_JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  /**
   * validate()
   * Called after JWT signature is verified.
   * Mirrors getCurrentUser() from lib/auth/session.ts
   * The return value is injected as request.user
   */
  async validate(payload: SupabaseJwtPayload): Promise<AuthUser> {
    // Super admin check — return minimal object, handled by SuperAdminGuard
    const isSuperAdmin =
      payload.user_metadata?.is_super_admin === true ||
      payload.app_metadata?.is_super_admin === true;

    if (isSuperAdmin) {
      // Return super admin context — super admin routes use separate guard
      return {
        id: payload.sub,
        auth_id: payload.sub,
        tenant_id: '',         // no tenant
        role: 'admin',         // placeholder
        full_name: '',
        is_active: true,
        is_super_admin: true,
      } as any;
    }

    const tenant_id = payload.app_metadata?.tenant_id;
    if (!tenant_id) {
      throw new UnauthorizedException('tenant_id missing from JWT');
    }

    // Fetch profile from public.users — mirrors getCurrentUser() DB call
    const supabase = this.supabase.getAdminClient();
    const { data: profile, error } = await supabase
      .from('users')
      .select('id, full_name, is_active, role, branch_id, avatar_url, tenants(logo_url)')
      .eq('auth_id', payload.sub)
      .single();

    if (error || !profile || profile.is_active === false) {
      throw new UnauthorizedException('User not found or inactive');
    }

    let finalRole = profile.role;
    if (finalRole === 'owner') finalRole = 'admin'; // backward compat

    return {
      id:          profile.id,
      auth_id:     payload.sub,
      tenant_id,
      role:        finalRole,
      full_name:   profile.full_name,
      is_active:   profile.is_active,
      branch_id:   profile.branch_id,
      avatar_url:  profile.avatar_url,
      tenant_logo: (profile.tenants as any)?.logo_url,
    };
  }
}
```

### 5.4 AuthGuard — replaces `getCurrentUser()` pattern

```typescript
// mealiez-api/src/common/guards/auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JwtAuthGuard
 * Apply to any controller or route that requires a logged-in user.
 * Replaces: if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)              ← on controller or method
 *   @Get()
 *   findAll(@CurrentUser() user: AuthUser) { ... }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('supabase-jwt') {}
```

### 5.5 RolesGuard — replaces inline role checks

```typescript
// mealiez-api/src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthUser } from '../types/auth-user.type';

const ROLE_RANK: Record<string, number> = {
  admin:   3,
  manager: 2,
  member:  1,
};

/**
 * RolesGuard
 * Replaces all inline role checks in route handlers.
 *
 * Before (Next.js):
 *   if (!['admin', 'manager'].includes(currentUser.role)) {
 *     return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
 *   }
 *
 * After (NestJS):
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles('admin', 'manager')
 *   @Get()
 *   findAll() { ... }
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthUser = request.user;

    const userRank = ROLE_RANK[user.role] ?? 0;
    const meetsRequirement = requiredRoles.some(
      role => userRank >= (ROLE_RANK[role] ?? 0)
    );

    if (!meetsRequirement) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
```

### 5.6 FeatureGuard — replaces `checkFeatureEnabled()`

```typescript
// mealiez-api/src/common/guards/feature.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURE_KEY } from '../decorators/require-feature.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthUser } from '../types/auth-user.type';

/**
 * FeatureGuard
 * Replaces: checkFeatureEnabled(user.tenant_id, 'feature_key')
 *
 * Before (Next.js):
 *   const isEnabled = await checkFeatureEnabled(user.tenant_id, 'attendance_tracking')
 *   if (!isEnabled) return featureDisabledResponse()
 *
 * After (NestJS):
 *   @UseGuards(JwtAuthGuard, FeatureGuard)
 *   @RequireFeature('attendance_tracking')
 *   @Get()
 *   findAll() { ... }
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!feature) return true;

    const request = context.switchToHttp().getRequest();
    const user: AuthUser = request.user;

    const { data, error } = await this.supabase
      .getAdminClient()
      .rpc('is_feature_enabled', {
        p_tenant_id: user.tenant_id,
        p_feature:   feature,
      });

    if (error || data !== true) {
      throw new ForbiddenException('This feature is not enabled for your plan.');
    }
    return true;
  }
}
```

### 5.7 SuperAdminGuard — for `/super/*` routes

```typescript
// mealiez-api/src/common/guards/super-admin.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * SuperAdminGuard
 * Replaces: getSuperAdminUser() checks in super admin routes.
 * Must be used AFTER JwtAuthGuard so request.user is already populated.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.is_super_admin) {
      throw new UnauthorizedException('Super admin access required');
    }
    return true;
  }
}
```

---

## 6. Common Decorators

```typescript
// mealiez-api/src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../types/auth-user.type';

/**
 * @CurrentUser()
 * Replaces: const currentUser = await getCurrentUser()
 *
 * Before (Next.js):
 *   const currentUser = await getCurrentUser()
 *   if (!currentUser) return NextResponse.json(...)
 *
 * After (NestJS) — user is already validated by JwtAuthGuard:
 *   findAll(@CurrentUser() user: AuthUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

```typescript
// mealiez-api/src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// mealiez-api/src/common/decorators/require-feature.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const FEATURE_KEY = 'feature';
export const RequireFeature = (feature: string) => SetMetadata(FEATURE_KEY, feature);
```

```typescript
// mealiez-api/src/common/types/auth-user.type.ts
// Direct port of lib/auth/roles.ts AuthUser type
export type TenantRole = 'admin' | 'manager' | 'member';

export interface AuthUser {
  id:           string;
  auth_id:      string;
  tenant_id:    string;
  full_name:    string;
  email?:       string;
  role:         TenantRole;
  is_active:    boolean;
  branch_id?:   string | null;
  avatar_url?:  string | null;
  tenant_logo?: string | null;
}
```

---

## 7. Zod → class-validator: DTO Migration

All Zod schemas in `lib/validations/` become NestJS DTOs using `class-validator`.

### 7.1 Pattern: How to translate a Zod schema to a DTO

**Before (Zod — `lib/validations/users.ts`):**
```typescript
export const InviteUserSchema = z.object({
  email:         z.string().email().optional().nullable(),
  full_name:     z.string().min(2).max(100).trim(),
  enrollment_no: z.string().max(50).optional().nullable(),
  role:          z.enum(['manager', 'member']),
  branch_id:     z.string().uuid().optional().nullable(),
  invite_method: z.enum(['email', 'phone']).default('email'),
})
```

**After (class-validator DTO):**
```typescript
// mealiez-api/src/users/dto/invite-user.dto.ts
import {
  IsEmail, IsOptional, IsString, MinLength, MaxLength,
  IsEnum, IsUUID, IsIn,
} from 'class-validator';

export class InviteUserDto {
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 chars' })
  @MaxLength(100)
  full_name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  enrollment_no?: string | null;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsIn(['manager', 'member'], { message: 'Role must be manager or member' })
  role: 'manager' | 'member';

  @IsOptional()
  @IsUUID()
  branch_id?: string | null;

  @IsOptional()
  @IsUUID()
  designation_id?: string | null;

  @IsOptional()
  @IsEnum(['email', 'phone'])
  invite_method: 'email' | 'phone' = 'email';
}
```

### 7.2 Attendance DTOs

```typescript
// mealiez-api/src/attendance/dto/create-session.dto.ts
import { IsString, IsEnum, MinLength, MaxLength, IsOptional, IsUUID, Matches } from 'class-validator';

export class CreateSessionDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be YYYY-MM-DD' })
  session_date: string;

  @IsEnum(['breakfast', 'lunch', 'dinner', 'snack'])
  meal_type: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  label: string;

  @IsOptional()
  @IsUUID()
  meal_plan_item_id?: string | null;

  @IsOptional()
  @IsEnum(['session', 'member'])
  scan_mode: 'session' | 'member' = 'session';

  @IsOptional()
  @IsUUID()
  branch_id?: string | null;
}
```

```typescript
// mealiez-api/src/attendance/dto/mark-attendance.dto.ts
import { IsString, MinLength } from 'class-validator';

export class MarkAttendanceDto {
  @IsString()
  @MinLength(1)
  session_token: string;
}
```

### 7.3 Inventory DTOs (key ones)

```typescript
// mealiez-api/src/inventory/items/dto/create-item.dto.ts
import { IsString, IsOptional, IsUUID, IsEnum, IsNumber, Min, MaxLength } from 'class-validator';

export class CreateItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsUUID()
  category_id?: string | null;

  @IsEnum(['kg', 'g', 'l', 'ml', 'pcs', 'dozen', 'bag', 'box', 'bottle', 'pack'])
  unit: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  min_stock_level?: number = 0;
}
```

---

## 8. Module-by-Module Migration Guide

---

### 8.1 AuthModule

**Source files:** `app/api/auth/send-otp/`, `app/api/auth/verify-otp/`, `app/api/auth/session/`, `app/api/auth/send-reset-link/`, `app/api/auth/complete-password-change/`

#### Controller mapping

| Next.js Route | NestJS Endpoint | Method |
|---|---|---|
| `POST /api/auth/send-otp` | `POST /auth/send-otp` | Public |
| `POST /api/auth/verify-otp` | `POST /auth/verify-otp` | Public |
| `GET /api/auth/session` | `GET /auth/session` | `@JwtAuthGuard` |
| `POST /api/auth/send-reset-link` | `POST /auth/send-reset-link` | Public |
| `POST /api/auth/complete-password-change` | `POST /auth/complete-password-change` | `@JwtAuthGuard` |

#### auth.controller.ts skeleton

```typescript
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Public: anyone can request OTP
  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  // Public: verify OTP
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  // Protected: get current user context
  @UseGuards(JwtAuthGuard)
  @Get('session')
  getSession(@CurrentUser() user: AuthUser) {
    return { user };
  }
}
```

#### Key logic to port from `app/api/auth/send-otp/route.ts`

```typescript
// auth.service.ts — sendOtp()
// Direct port of POST handler logic:
// 1. Validate email exists in auth.users via supabaseAdmin.auth.admin.listUsers()
// 2. Generate 6-digit OTP using Math.floor(100000 + Math.random() * 900000)
// 3. Hash with SHA-256: crypto.createHash('sha256').update(otp).digest('hex')
// 4. Delete old OTPs: supabase.from('password_reset_otps').delete().eq('email', cleanEmail)
// 5. Insert new hash with 10-minute expiry
// 6. Route delivery: synthetic email (@mobile.mealiez.in) → SMS, real email → Resend
// 7. Log to recovery_audit_log
// Always return { success: true, message: '...' } — never reveal user existence
```

> [!NOTE]
> The `isSynthetic` check (`cleanEmail.endsWith('@mobile.mealiez.in')`) from `send-otp/route.ts` must be preserved exactly. This is the phone auth email pattern generated by `getPhoneAuthEmail()`.

---

### 8.2 UsersModule

**Source files:** `app/api/users/route.ts` (POST=invite), `app/api/users/[id]/route.ts` (GET, DELETE, PATCH), `app/api/users/bulk/route.ts`

#### Controller mapping

| Next.js Route | NestJS Endpoint | Guards |
|---|---|---|
| `POST /api/users` | `POST /users` | `JwtAuthGuard`, `Roles('admin')` |
| `GET /api/users/[id]` | `GET /users/:id` | `JwtAuthGuard`, `Roles('admin')` |
| `DELETE /api/users/[id]` | `DELETE /users/:id` | `JwtAuthGuard`, `Roles('admin')` |
| `PATCH /api/users/[id]` | `PATCH /users/:id` | `JwtAuthGuard`, `Roles('admin')` |
| `POST /api/users/bulk` | `POST /users/bulk` | `JwtAuthGuard`, `Roles('admin')` |

#### Controller skeleton

```typescript
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {

  @Post()
  @Roles('admin')   // only admin can invite
  invite(@CurrentUser() user: AuthUser, @Body() dto: InviteUserDto) {
    return this.usersService.inviteUser(user, dto);
  }

  @Get(':id')
  @Roles('admin')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.findOne(user, id);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.usersService.remove(user, id);
  }

  @Patch(':id')
  @Roles('admin')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user, id, dto);
  }
}
```

#### Key logic notes for `users.service.ts`

The invite flow from `app/api/users/route.ts` has 6 steps:

```typescript
// usersService.inviteUser()
// STEP 0: DNS deliverability check (keep as-is using node:dns/promises)
// STEP 1: canAssignRole(currentUser.role, role) — port from lib/auth/roles.ts
// STEP 2: RPC 'check_user_invitation_conflict' via supabaseAdmin
// STEP 3: If conflict → find existing user; else → supabaseAdmin.auth.admin.createUser()
// STEP 4: supabase.from('users').upsert({ onConflict: 'auth_id' })
// STEP 5: supabaseAdmin.auth.admin.updateUserById() — set app_metadata
// STEP 6: Fetch tenant name, send email (Resend) or SMS based on invite_method
//         → port sendInviteEmail() and sendInviteSms() into EmailService and SmsService
```

> [!WARNING]
> **Tenant isolation:** In `users/[id]/route.ts` DELETE handler there is a cross-tenant safety check:
> ```typescript
> if (user.tenant_id !== currentUser.tenant_id && currentUser.role !== 'superadmin') {
>   return 403
> }
> ```
> This MUST be preserved in `users.service.ts`. Never allow an admin to delete a user from another tenant.

---

### 8.3 AttendanceModule

**Source files:** `app/api/attendance/mark/`, `app/api/attendance/sessions/`, `app/api/attendance/schedules/`, `app/api/attendance/admin-scan/`, `app/api/attendance/stats/`

#### Controller mapping

| Next.js Route | NestJS Endpoint | Guards |
|---|---|---|
| `GET /api/attendance/mark?sessionId=` | `GET /attendance/records?sessionId=` | `JwtAuthGuard`, `Roles('admin','manager')`, `RequireFeature('attendance_tracking')` |
| `POST /api/attendance/mark` | `POST /attendance/mark` | `JwtAuthGuard`, `Roles('member')`, `RequireFeature('attendance_tracking')` |
| `GET /api/attendance/sessions` | `GET /attendance/sessions` | `JwtAuthGuard`, `RequireFeature('attendance_tracking')` |
| `POST /api/attendance/sessions` | `POST /attendance/sessions` | `JwtAuthGuard`, `Roles('admin','manager')`, `RequireFeature('attendance_tracking')` |
| `PATCH /api/attendance/sessions/[id]` | `PATCH /attendance/sessions/:id` | `JwtAuthGuard`, `Roles('admin','manager')` |
| `POST /api/attendance/admin-scan` | `POST /attendance/admin-scan` | `JwtAuthGuard`, `Roles('admin','manager')` |

#### QR Token Service — port of `lib/attendance/token.ts`

```typescript
// mealiez-api/src/attendance/token.service.ts
// This is a DIRECT, UNCHANGED port of lib/attendance/token.ts
// The cryptographic logic (HMAC-SHA256, timingSafeEqual) is 100% portable to NestJS.
// Just wrap it in an @Injectable() class that reads secrets from ConfigService.

@Injectable()
export class QrTokenService {
  constructor(private config: ConfigService) {}

  private getSecrets() {
    const attendance = this.config.getOrThrow('ATTENDANCE_QR_SECRET');
    const member     = this.config.getOrThrow('MEMBER_QR_SECRET');
    return { attendance, member };
  }

  // Copy signWith(), encodeWith(), decodeWith() from lib/attendance/token.ts verbatim.
  // Then expose:
  generateQRToken(sessionId, tenantId, mealType, date, ttlMinutes = 15): string { ... }
  verifyQRToken(token: string): QRTokenResult { ... }
  generateMemberQRToken(userId, tenantId, version): string { ... }
  verifyMemberQRToken(token: string): MemberQRVerifyResult { ... }
}
```

#### Critical mark-attendance logic

The POST `/attendance/mark` handler from `app/api/attendance/mark/route.ts` has a 7-step chain that MUST be preserved in order:

```
1. Only 'member' role can call this endpoint (staff forbidden from self-marking)
2. Feature flag: attendance_tracking must be enabled
3. Validate MarkAttendanceSchema → MarkAttendanceDto
4. verifyQRToken() — checks signature + expiry
5. Cross-validate: result.payload.tenant_id === currentUser.tenant_id
6. Verify session is_active in DB; check branch_id match (null = global session)
7. Insert attendance_records with idempotency (catch 23505 unique constraint)
```

---

### 8.4 MealsModule

**Source files:** `app/api/meals/items/`, `app/api/meals/plans/`, `app/api/meals/today/`

#### Controller mapping

| Next.js Route | NestJS Endpoint | Guards |
|---|---|---|
| `GET /api/meals/items` | `GET /meals/items` | `JwtAuthGuard` |
| `POST /api/meals/items` | `POST /meals/items` | `JwtAuthGuard`, `Roles('admin')` |
| `GET /api/meals/plans` | `GET /meals/plans` | `JwtAuthGuard` |
| `POST /api/meals/plans` | `POST /meals/plans` | `JwtAuthGuard`, `Roles('admin','manager')` |
| `GET /api/meals/today` | `GET /meals/today` | `JwtAuthGuard` |

No custom crypto or complex logic. Standard CRUD with tenant scoping.

---

### 8.5 MealRequestsModule

**Source files:** `app/api/meal-requests/route.ts`

#### Controller mapping

| Next.js Route | NestJS Endpoint | Guards |
|---|---|---|
| `GET /api/meal-requests` | `GET /meal-requests` | `JwtAuthGuard`, `RequireFeature('meal_management')` |
| `POST /api/meal-requests` | `POST /meal-requests` | `JwtAuthGuard`, `RequireFeature('meal_management')` |

#### Role-based query logic to preserve

```typescript
// In meal-requests.service.ts findAll():
// Members see only their own requests (add .eq('user_id', user.id))
// Manager/Admin see all requests for the tenant (optionally filter by ?user_id=)
if (user.role === 'member') {
  query = query.eq('user_id', user.id);
} else if (userId) {
  query = query.eq('user_id', userId);
}
```

The `action: 'cancel'` branch uses UPDATE status='cancelled', not DELETE — preserve this.

---

### 8.6 InventoryModule

This is the largest module. Split into sub-controllers, all under the `/inventory` prefix.

#### Sub-module structure

```
inventory/
├── inventory.module.ts        ← imports all sub-modules
├── items/
│   ├── items.controller.ts    ← GET, POST /inventory/items, /inventory/items/:id
│   └── items.service.ts
├── categories/
│   ├── categories.controller.ts
│   └── categories.service.ts
├── batches/
│   ├── batches.controller.ts
│   └── batches.service.ts
├── stock/
│   ├── stock.controller.ts    ← GET /inventory/stock, /inventory/stock/summary
│   └── stock.service.ts
├── transactions/
│   ├── transactions.controller.ts
│   └── transactions.service.ts
├── recipes/
│   ├── recipes.controller.ts
│   ├── recipes.service.ts
│   └── recipes-scale.controller.ts  ← POST /inventory/recipes/:id/scale
├── alerts/
│   ├── alerts.controller.ts
│   └── alerts.service.ts
├── gas/
│   ├── gas.controller.ts
│   └── gas.service.ts
├── forecast/
│   ├── forecast.controller.ts
│   └── forecast.service.ts
├── consumption/
│   ├── consumption.controller.ts
│   └── consumption.service.ts
└── barcode/
    ├── barcode.controller.ts
    └── barcode.service.ts
```

#### Feature flag pattern for inventory

ALL inventory sub-routes require `RequireFeature('inventory_management')`. Apply at the module level via a controller-level guard:

```typescript
@Controller('inventory/items')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
@RequireFeature('inventory_management')
export class ItemsController { ... }
```

#### Items service — key logic from `app/api/inventory/items/route.ts`

```typescript
// items.service.ts create()
// Step 1: Role check — admin only for create
// Step 2: Validate CreateItemDto
// Step 3: supabase.from('inventory_items').insert({ tenant_id: user.tenant_id, ...dto })
// Step 4: Call RPC 'initialize_item_stock' with { p_item_id, p_tenant_id }
//         This initializes the inventory_stock row for the new item.
// Step 5: Handle 23505 (unique constraint) → 409 Conflict
```

#### Transaction validation — preserve Zod `.refine()` logic

The `CreateTransactionSchema` in `lib/validations/inventory.ts` has a cross-field `.refine()` that validates quantity direction matches transaction type:
- `purchase` → quantity must be positive
- `consumption` / `wastage` → quantity must be negative
- `adjustment` → either direction allowed

In NestJS, use a custom validator:

```typescript
// mealiez-api/src/inventory/transactions/dto/create-transaction.dto.ts
import { registerDecorator, ValidationOptions } from 'class-validator';

// Custom decorator to enforce quantity direction by transaction type
export function IsValidQuantityDirection(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidQuantityDirection',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: any) {
          const obj = args.object as CreateTransactionDto;
          if (obj.transaction_type === 'purchase') return obj.quantity > 0;
          if (['consumption', 'wastage'].includes(obj.transaction_type)) return obj.quantity < 0;
          return true; // adjustment
        },
        defaultMessage() {
          return 'Quantity direction does not match transaction type';
        },
      },
    });
  };
}
```

---

### 8.7 BranchesModule

**Source files:** `app/api/branches/route.ts`, `app/api/branches/[id]/route.ts`

#### Controller mapping

| Next.js Route | NestJS Endpoint | Guards |
|---|---|---|
| `GET /api/branches` | `GET /branches` | `JwtAuthGuard` |
| `POST /api/branches` | `POST /branches` | `JwtAuthGuard`, `Roles('admin')`, `RequireFeature('branch_management')` |
| `GET /api/branches/:id` | `GET /branches/:id` | `JwtAuthGuard`, `Roles('admin')` |
| `PATCH /api/branches/:id` | `PATCH /branches/:id` | `JwtAuthGuard`, `Roles('admin')` |
| `DELETE /api/branches/:id` | `DELETE /branches/:id` | `JwtAuthGuard`, `Roles('admin')` |

#### Plan limit logic to preserve from `app/api/branches/route.ts POST`

```typescript
// branches.service.ts create()
// 1. RequireFeature('branch_management') guard handles feature check
// 2. Fetch tenant.plan from tenants table
// 3. Count existing branches for this tenant
// 4. Apply plan limit:
//    enterprise → 999, pro → 5, free/basic → 1
// 5. If count >= limit → throw ForbiddenException('Plan limit reached...')
```

---

### 8.8 ReportsModule

**Source files:** `app/api/reports/today-summary/`

Standard data aggregation endpoint. No complex logic. Apply `JwtAuthGuard`, `Roles('admin','manager')`.

---

### 8.9 SettingsModule

**Source files:** `app/api/settings/designations/`, `app/api/settings/meal-times/`

Two simple CRUD sub-controllers. Apply `JwtAuthGuard`. Designations require `Roles('admin')` for create/update/delete.

---

### 8.10 SuperAdminModule

**Source files:** `app/api/super/messes/`, `app/api/super/features/`, `app/api/super/subscriptions/`, `app/api/super/stats/`

#### Auth pattern — uses `getSuperAdminUser()`, NOT `getCurrentUser()`

In NestJS, the `SupabaseJwtStrategy.validate()` sets `is_super_admin: true` on the user object. The `SuperAdminGuard` then checks this flag.

```typescript
@Controller('super')
@UseGuards(JwtAuthGuard, SuperAdminGuard)  // Both required
export class SuperAdminController {

  @Get('messes')
  getMesses(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('plan') plan?: string,
    @Query('search') search?: string,
  ) {
    return this.superAdminService.getMesses({ page, limit, plan, search });
  }
}
```

#### Key logic from `app/api/super/messes/route.ts`

```typescript
// superAdminService.getMesses()
// Uses adminClient (bypasses RLS — acceptable for super admin)
// Paginated query on tenants table with optional plan/search filters
// Batch-fetches user counts per tenant using .in('tenant_id', tenantIds)
// Returns member_count per tenant (join map pattern, not SQL join)
```

---

## 9. Shared Services

### 9.1 EmailService — port of `lib/email/sendInvite.ts`

```typescript
// mealiez-api/src/common/email/email.service.ts
@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private config: ConfigService) {
    this.resend = new Resend(config.getOrThrow('RESEND_API_KEY'));
  }

  /**
   * sendInvite()
   * Port of lib/email/sendInvite.ts — preserves 3-retry logic with 1s delay
   */
  async sendInvite(to: string, orgName: string, tempPassword: string, loginUrl: string) {
    let retries = 3;
    while (retries > 0) {
      try {
        await this.resend.emails.send({
          from: `Mealiez <${this.config.get('EMAIL_FROM', 'no-reply@notify.mealiez.in')}>`,
          to,
          subject: 'Welcome to Mealiez',
          html: getInviteEmailTemplate(orgName, to, tempPassword, loginUrl),
        });
        return { success: true };
      } catch (err) {
        retries--;
        if (retries > 0) await new Promise(r => setTimeout(r, 1000));
      }
    }
    return { success: false };
  }

  /**
   * sendOtp()
   * Port of the Resend OTP email in app/api/auth/send-otp/route.ts
   */
  async sendOtp(to: string, otp: string) { ... }
}
```

### 9.2 SmsService — replace stub

```typescript
// mealiez-api/src/common/sms/sms.service.ts
// Current lib/sms/sendInvite.ts is a MOCK that always returns { success: true }
// In NestJS, implement with a real provider (Twilio, MessageBird, etc.)
// Keep the same interface for backward compatibility

@Injectable()
export class SmsService {
  async sendInvite(phone: string, orgName: string, tempPassword: string, loginUrl: string) {
    // TODO: Implement with Twilio or equivalent
    // For now, log and return success (mirrors current behavior)
    console.log(`[SMS STUB] Invite to ${phone}: login at ${loginUrl} pw: ${tempPassword}`);
    return { success: true };
  }

  async sendOtp(phone: string, otp: string) {
    console.log(`[SMS STUB] OTP to ${phone}: ${otp}`);
    return { success: true };
  }
}
```

---

## 10. Frontend Decoupling (Next.js)

### 10.1 What changes in the Next.js frontend

| File / Pattern | Current | After Migration |
|---|---|---|
| `app/api/*/route.ts` | All exist | **DELETE entire `app/api/` directory** |
| `lib/supabase/admin.ts` | Used in API routes | **DELETE** (only used server-side) |
| `lib/supabase/server.ts` | Used in API routes + Server Components | Keep for Server Component auth only |
| `lib/auth/session.ts` | Used in API routes + Server Components | Keep `getSession()` for Server Components, remove `getCurrentUser()` or convert it to call NestJS |
| `lib/auth/guards.ts` | Calls `getCurrentUser()` + `redirect()` | Keep as-is — still valid in Server Components |
| `lib/features/gate.ts` | `NextResponse` import | **DELETE** — handled by NestJS FeatureGuard |
| `fetch('/api/...')` calls | All frontend API calls | Replace with `fetch(\`${process.env.NEXT_PUBLIC_API_URL}/...\`)` |
| `middleware.ts` | Handles cookie refresh + `must_change_password` | Keep cookie refresh, remove `must_change_password` check (NestJS handles this) |

### 10.2 API call pattern — before and after

**Before:**
```typescript
// Inside a Client Component
const res = await fetch('/api/attendance/sessions', {
  method: 'GET',
});
```

**After:**
```typescript
// lib/api.ts — create a shared API client helper
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function apiGet(path: string, token: string) {
  return fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiPost(path: string, body: unknown, token: string) {
  return fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}
```

### 10.3 Getting the Bearer token in frontend components

**Client Components** — use `getClientSession()` (already exists in `lib/auth/client-session.ts`):

```typescript
'use client'
import { getClientSession } from '@/lib/auth/client-session'
import { apiGet } from '@/lib/api'

export function AttendanceList() {
  useEffect(() => {
    async function load() {
      const session = await getClientSession()
      const token = session?.access_token
      if (!token) return

      const res = await apiGet('/attendance/sessions', token)
      const data = await res.json()
      // ...
    }
    load()
  }, [])
}
```

**Server Components** — use `getSession()` from `lib/auth/session.ts`:

```typescript
// app/(web)/attendance/page.tsx
import { getSession } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function AttendancePage() {
  const sessionData = await getSession()
  if (!sessionData) redirect('/login')

  const token = sessionData.session?.access_token
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendance/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const { data } = await res.json()

  return <AttendanceTable sessions={data} />
}
```

### 10.4 Middleware — what stays, what goes

**Keep:**
```typescript
// middleware.ts — keep the session refresh and device redirect
// updateSession() in lib/supabase/middleware.ts still needed for cookie freshness
// isMobile redirect logic stays unchanged
```

**Remove from `lib/supabase/middleware.ts`:**
```typescript
// DELETE THIS BLOCK — NestJS now handles must_change_password enforcement
// via a guard on the /auth/complete-password-change endpoint
if (user && !pathname.startsWith('/change-password') && !pathname.startsWith('/api/')) {
  const { data: profile } = await supabase.from('users').select('must_change_password')...
  if (profile?.must_change_password) {
    return NextResponse.redirect(url)  // ← Remove this block
  }
}
```

> [!NOTE]
> The `must_change_password` redirect was happening in Next.js middleware because API routes and pages were collocated. Once separated, the frontend can implement this check in a Client Component on page load using `getClientUser()`, or keep a lightweight API call to `GET /auth/session` which can include the flag.

---

## 11. CORS, Cookies & Security

### 11.1 NestJS CORS configuration

```typescript
// mealiez-api/src/main.ts
app.enableCors({
  origin: [
    'https://app.mealiez.in',         // Production frontend
    'http://localhost:3000',           // Local Next.js dev
    'capacitor://localhost',           // Capacitor Android
    'http://localhost',                // Capacitor fallback
  ],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,  // We use Bearer tokens, not cookies
});
```

> [!IMPORTANT]
> Set `credentials: false` in NestJS CORS. Since auth is via Bearer token (not cookies), `credentials: true` is not needed and adds unnecessary complexity.

### 11.2 Capacitor Android — URL scheme

Capacitor's Android WebView sends requests from `capacitor://localhost`. This origin MUST be in the allowed list, or all API calls from the Android app will fail with CORS errors.

### 11.3 Security headers

Add to NestJS:
```typescript
// mealiez-api/src/main.ts
import helmet from 'helmet';
app.use(helmet());
```

```bash
npm install helmet
```

### 11.4 Rate limiting

```bash
npm install @nestjs/throttler
```

```typescript
// app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60_000,     // 1 minute window
  limit: 100,      // 100 requests per minute per IP
}])
```

Apply stricter limits to auth endpoints:
```typescript
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 5, ttl: 60000 } })  // 5 OTP requests/minute
@Post('send-otp')
sendOtp(...) {}
```

---

## 12. Deployment Architecture

### 12.1 Target deployment topology

```
┌─────────────────────────────────────────────────────┐
│  Browser / Capacitor Android                        │
└───────────┬─────────────────────────┬───────────────┘
            │                         │
            ▼                         ▼
┌───────────────────┐    ┌────────────────────────┐
│  app.mealiez.in   │    │  api.mealiez.in        │
│  Next.js 14       │    │  NestJS                │
│  (Netlify/Vercel) │    │  (Railway/Render/Fly)  │
└───────────────────┘    └────────────┬───────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │  Supabase (Postgres)   │
                         │  Auth + DB + Storage   │
                         └────────────────────────┘
```

### 12.2 Recommended hosting for NestJS (`mealiez-api`)

| Platform | Cost | Cold Start | Notes |
|---|---|---|---|
| **Railway** | ~$5/mo | None (persistent) | Best DX, always-on |
| **Render** | Free tier | ~500ms | Free tier has cold starts |
| **Fly.io** | ~$3/mo | None | Good for low latency |
| **Vercel** (serverless) | Free | None | NestJS works but needs adapter |

### 12.3 Frontend deployment (`mealiez`) — no changes needed

The `netlify.toml` already exists. Just add the `NEXT_PUBLIC_API_URL` environment variable in the Netlify dashboard.

### 12.4 Strangler Fig migration strategy (recommended)

Migrate one endpoint at a time using Netlify rewrites:

```toml
# mealiez/netlify.toml — add during migration
[[redirects]]
  from = "/api/attendance/*"
  to = "https://api.mealiez.in/attendance/:splat"
  status = 200
  force = true

# Keep unmigrated routes going to the old Next.js handlers:
# (Next.js API routes are still present and serving until deleted)
```

This means:
1. You can migrate one module to NestJS
2. Add its redirect to `netlify.toml`
3. Frontend fetch calls (`/api/attendance/*`) still work — Netlify proxies them
4. No frontend code changes required until the very end
5. Delete the old Next.js route handler once the NestJS version is verified

---

## 13. Week-by-Week Execution Plan

### Week 1: Foundation

| Day | Task |
|---|---|
| 1 | Bootstrap `mealiez-api/` with NestJS CLI. Configure `main.ts`, `AppModule`, `.env`. |
| 2 | Implement `SupabaseModule` (admin + anon clients). Write unit test. |
| 3 | Implement `SupabaseJwtStrategy`, `JwtAuthGuard`. Test with a real Supabase JWT. |
| 4 | Implement `RolesGuard`, `FeatureGuard`, `SuperAdminGuard`. All decorators. |
| 5 | Implement `AuthModule` — port `send-otp`, `verify-otp`, `session`, `complete-password-change`. |

**Milestone:** `GET /auth/session` returns user context when called with a valid Supabase Bearer token.

---

### Week 2: Core Domain Modules

| Day | Task |
|---|---|
| 6 | Port `UsersModule` — invite, [id] GET/DELETE/PATCH. Email/SMS services. |
| 7 | Port `QrTokenService` from `lib/attendance/token.ts`. Unit test with known payloads. |
| 8 | Port `AttendanceModule` — sessions (GET, POST), mark attendance (GET, POST). |
| 9 | Port `AttendanceModule` — admin-scan, schedules, stats. |
| 10 | Port `MealsModule` + `MealRequestsModule`. |

**Milestone:** Attendance flow works end-to-end: create session → generate QR → member marks via QR.

---

### Week 3: Inventory + Remaining Modules

| Day | Task |
|---|---|
| 11 | Port `InventoryModule` — categories, items (GET/POST/PATCH). |
| 12 | Port `InventoryModule` — transactions, stock, alerts. |
| 13 | Port `InventoryModule` — batches, gas, barcode, forecast, consumption. |
| 14 | Port `InventoryModule` — recipes + recipe scale endpoint. |
| 15 | Port `BranchesModule`, `ReportsModule`, `SettingsModule` (designations, meal-times). |

**Milestone:** All NestJS endpoints respond correctly for happy-path scenarios.

---

### Week 4: Super Admin + Frontend Decoupling

| Day | Task |
|---|---|
| 16 | Port `SuperAdminModule` — messes, features, subscriptions, stats. |
| 17 | Create `lib/api.ts` in Next.js frontend (shared API client with Bearer token helper). |
| 18 | Update all Client Components to use `lib/api.ts` instead of `fetch('/api/...')`. |
| 19 | Update all Server Components to forward Bearer token to NestJS. |
| 20 | Update `middleware.ts` — remove `must_change_password` check, keep cookie refresh. |

---

### Week 5: CORS, Deployment, Capacitor

| Day | Task |
|---|---|
| 21 | Configure CORS in NestJS main.ts. Test from browser, Postman, Capacitor origin. |
| 22 | Deploy `mealiez-api` to Railway (or chosen platform). Set all env vars. |
| 23 | Set `NEXT_PUBLIC_API_URL` in Netlify dashboard. Redeploy frontend. |
| 24 | Rebuild Capacitor Android app with updated API URL. Smoke-test on device. |
| 25 | E2E testing: login → attendance → inventory → reports. Fix issues. |

---

### Week 6: Cleanup + Hardening

| Day | Task |
|---|---|
| 26 | Delete `app/api/` directory from Next.js. Remove unused `lib/` server utilities. |
| 27 | Add rate limiting (`@nestjs/throttler`) to auth and sensitive endpoints. |
| 28 | Add `helmet` security headers. Review all tenant isolation (`.eq('tenant_id', ...)`) checks. |
| 29 | Verify all 54 Supabase migrations and RPCs still work correctly via NestJS. |
| 30 | Documentation update, handoff review. |

---

## 14. Critical Rules & Anti-Patterns

### ✅ ALWAYS DO

- **Always use `supabaseAdmin.getAdminClient()`** when calling `auth.admin.*` methods (createUser, deleteUser, updateUserById, listUsers).
- **Always scope every DB query with `.eq('tenant_id', user.tenant_id)`** when using the admin client. RLS is OFF.
- **Always validate the user's tenant matches the resource's tenant** before any mutation (see `users/[id]/route.ts` DELETE handler example).
- **Always use `@CurrentUser()` decorator** to get user context. Never re-fetch the user inside a service method.
- **Always preserve the 3-retry loop** when sending emails via Resend (from `lib/email/sendInvite.ts`).
- **Always use `timingSafeEqual`** for QR token verification (from `lib/attendance/token.ts`). This prevents timing attacks.
- **Always return opaque success messages** from OTP endpoints (`'If an account exists, an OTP has been sent.'`). Never reveal user existence.

### ❌ NEVER DO

- **Never use the anonClient for admin operations.** The anon client respects RLS — it's fine for user-scoped queries but cannot access `auth.admin.*` APIs.
- **Never import `lib/supabase/admin.ts` or `lib/auth/session.ts`** from the NestJS project. Implement equivalents natively.
- **Never skip the feature flag guard** on inventory, attendance, or branch endpoints. Check the existing route handler comments for which feature key is required.
- **Never allow cross-tenant operations.** A manager from Tenant A must never be able to read or write data for Tenant B.
- **Never put the `SUPABASE_SECRET_KEY` or `SUPABASE_JWT_SECRET`** in any response body, log, or error message.
- **Never use React-specific APIs** (`cache()`, `cookies()` from `next/headers`, `redirect()` from `next/navigation`) in NestJS code.
- **Never delete the Next.js API routes until the corresponding NestJS endpoints are fully verified in production.**
