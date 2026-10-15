# TechTrioz IMS — Backend API Specification

> **Audience:** Backend team.
> **Source:** Derived from every screen, form, and action in the frontend (`ttz-incedent-management-system`). Each endpoint lists the screen that calls it, so you can check it against the UI.
> **Status legend:** ✅ already live (auth) · 🆕 needs to be built · ⭐ optional / nice-to-have

---

## Table of contents

0. [Conventions (read first)](#0-conventions-read-first)
1. [Auth](#1-auth)
2. [Profile & Preferences (current user)](#2-profile--preferences-current-user)
3. [Users (admin)](#3-users-admin)
4. [Roles & Permissions](#4-roles--permissions)
5. [Projects](#5-projects)
6. [Project Members](#6-project-members)
7. [Issues](#7-issues)
8. [Issue Comments](#8-issue-comments)
9. [Issue Attachments](#9-issue-attachments)
10. [Issue History](#10-issue-history)
11. [Groups (chat)](#11-groups-chat)
12. [Group Messages](#12-group-messages)
13. [Notifications](#13-notifications)
14. [Activity Log](#14-activity-log)
15. [Dashboard](#15-dashboard)
16. [Reports](#16-reports)
17. [Global Search](#17-global-search)
18. [System Settings](#18-system-settings)
19. [Lookups / Enums](#19-lookups--enums)
20. [Business rules the backend must enforce](#20-business-rules-the-backend-must-enforce)
21. [Side effects (activity log + notifications)](#21-side-effects-activity-log--notifications)
22. [Endpoint summary table](#22-endpoint-summary-table)

---

## 0. Conventions (read first)

These match what the live auth endpoints already do, so keep them for every new module.

### 0.1 Base

| Item | Value |
|---|---|
| Base path | `/api` |
| Content type | `application/json` (multipart only for file uploads) |
| Auth header | `Authorization: Bearer <access_token>` on every endpoint except the public auth ones |
| Field casing | `snake_case` in both requests and responses |
| IDs | integers (`id: 42`) |
| Dates | ISO 8601 UTC strings: `"2026-10-14T09:30:00Z"`. Date-only fields (`start_date`, `due_date`) use `"2026-10-14"` |
| Empty optional values | send/return `null`, never omit the key in responses |

### 0.2 Response envelope

**Every** response uses this shape. The frontend already reads `data`, `message`, `errors` and `code` from it.

```jsonc
// Success (single object)
{
  "success": true,
  "message": "Project created successfully.",   // string | null — shown as a toast
  "data": { /* object */ }
}
```

```jsonc
// Success (list with pagination)
{
  "success": true,
  "message": null,
  "data": [ /* items */ ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 134,
    "last_page": 7
  }
}
```

```jsonc
// Error
{
  "success": false,
  "message": "The given data was invalid.",       // human readable, shown in toast
  "code": "VALIDATION_ERROR",                      // machine readable
  "errors": {                                      // only for 422, keyed by request field
    "key": ["A project with this key already exists."],
    "start_date": ["Start date is required."]
  },
  "data": null
}
```

> The frontend maps `errors.<field>[0]` onto the matching form field, so **error keys must be the exact request field names** (`member_ids`, not `members`).

### 0.3 HTTP status codes

| Status | When | `code` examples |
|---|---|---|
| 200 | OK (read / update / action) | — |
| 201 | Created | — |
| 204 | Not used — return 200 with `data: null` instead so the envelope is always there | — |
| 400 | Bad business request (rule violated) | `INVALID_STATUS_TRANSITION`, `CANNOT_DELETE_DEFAULT_GROUP` |
| 401 | Missing/expired token (frontend then calls `/auth/refresh`) | `UNAUTHENTICATED`, `TOKEN_EXPIRED` |
| 403 | Logged in but no permission | `FORBIDDEN` |
| 404 | Not found **or not visible to this user** (don't leak existence of secret groups / other projects) | `NOT_FOUND` |
| 409 | Conflict (duplicate / still in use) | `ROLE_IN_USE`, `DUPLICATE_KEY` |
| 422 | Validation failed | `VALIDATION_ERROR` |
| 429 | Rate limited (OTP, login) | `TOO_MANY_REQUESTS` |
| 500 | Server error | `SERVER_ERROR` |

### 0.4 List query parameters (all list endpoints)

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int | 1 | |
| `per_page` | int | 20 | max 100. `per_page=all` ⭐ for dropdowns (returns everything, no `meta`) |
| `search` | string | — | case-insensitive, fields listed per endpoint |
| `sort` | string | per endpoint | prefix `-` for descending, e.g. `sort=-updated_at` |

Array filters use comma-separated values: `status=todo,in_progress`.

### 0.5 Embedded "user summary"

Whenever a response refers to a user (owner, assignee, reporter, actor, author, sender…), return both the id **and** a small embedded object so the frontend doesn't need a second request:

```jsonc
// UserSummary
{
  "id": 7,
  "name": "Ayesha Rahman",
  "email": "ayesha@techtrioz.com",
  "avatar_url": "https://cdn.../avatars/7.webp",  // string | null
  "avatar_color": "#2563eb",                       // used for initials fallback
  "designation": "Backend Developer",              // string | null
  "status": "active"
}
```

Same idea for projects:

```jsonc
// ProjectSummary
{ "id": 3, "name": "Atlas Platform", "key": "ATL", "color": "#2563eb" }
```

### 0.6 Permission names

The frontend uses these permission strings everywhere (sidebar, buttons, route guards). **Please use the exact same strings in the API** (in `access.projects[].permissions` and in role definitions). The live API currently sends a few different names (`projects.edit`, `issues.pick`, `issues.status`, `comments.create`, `users.edit`) which the frontend has to alias — please switch to the list below.

| Module | Permissions |
|---|---|
| dashboard | `dashboard.view` |
| projects | `projects.view` `projects.create` `projects.update` `projects.delete` `projects.assign_members` |
| issues | `issues.view` `issues.create` `issues.update` `issues.delete` `issues.assign` `issues.change_status` `issues.comment` `issues.approve` |
| users | `users.view` `users.create` `users.update` `users.deactivate` |
| roles | `roles.view` `roles.create` `roles.update` `roles.delete` `roles.assign_permissions` |
| groups | `groups.view` `groups.create` `groups.update` `groups.delete` `groups.manage_members` `groups.send_message` |
| reports | `reports.view` `reports.export` |
| notifications | `notifications.view` |
| settings | `settings.view` `settings.update` |
| activity | `activity.view` `activity.export` |

Each endpoint below lists the permission it requires (**Perm**). Super Admin has all permissions and sees all projects.

---

## 1. Auth

✅ Already live. Listed here so the spec is complete, plus the few changes the frontend needs.

### 1.1 `POST /api/auth/login` ✅ — Login page

Request:
```json
{ "email": "user@techtrioz.com", "password": "Secret123" }
```

Response `200` → `data: AuthPayload`
```jsonc
{
  "access_token": "eyJ...",
  "refresh_token": "def...",
  "expires_in": 3600,               // seconds
  "token_type": "Bearer",
  "must_change_password": false,    // true → frontend forces /change-password
  "user": { /* ApiUser, see 1.3 */ },
  "access": { /* UserAccess, see 1.3 */ }
}
```

Errors: `401 INVALID_CREDENTIALS`, `403 ACCOUNT_INACTIVE`, `429 TOO_MANY_REQUESTS`.

### 1.2 `POST /api/auth/refresh` ✅

Request: `{ "refresh_token": "def..." }` → Response: same `AuthPayload` as login.

### 1.3 `GET /api/auth/me` ✅ — called on every app load

Response `data`:
```jsonc
{
  "id": 7,
  "name": "Ayesha Rahman",
  "email": "ayesha@techtrioz.com",
  "phone": "+8801711000000",          // string | null
  "designation": "Backend Developer", // string | null
  "department": "Engineering",        // 🆕 string | null
  "bio": "…",                         // 🆕 string | null
  "avatar_url": null,                 // 🆕 string | null
  "avatar_color": "#2563eb",          // 🆕
  "status": "active",
  "is_super_admin": false,
  "must_change_password": false,
  "last_login_at": "2026-10-14T08:00:00Z",
  "created_at": "2026-01-02T10:00:00Z",
  "roles": [ { "id": 2, "name": "Developer" } ],   // 🆕 global roles
  "access": {
    "is_super_admin": false,
    "can_manage_users": false,
    "permissions": ["dashboard.view", "users.view"],  // 🆕 global (non-project) permissions
    "projects": [
      {
        "project_id": 3,
        "project_name": "Atlas Platform",
        "role": "Backend Developer",
        "permissions": ["projects.view", "issues.view", "issues.create", "issues.comment"]
      }
    ]
  },
  "unread_notifications_count": 4       // 🆕 used by the topbar bell badge
}
```

> 🆕 Add `department`, `bio`, `avatar_url`, `avatar_color`, `roles`, `access.permissions`, `unread_notifications_count`. These are shown on the profile card, sidebar, and topbar.

### 1.4 `POST /api/auth/logout` ✅

No body. Response `data: null`. Should revoke the refresh token.

### 1.5 `POST /api/auth/change-password` ✅ — Settings → Password, forced change page

```json
{ "current_password": "Old12345", "password": "New12345", "password_confirmation": "New12345" }
```

Rules: min 8, at least one uppercase, one lowercase, one digit; must differ from current.
Response: `data: null`, or a fresh `AuthPayload` if you rotate tokens (the frontend handles both). Sets `must_change_password = false`.

### 1.6 Forgot-password flow ✅ — Forgot password page (3 steps)

| Step | Endpoint | Body | Response `data` |
|---|---|---|---|
| 1 | `POST /api/auth/forgot-password` | `{ "email" }` | `null` (always 200, even if the email doesn't exist) |
| 2 | `POST /api/auth/verify-forgot-otp` | `{ "email", "otp": "123456" }` | `{ "reset_token": "abc..." }` |
| 3 | `POST /api/auth/reset-password` | `{ "email", "otp", "reset_token", "password", "password_confirmation" }` | `null` |

> Please **document and fix the step 2 response key as `reset_token`**. The frontend currently accepts either `token` or `reset_token` because it isn't defined.
> Resend code = call step 1 again (please rate-limit, e.g. 1/min).
> Error codes used by the UI: `INVALID_OTP`, `OTP_EXPIRED`.

### 1.7 Register

The UI has a register page, but self-registration is **disabled** ("contact your administrator"). No endpoint is needed. Accounts are created through [3.3](#33-post-apiusers--create-user).

---

## 2. Profile & Preferences (current user)

Screen: **Settings → Profile card**, **Settings → Preferences**.

### 2.1 `PATCH /api/profile` 🆕 — update own profile

Perm: any logged-in user.

```jsonc
{
  "name": "Ayesha Rahman",          // required, 2–100 chars
  "email": "ayesha@techtrioz.com",  // required, valid email, unique
  "designation": "Senior Developer",// nullable, max 100   (UI label: "Title")
  "department": "Engineering",      // nullable, max 100
  "phone": "+8801711000000",        // nullable, regex ^[+\d][\d\s-]{5,}$
  "bio": "…",                       // nullable, max 1000
  "avatar_color": "#2563eb"         // hex color, used when there is no avatar image
}
```

Response `200` → `data`: the same object as `GET /api/auth/me`.
Errors: `422` with `errors.email = ["An account with this email already exists."]`.

### 2.2 `POST /api/profile/avatar` 🆕 — upload avatar

`multipart/form-data`, field `avatar`. Allowed: `image/png, image/jpeg, image/webp, image/gif`, max **5 MB**. The frontend already crops the image to a square, but the server should still resize it (for example to 256×256 WebP).

Response:
```json
{ "success": true, "message": "Avatar updated.", "data": { "avatar_url": "https://cdn.../avatars/7.webp" } }
```

### 2.3 `DELETE /api/profile/avatar` 🆕 — remove avatar

Response `data: { "avatar_url": null }`.

### 2.4 `GET /api/profile/preferences` 🆕

Response `data`:
```json
{
  "theme": "light",
  "email_notifications": true,
  "push_notifications": true,
  "deadline_alerts": true,
  "mention_alerts": true
}
```

### 2.5 `PATCH /api/profile/preferences` 🆕

Body: any subset of the fields above (`theme` ∈ `light | dark`, others boolean). Response: the full preferences object.

---

## 3. Users (admin)

Screen: **Users page** (table + search + filters), **User form dialog** (create/edit), activate/deactivate confirm.

### User object

```jsonc
// User
{
  "id": 7,
  "name": "Ayesha Rahman",
  "email": "ayesha@techtrioz.com",
  "designation": "Backend Developer",
  "department": "Engineering",
  "phone": "+8801711000000",
  "bio": null,
  "avatar_url": null,
  "avatar_color": "#2563eb",
  "status": "active",                  // active | inactive
  "is_super_admin": false,
  "roles": [ { "id": 2, "name": "Developer" } ],
  "project_count": 3,                  // ⭐ nice for the table
  "last_login_at": "2026-10-14T08:00:00Z",
  "created_at": "2026-01-02T10:00:00Z",
  "updated_at": "2026-10-01T10:00:00Z"
}
```

### 3.1 `GET /api/users` 🆕 — list users

Perm: `users.view`

| Query | Example | Notes |
|---|---|---|
| `search` | `ayesha` | name, email, designation, department |
| `status` | `active` | `active` \| `inactive` |
| `role_id` | `2` | |
| `sort` | `name` | `name`, `-created_at`, `-last_login_at` |
| `page`, `per_page` | | |

Response: paginated `User[]`. Also add `meta.counts`, which the page header uses:
```json
"meta": { "current_page": 1, "per_page": 20, "total": 48, "last_page": 3, "counts": { "all": 48, "active": 45, "inactive": 3 } }
```

### 3.2 `GET /api/users/{id}` 🆕

Perm: `users.view`. Response: `User`.

### 3.3 `POST /api/users` 🆕 — create user

Perm: `users.create`

```jsonc
{
  "name": "John Smith",              // required, 2–100
  "email": "john@techtrioz.com",     // required, unique
  "password": "Temp1234",            // required on create, same password rules as 1.5
  "designation": "Senior Developer", // nullable
  "department": "Engineering",       // nullable
  "phone": "+8801711000000",         // nullable
  "bio": null,                       // nullable
  "role_ids": [2, 4],                // required, min 1, must exist
  "status": "active",                // active | inactive, default active
  "must_change_password": true       // ⭐ default true, so the user sets their own on first login
}
```

Response `201` → `User`. ⭐ Send a welcome email with login details.

### 3.4 `PATCH /api/users/{id}` 🆕 — edit user

Perm: `users.update`. Same body as create, all fields optional. `password` is optional: if empty or missing, keep the current one.
Rule: a user cannot remove their own Super Admin role, and the last Super Admin cannot be demoted (`400 LAST_SUPER_ADMIN`).

### 3.5 `PATCH /api/users/{id}/status` 🆕 — activate / deactivate

Perm: `users.deactivate`

```json
{ "status": "inactive" }
```

Rules: you cannot deactivate yourself (`400 CANNOT_DEACTIVATE_SELF`) or the last active Super Admin. Deactivating should revoke that user's tokens.
Response → `User`.

### 3.6 `DELETE /api/users/{id}` ⭐

The UI only deactivates; there is no hard delete. Skip unless needed.

### 3.7 `GET /api/users/options` 🆕 — lightweight list for dropdowns

Used by: project owner/member pickers, issue assignee filter, member manager "add member" search.
Perm: any of `projects.create`, `projects.assign_members`, `issues.view`.

Query: `search`, `status=active` (default), `exclude_project_id=3` (users **not** already in that project — used by "Add member").
Response `data`: `UserSummary[]` (no pagination, or cap at 50 with `search`).

---

## 4. Roles & Permissions

Screen: **Roles page** (list + search + delete), **Role editor** (`/roles/new`, `/roles/:id`): name, description, active toggle, permission matrix.

### Role object

```jsonc
// Role
{
  "id": 2,
  "name": "Developer",
  "description": "Works on assigned issues",
  "permissions": ["dashboard.view", "projects.view", "issues.view", "issues.change_status"],
  "is_system": false,      // system roles (e.g. Super Admin) can't be deleted or renamed
  "is_active": true,       // inactive roles grant no permissions
  "user_count": 5,         // shown in the list; also used to block delete
  "created_at": "...",
  "updated_at": "..."
}
```

### 4.1 `GET /api/permissions` 🆕 — permission catalog

Perm: `roles.view`. Lets the role editor be driven by the backend. (The frontend also has this list hardcoded, so this is ⭐ if you keep the names identical.)

```json
{
  "success": true, "message": null,
  "data": [
    {
      "module": "projects",
      "label": "Projects",
      "permissions": [
        { "value": "projects.view", "label": "View", "description": "View project list and details", "is_sensitive": false },
        { "value": "projects.delete", "label": "Delete", "description": "Delete or archive projects", "is_sensitive": true }
      ]
    }
  ]
}
```

### 4.2 `GET /api/roles` 🆕

Perm: `roles.view`. Query: `search` (name, description), `is_active`. Response: `Role[]` (no pagination needed; there are only a few roles).

### 4.3 `GET /api/roles/{id}` 🆕

Perm: `roles.view`. Response: `Role`.

### 4.4 `POST /api/roles` 🆕

Perm: `roles.create` + `roles.assign_permissions`

```jsonc
{
  "name": "QA Engineer",                       // required, 2–50, unique (case-insensitive)
  "description": "Tests and approves issues",  // required, max 255
  "is_active": true,
  "permissions": ["issues.view", "issues.approve"] // required, min 1, each must be a valid permission
}
```

Response `201` → `Role`.

### 4.5 `PATCH /api/roles/{id}` 🆕

Perm: `roles.update` (changing `permissions` also needs `roles.assign_permissions`). Same body, all optional.
Rules: the Super Admin system role must keep **all** permissions and can't be renamed or deactivated (`400 SYSTEM_ROLE_LOCKED`).

### 4.6 `DELETE /api/roles/{id}` 🆕

Perm: `roles.delete`.
Rules:
- `409 ROLE_IN_USE` if `user_count > 0` → message: `"5 user(s) are assigned to this role. Reassign them first."`
- `400 SYSTEM_ROLE_LOCKED` for `is_system` roles (Super Admin).

Response `data: null`.

---

## 5. Projects

Screens: **Projects page** (list, search, status filter, "show archived" toggle, archive/restore), **Project form dialog** (create/edit), **Project detail page** (overview, issue stats, members, groups, activity).

### Project object

```jsonc
// Project
{
  "id": 3,
  "name": "Atlas Platform",
  "key": "ATL",                          // 2–6 uppercase letters/digits, unique, used as the issue key prefix (ATL-125)
  "description": "Customer-facing platform",
  "objectives": "Ship v2 by Q4",
  "status": "active",                    // planning | active | on_hold | completed | archived
  "priority": "high",                    // low | medium | high | critical
  "color": "#2563eb",
  "tags": ["platform", "data"],
  "start_date": "2026-01-10",
  "due_date": "2026-12-31",              // nullable
  "owner": { /* UserSummary */ },
  "member_count": 8,
  "issue_stats": {                       // shown on cards and the detail page
    "total": 42, "todo": 10, "in_progress": 12, "completed": 8, "approved": 10, "on_hold": 2,
    "overdue": 3,
    "progress": 43                       // % = (completed + approved) / total
  },
  "my_project_role": "Backend Developer",// role of the current user in this project, null if not a member
  "created_at": "...",
  "updated_at": "...",
  "archived_at": null
}
```

### 5.1 `GET /api/projects` 🆕

Perm: `projects.view`. **Visibility:** Super Admin sees all; everyone else sees only projects they are a member of.

| Query | Example | Notes |
|---|---|---|
| `search` | `atlas` | name, key, description |
| `status` | `active,on_hold` | |
| `include_archived` | `true` | default `false` (the "Show archived" toggle) |
| `priority` | `high` | |
| `member_id` | `7` | ⭐ |
| `sort` | `-updated_at` | `name`, `-created_at`, `due_date` |

Response: paginated `Project[]`.

### 5.2 `GET /api/projects/options` 🆕 — dropdown list

Used by: the issue form project select, the groups/issues/reports/activity project filters.
Response `data`: `ProjectSummary[]` of visible, non-archived projects (`include_archived=true` optional).

### 5.3 `GET /api/projects/{id}` 🆕 — project detail

Perm: `projects.view` + member (or Super Admin). Returns `Project` plus:

```jsonc
{
  /* ...Project fields... */
  "members": [ /* ProjectMember, see section 6 */ ],
  "groups": [ /* GroupSummary, see section 11 */ ],
  "permissions": ["projects.update", "projects.assign_members", "issues.create"] // current user's permissions in THIS project → drives which buttons show
}
```

Recent activity for the detail page comes from `GET /api/activity?project_id=3&per_page=10` (section 14).

### 5.4 `POST /api/projects` 🆕 — create project

Perm: `projects.create`

```jsonc
{
  "name": "Atlas Platform",        // required, max 100
  "key": "ATL",                    // required, 2–6, A–Z/0–9, unique (server uppercases it)
  "description": "…",              // required
  "objectives": "…",               // nullable
  "status": "planning",            // default planning
  "priority": "medium",            // default medium
  "color": "#2563eb",              // one of the palette colors or any hex
  "tags": ["platform", "data"],    // array of strings (UI sends comma separated → split it)
  "start_date": "2026-01-10",      // required
  "due_date": "2026-12-31",        // nullable, must be >= start_date
  "owner_id": 7,                   // required, active user
  "members": [                     // required, min 1. Owner is added automatically if missing
    { "user_id": 7,  "project_role": "Project Manager" },
    { "user_id": 12, "project_role": "Backend Developer" },
    { "user_id": 15 }              // project_role optional → default "Project Contributor / Other"
  ]
}
```

> The current form also has "developer" and "assigner" checkboxes per member (`developerIds`, `assignerIds`). On the API, express these through `project_role` (e.g. `"Backend Developer"`, `"Issue Assigner"`) instead of separate arrays. See section 6.

**Side effects (must happen in one transaction):**
1. Create the project.
2. Create one membership row per member.
3. **Auto-create exactly one `default` group** named after the project, containing all members (section 11).
4. Activity log entries `project_created` and `group_created`.
5. Notify each member (`project_membership`).

Response `201` → `Project` (detail shape).
Errors: `422` `errors.key = ["A project with this key already exists."]`.

### 5.5 `PATCH /api/projects/{id}` 🆕 — edit project

Perm: `projects.update`. Same fields as create, all optional. Members are **not** edited here; use section 6. (If you prefer to allow `members` here too, treat it as a full replace and run the same sync as section 6.)
If `name` changes, rename the default group too ⭐.
Rule: `key` should be **locked once issues exist** (`400 PROJECT_KEY_LOCKED`), because issue keys depend on it.

### 5.6 `POST /api/projects/{id}/archive` 🆕

Perm: `projects.delete`. Sets `status = archived` and `archived_at = now`. Archived projects are read-only: no new issues or messages. Response → `Project`.

### 5.7 `POST /api/projects/{id}/restore` 🆕

Perm: `projects.delete`. Sets `status = active` and `archived_at = null`. Response → `Project`.

### 5.8 `DELETE /api/projects/{id}` ⭐

The UI only archives. If you build hard delete: Super Admin only, cascade to issues, comments, attachments, groups and messages.

---

## 6. Project Members

Screen: **Project detail → Member manager**: list members (filter by project role), add member (search non-members + pick role), remove, change project role, toggle developer/assigner.

### ProjectMember object

```jsonc
// ProjectMember
{
  "id": 55,                       // membership id
  "user": { /* UserSummary */ },
  "project_role": "Backend Developer",
  "is_owner": false,
  "global_roles": ["Developer"],  // user's system roles, shown as a subtitle
  "open_issue_count": 4,          // ⭐
  "joined_at": "2026-02-01T10:00:00Z",
  "updated_at": "..."
}
```

**Project roles** are free text with suggested defaults (section 19). The backend should normalise them: trim, collapse spaces, and match defaults case-insensitively (`"backend developer"` → `"Backend Developer"`). Empty → `"Project Contributor / Other"`.

> **Recommended:** map each project role to a permission set (or link it to a `Role`), so `access.projects[].permissions` is computed from it. Example: "Issue Assigner" → can create issues but **cannot** assign.

### 6.1 `GET /api/projects/{id}/members` 🆕

Perm: `projects.view` + member. Query: `project_role`, `search`. Response: `ProjectMember[]`.
Also used for the **eligible assignees** dropdown in the issue form and issue detail (`?status=active`).

### 6.2 `GET /api/projects/{id}/member-roles` ⭐

Distinct project roles in use + defaults, for the role filter and combobox. Response `data: string[]`.

### 6.3 `POST /api/projects/{id}/members` 🆕 — add member

Perm: `projects.assign_members`

```json
{ "user_id": 15, "project_role": "QA Engineer / Tester" }
```

Side effects: add the user to the project's **default group**, write `member_added` to the activity log, and send a `project_membership` notification to the user.
Errors: `409 ALREADY_MEMBER`, `422` if the user is inactive.
Response `201` → `ProjectMember`.

⭐ Bulk version: `{ "members": [ { "user_id": 15, "project_role": "..." }, ... ] }`.

### 6.4 `PATCH /api/projects/{id}/members/{userId}` 🆕 — change project role

Perm: `projects.assign_members`

```json
{ "project_role": "Frontend Developer" }
```

Side effects: activity log `member_role_changed` (old → new) and a `role_changed` notification to that user.
Response → `ProjectMember`.

### 6.5 `DELETE /api/projects/{id}/members/{userId}` 🆕 — remove member

Perm: `projects.assign_members`.
Rules:
- Cannot remove the project owner → `400 CANNOT_REMOVE_OWNER`.
- Remove the user from the default group **and** from every private/secret group of this project.
- ⭐ Their open assigned issues: either keep them or unassign. Decide and document. Recommendation: unassign and write history.

Activity log: `member_removed`. Response `data: null`.

---

## 7. Issues

Screens: **Issues page** (list view + Kanban board, search, 5 filters, sort), **Issue form dialog** (create/edit), **Issue detail** (status buttons, approve, assign/unassign, comments, history, attachments, delete), **Kanban drag & drop** (status change), **Developer dashboard** (my issues grouped by project).

### Issue object

```jsonc
// Issue
{
  "id": 501,
  "key": "ATL-125",                      // <project.key>-<sequence>, generated by the server
  "title": "Login button unresponsive on Safari",
  "description": "Steps to reproduce…",
  "project": { /* ProjectSummary */ },
  "type": "bug",                         // bug | incident | task | improvement | security
  "priority": "high",                    // critical | high | medium | low
  "severity": "sev2",                    // sev1 | sev2 | sev3 | sev4 | null
  "status": "in_progress",               // todo | in_progress | completed | approved | on_hold
  "reproducibility": "Always",           // free text | null
  "labels": ["frontend", "safari"],
  "reporter": { /* UserSummary */ },
  "assignee": { /* UserSummary */ },     // null when unassigned
  "start_date": "2026-10-01T09:00:00Z",
  "due_date": "2026-10-20",              // nullable
  "is_overdue": false,                   // server computed: due_date < today AND status not in (completed, approved)
  "resolved_at": null,                   // set when status → completed
  "approved_at": null,                   // set when status → approved
  "approved_by": null,                   // UserSummary | null
  "comment_count": 3,
  "attachment_count": 1,
  "created_at": "...",
  "updated_at": "..."
}
```

### 7.1 `GET /api/issues` 🆕 — list (list view + Kanban)

Perm: `issues.view`. **Visibility:** only issues in projects the user is a member of (Super Admin: all).

| Query | Example | Notes |
|---|---|---|
| `search` | `safari` | title, key, description |
| `status` | `todo,in_progress` | |
| `priority` | `critical,high` | |
| `type` | `bug` | |
| `severity` | `sev1` | ⭐ |
| `project_id` | `3` | |
| `assignee_id` | `7` \| `me` \| `unassigned` | the UI has all three options |
| `reporter_id` | `me` | used on the dashboard ("reported by me") |
| `overdue` | `true` | dashboard |
| `due_before` | `2026-10-31` | ⭐ upcoming deadlines |
| `label` | `frontend` | ⭐ |
| `sort` | `-updated_at` | UI options: `-updated_at` (default), `-created_at`, `due_date` (nulls last), `priority` (critical → low), `key` |
| `page`, `per_page` | | Kanban uses `per_page=all` or a high number |

Response: paginated `Issue[]`. Add `meta.status_counts` for the Kanban column headers:
```json
"meta": { "...": "...", "status_counts": { "todo": 10, "in_progress": 12, "completed": 8, "approved": 10, "on_hold": 2 } }
```

### 7.2 `GET /api/issues/{id}` 🆕 — issue detail

Perm: `issues.view` + project member. Accepts the numeric `id` and ⭐ also the `key` (`/api/issues/ATL-125`).

Returns `Issue` plus what the detail page needs to decide which buttons to show:

```jsonc
{
  /* ...Issue fields... */
  "allowed_transitions": ["todo", "completed", "on_hold"],   // from the state machine (section 20.1), already filtered by the user's permission
  "can": {
    "update": true,
    "delete": false,
    "assign": true,
    "change_status": true,
    "approve": false,
    "comment": true,
    "upload_attachment": true
  }
}
```

Comments, history and attachments come from their own endpoints (sections 8–10), or ⭐ embed them with `?include=comments,history,attachments`.

### 7.3 `POST /api/issues` 🆕 — create issue

Perm: `issues.create` + member of `project_id`.

```jsonc
{
  "project_id": 3,                   // required, user must be a member, project must not be archived
  "title": "Login button unresponsive",// required, max 200
  "description": "Steps…",           // required (UI marks it required), max 10000
  "type": "bug",                     // required
  "priority": "high",                // required
  "severity": "sev2",                // nullable
  "reproducibility": "Always",       // nullable, max 100
  "assignee_id": 12,                 // nullable — see rules
  "labels": ["frontend", "safari"],  // array, each max 30 chars, max 10 labels
  "due_date": "2026-10-20"           // nullable, >= today
}
```

Rules:
- `status` is always set to `todo` (or `settings.default_issue_status`, see section 18). The client does not send it.
- `key` = `<project.key>-<next sequence>`. Use a DB-safe counter: per project or global (the frontend currently uses one global counter; either is fine).
- `assignee_id` is only applied if the creator has `issues.assign` **and** is not an "Issue Assigner"-only user (see 20.3). Otherwise **ignore it silently** and leave the issue unassigned (the UI shows "You can create issues but cannot assign them").
- The assignee must be an **active member of the project** → `422 errors.assignee_id`.

Side effects: history `created` (+ `assignee` if assigned), activity `issue_created` (+ `issue_assigned`), notification `issue_assigned` to the assignee.
Response `201` → `Issue`.

### 7.4 `PATCH /api/issues/{id}` 🆕 — edit issue

Perm: `issues.update`. Editable fields (all optional):
`title, description, type, priority, severity, reproducibility, labels, due_date`.

**Not** editable here: `project_id`, `status`, `assignee_id` (they have their own endpoints).
Side effects: one history row **per changed field** (`field`, `old_value`, `new_value`; for description use `"(previous)" → "(updated)"`), and an `issue_updated` activity entry.
Response → `Issue`.

### 7.5 `PATCH /api/issues/{id}/status` 🆕 — change status (detail buttons + Kanban drag)

Perm: `issues.change_status`.

```json
{ "status": "completed" }
```

Rules:
- Must follow the state machine in 20.1, otherwise `400 INVALID_STATUS_TRANSITION` with message `"Cannot transition from To Do to Approved"`.
- `→ completed`: set `resolved_at = now`.
- `→ approved`: requires `issues.approve` (prefer the dedicated 7.6 endpoint).
- `completed → in_progress` (reopen): clear `resolved_at`.

Side effects: history `status` (old label → new label), activity `status_changed`, notification `issue_status_changed` to the assignee and the reporter (excluding the actor).
Response → `Issue`.

### 7.6 `POST /api/issues/{id}/approve` 🆕

Perm: `issues.approve`. Only when `status = completed`, otherwise `400 ISSUE_NOT_COMPLETED` ("Only completed issues can be approved").
Sets `status = approved`, `approved_at = now`, `approved_by = me`. Same side effects as 7.5, with activity action `issue_approved`.
Response → `Issue`.

⭐ `POST /api/issues/{id}/reject` with `{ "reason": "..." }` → `completed → in_progress` and the reason is added as a comment.

### 7.7 `PATCH /api/issues/{id}/assignee` 🆕 — assign / reassign / unassign

Perm: `issues.assign` (see 20.3 for the Issue Assigner exception).

```json
{ "assignee_id": 12 }    // or null to unassign
```

Rules:
- The assignee must be an active project member → `422 errors.assignee_id = ["Assignee must be a project member."]`.
- Unassigning an already unassigned issue → `400 ALREADY_UNASSIGNED`.
- If `settings.allow_self_assignment = false`, a user can't assign to themselves unless they're an admin.

Side effects: history `assignee` (old name → new name or "Unassigned"), activity `issue_assigned` / `issue_unassigned`, notification `issue_assigned` to the new assignee.
Response → `Issue`.

> If you prefer two endpoints: `POST /api/issues/{id}/assign { assignee_id }` and `POST /api/issues/{id}/unassign`. Both are fine; just pick one.

### 7.8 `DELETE /api/issues/{id}` 🆕

Perm: `issues.delete`. Cascades to comments, history and attachments (files too). ⭐ Soft delete is recommended.
Activity: `issue_deleted`. Response `data: null`.

---

## 8. Issue Comments

Screen: **Issue detail → Comments tab**.

```jsonc
// Comment
{
  "id": 900,
  "issue_id": 501,
  "author": { /* UserSummary */ },
  "body": "Reproduced on Safari 17.",
  "is_edited": false,
  "created_at": "...",
  "updated_at": null
}
```

### 8.1 `GET /api/issues/{id}/comments` 🆕

Perm: `issues.view`. Sorted oldest → newest. Paginated (or `per_page=all`).

### 8.2 `POST /api/issues/{id}/comments` 🆕

Perm: `issues.comment`.

```json
{ "body": "Reproduced on Safari 17." }
```

Rules: `body` required after trimming, max 5000.
Side effects: activity `issue_commented`, notification `issue_commented` to the reporter and assignee (not the author). ⭐ Parse `@mentions` and notify the mentioned users if their `mention_alerts` preference is on.
Response `201` → `Comment`.

### 8.3 `PATCH /api/issues/{id}/comments/{commentId}` ⭐

Author only. `{ "body": "..." }`. Sets `is_edited = true`. (The data model has `updated_at` but the UI has no edit button yet.)

### 8.4 `DELETE /api/issues/{id}/comments/{commentId}` ⭐

Author or `issues.delete`.

---

## 9. Issue Attachments

Screen: **Issue detail → Attachments tab**. The current UI is a mock (it types a file name and size). With the real API it will be an actual file upload.

```jsonc
// Attachment
{
  "id": 77,
  "issue_id": 501,
  "file_name": "screenshot.png",
  "file_size": 248123,               // bytes
  "mime_type": "image/png",
  "url": "https://cdn.../att/77",    // signed or authenticated download URL
  "uploaded_by": { /* UserSummary */ },
  "uploaded_at": "..."
}
```

### 9.1 `GET /api/issues/{id}/attachments` 🆕

Perm: `issues.view`. Response: `Attachment[]`.

### 9.2 `POST /api/issues/{id}/attachments` 🆕

Perm: `issues.update` (or reporter/assignee). `multipart/form-data`, field `files[]` (multiple allowed).
Suggested limits: max **10 MB** per file, max 10 files per request. Allowed: images, pdf, txt, log, zip, docx, xlsx, csv. Block executables.
Side effects: activity `attachment_added`, history `attachment` (`"" → "screenshot.png"`).
Response `201` → `Attachment[]`.

### 9.3 `GET /api/attachments/{id}/download` 🆕

Streams the file (`Content-Disposition: attachment`). Check that the user can view the issue. Skip this endpoint if `url` is already a signed URL.

### 9.4 `DELETE /api/attachments/{id}` 🆕

Perm: the uploader, or `issues.delete`. Deletes the stored file. Activity `attachment_removed`, history row. Response `data: null`.

---

## 10. Issue History

Screen: **Issue detail → History tab** (audit trail of field changes). Read-only; the server writes rows automatically on every change.

```jsonc
// HistoryEntry
{
  "id": 3001,
  "issue_id": 501,
  "actor": { /* UserSummary */ },
  "field": "status",        // created | title | description | type | priority | severity | reproducibility | labels | due_date | status | assignee | attachment
  "old_value": "To Do",     // human-readable labels, not enum values
  "new_value": "In Progress",
  "created_at": "..."
}
```

### 10.1 `GET /api/issues/{id}/history` 🆕

Perm: `issues.view`. Sorted newest → oldest.

---

## 11. Groups (chat)

Screens: **Groups page** (list with last message + unread badge, search, type and project filters, delete), **Group form dialog** (create), **Group detail** (chat, member list, add/remove member).

### Group types & visibility (important)

| Type | Created by | Who can see it in the list | Who can read/send messages | Membership |
|---|---|---|---|---|
| `default` | **Auto** (one per project, on project create) | all project members | all project members | Synced automatically with project members. **Cannot** add/remove manually, **cannot** delete |
| `private` | user (`groups.create`) | group members only (must also be project members) | group members | Manual; members must be project members |
| `secret` | user (`groups.create`) | **only** group members. Non-members get `404`, not `403` | group members | Manual; members must be project members |

### Group object

```jsonc
// Group
{
  "id": 20,
  "name": "Security Review Team",
  "type": "private",                    // default | private | secret
  "project": { /* ProjectSummary */ },
  "member_count": 5,
  "members": [ /* UserSummary */ ],     // only in the detail response
  "created_by": { /* UserSummary */ },
  "last_message": {                     // null if no messages
    "id": 4400,
    "body": "Deploying now",
    "sender": { "id": 7, "name": "Ayesha Rahman" },
    "created_at": "..."
  },
  "unread_count": 2,                    // for the current user
  "can": { "update": true, "delete": true, "manage_members": true, "send_message": true },
  "created_at": "...",
  "updated_at": "..."
}
```

### 11.1 `GET /api/groups` 🆕

Perm: `groups.view`. Applies the visibility rules above.

| Query | Notes |
|---|---|
| `search` | group name, project name |
| `type` | `default,private,secret` |
| `project_id` | |
| `sort` | default `-last_message_at` |

Response: `Group[]` (paginated or all).

### 11.2 `GET /api/groups/{id}` 🆕

Response: `Group` with `members`. `404` if the user is not allowed to see it.

### 11.3 `POST /api/groups` 🆕

Perm: `groups.create` + member of the project.

```jsonc
{
  "name": "Security Review Team",  // required, max 100
  "project_id": 3,                 // required
  "type": "private",               // required: private | secret (default can't be created manually)
  "member_ids": [7, 12, 15]        // required, min 1. Ids that are not project members are rejected with 422 (or dropped silently — pick one)
}
```

The creator is always added as a member. Activity: `group_created`. Notify the added members (`group_message` or a new `group_membership` type ⭐).
Response `201` → `Group`.

### 11.4 `PATCH /api/groups/{id}` 🆕

Perm: `groups.update`. `{ "name": "New name" }`. Default groups: rename not allowed (the name follows the project) → `400`.
Activity: `group_updated`.

### 11.5 `DELETE /api/groups/{id}` 🆕

Perm: `groups.delete`. `type = default` → `400 CANNOT_DELETE_DEFAULT_GROUP` ("Default groups are managed by project membership."). Cascades to messages.
Activity: `group_deleted`.

### 11.6 `POST /api/groups/{id}/members` 🆕

Perm: `groups.manage_members`.

```json
{ "user_ids": [18, 19] }
```

Rules: default group → `400`; each user must be a project member → `422`. Already-members are ignored.
Response → `Group` (with members).

⭐ `GET /api/groups/{id}/eligible-members` → project members who aren't in the group yet (for the "Add member" picker). Alternatively the frontend can compute this from `/projects/{id}/members`.

### 11.7 `DELETE /api/groups/{id}/members/{userId}` 🆕

Perm: `groups.manage_members`, or the user leaving on their own. Default group → `400`.

---

## 12. Group Messages

Screen: **Group detail** chat window.

```jsonc
// Message
{
  "id": 4400,
  "group_id": 20,
  "sender": { /* UserSummary */ },
  "body": "Deploying now",
  "is_read": true,           // for the current user
  "read_count": 4,           // ⭐ "seen by 4"
  "created_at": "..."
}
```

### 12.1 `GET /api/groups/{id}/messages` 🆕

Perm: group member. **Cursor pagination** (chat scrolls up to load older messages):

| Query | Notes |
|---|---|
| `before_id` | load messages older than this id |
| `after_id` | load messages newer than this id (for polling) |
| `limit` | default 50, max 100 |

Response `data`: `Message[]` sorted oldest → newest, plus `meta: { "has_more": true }`.

### 12.2 `POST /api/groups/{id}/messages` 🆕

Perm: `groups.send_message` + group member. Project must not be archived.

```json
{ "body": "Deploying now" }
```

Rules: required after trimming, max 5000. The sender is automatically marked as having read it.
Side effects: notification `group_message` to the other members (⭐ throttle it, for example one notification per group per 5 min per user).
Response `201` → `Message`.

### 12.3 `POST /api/groups/{id}/read` 🆕 — mark all as read

Called when the user opens the group. No body. Response `data: { "unread_count": 0 }`.

### 12.4 Real-time ⭐ (recommended)

Polling `after_id` every 5–10 seconds works for v1. Better: WebSocket or Pusher/Laravel Echo channel `private-group.{id}` with events `message.created` and `member.added` / `member.removed`, plus a user channel `private-user.{id}` for `notification.created`.

---

## 13. Notifications

Screens: **Topbar bell** (dropdown of the latest 10 + unread badge + "mark all read"), **Notifications page** (All / Unread tabs).

```jsonc
// Notification
{
  "id": 1200,
  "type": "issue_assigned",   // see section 19
  "title": "Issue assigned to you",
  "body": "ATL-125: Login button unresponsive",
  "link": "/issues/501",      // frontend route to open on click
  "is_read": false,
  "actor": { /* UserSummary */ },   // ⭐ who triggered it
  "created_at": "..."
}
```

### 13.1 `GET /api/notifications` 🆕

Perm: `notifications.view` (own notifications only).
Query: `filter=all|unread`, `page`, `per_page` (the topbar uses `per_page=10`). Sorted newest first.
Response: paginated, plus `meta.unread_count`.

### 13.2 `GET /api/notifications/unread-count` 🆕

For the bell badge (polled). Response `data: { "unread_count": 4 }`.

### 13.3 `PATCH /api/notifications/{id}/read` 🆕

Marks one as read. Response → `Notification`.

### 13.4 `POST /api/notifications/read-all` 🆕

Response `data: { "unread_count": 0 }`.

### 13.5 `DELETE /api/notifications/{id}` ⭐

---

## 14. Activity Log

Screens: **Activity page** (search, entity type filter, project filter, CSV export), **Project detail → Activity**, **Dashboard → Recent activity**.

```jsonc
// Activity
{
  "id": 8800,
  "actor": { /* UserSummary */ },
  "action": "status_changed",            // see section 19
  "entity_type": "Issue",                // Project | Issue | Group | User | Role
  "entity_id": 501,
  "entity_name": "ATL-125",
  "summary": "Changed ATL-125 status from To Do to In Progress",
  "project": { /* ProjectSummary */ },   // null for global actions (users, roles)
  "created_at": "..."
}
```

> Activity rows are **written by the backend only**, as a side effect of other endpoints (section 21). There is no POST endpoint.

### 14.1 `GET /api/activity` 🆕

Perm: `activity.view`. **Visibility:** Super Admin sees everything; others see entries from their projects plus global entries about themselves.

| Query | Notes |
|---|---|
| `search` | summary, entity_name, actor name |
| `entity_type` | `Project,Issue,Group,User,Role` |
| `project_id` | |
| `actor_id` | ⭐ |
| `action` | ⭐ |
| `from`, `to` | ⭐ date range |
| `page`, `per_page` | default sort newest first |

### 14.2 `GET /api/activity/export` 🆕

Perm: `activity.export`. Same filters as 14.1, no pagination.
Response: `text/csv` file, `Content-Disposition: attachment; filename="techtrioz-activity-2026-10-14.csv"`.
Columns (same as the current frontend export): `Timestamp, Actor, Action, Entity Type, Entity Name, Summary, Project`.

---

## 15. Dashboard

Screen: **Dashboard**. There are role-based variants: Admin/Manager, Issue Assigner, QA, and Developer (a separate developer dashboard). Today the frontend computes everything from all data. With the API, **one aggregated endpoint** avoids 6–8 separate calls.

### 15.1 `GET /api/dashboard` 🆕

Perm: `dashboard.view`. All numbers are scoped to the projects the user can see.

```jsonc
{
  "success": true,
  "message": null,
  "data": {
    "counts": {
      "projects": 6, "active_projects": 4, "completed_projects": 1, "on_hold_projects": 1,
      "issues": 120, "unresolved_issues": 64, "overdue_issues": 7,
      "critical_issues": 3,          // priority critical and not approved
      "unassigned_issues": 9,        // no assignee and not approved
      "awaiting_approval": 8,        // status = completed (QA / approver widget)
      "users": 48,                   // only for users.view
      "unread_notifications": 4
    },
    "status_counts":   { "todo": 20, "in_progress": 30, "completed": 8, "approved": 56, "on_hold": 6 },
    "priority_counts": { "critical": 3, "high": 20, "medium": 60, "low": 37 },
    "my_issues": {
      "assigned_total": 12,
      "assigned_unresolved": 5,
      "reported_total": 9,
      "assigned": [ /* Issue[] — top 5 unresolved, by priority then due_date */ ],
      "reported": [ /* Issue[] — top 5 latest */ ]
    },
    "awaiting_approval": [ /* Issue[] top 5, status = completed */ ],
    "critical_issues":   [ /* Issue[] top 5 */ ],
    "unassigned_issues": [ /* Issue[] top 5 */ ],
    "upcoming_deadlines":[ /* Issue[] top 5 by due_date, not completed/approved */ ],
    "project_progress": [
      { "project": { /* ProjectSummary */ }, "status": "active", "issue_count": 42, "done": 18, "progress": 43 }
    ],
    "developer_workload": [
      { "user": { /* UserSummary */ }, "total": 10, "unresolved": 4 }
    ],
    "recent_activity": [ /* Activity[] latest 8 */ ]
  }
}
```

### 15.2 `GET /api/dashboard/developer` 🆕 — developer variant

Used when the user's role contains "developer" (and they aren't Super Admin). Supports a sort option in the UI (`priority | updated | open | name`).

```jsonc
{
  "data": {
    "summary": { "total": 14, "todo": 3, "in_progress": 5, "completed": 2, "approved": 3, "on_hold": 1, "overdue": 2, "due_this_week": 3 },
    "projects": [
      {
        "project": { /* ProjectSummary + status */ },
        "my_project_role": "Backend Developer",
        "issues": [ /* Issue[] assigned to me in this project */ ],
        "open_issues": 6,
        "status_counts": { "todo": 2, "in_progress": 3, "completed": 1, "approved": 0, "on_hold": 0 },
        "last_updated": "2026-10-13T16:00:00Z"
      }
    ]
  }
}
```

> Alternative: the frontend can build this from `GET /api/issues?assignee_id=me&per_page=all` plus `/api/projects/options`. A dedicated endpoint is faster, though.

---

## 16. Reports

Screen: **Reports page**: filters (project, status, priority), KPI cards, status/priority/type charts, project progress table, assignee workload table, CSV export.

### 16.1 `GET /api/reports/summary` 🆕

Perm: `reports.view`. Query: `project_id`, `status`, `priority`, ⭐ `from`, `to` (created_at range).

```jsonc
{
  "data": {
    "total": 120,
    "resolved": 64,          // completed + approved
    "overdue": 7,
    "unassigned": 9,
    "resolution_rate": 53,   // %
    "status_counts":   { "todo": 20, "in_progress": 30, "completed": 8, "approved": 56, "on_hold": 6 },
    "priority_counts": { "critical": 3, "high": 20, "medium": 60, "low": 37 },
    "type_counts":     { "bug": 50, "incident": 10, "task": 40, "improvement": 15, "security": 5 },
    "projects": [
      { "project": { /* ProjectSummary */ }, "total": 42, "done": 18, "progress": 43, "overdue": 2 }
    ],
    "workload": [
      { "user": { /* UserSummary */ }, "total": 10, "resolved": 6, "open": 4 }
    ],
    "avg_resolution_hours": 30.5     // ⭐ created_at → resolved_at
  }
}
```

### 16.2 `GET /api/reports/issues/export` 🆕

Perm: `reports.export`. Same filters. Response: `text/csv`, `filename="techtrioz-report-2026-10-14.csv"`.
Columns (same as the current frontend export): `Key, Title, Project, Type, Priority, Status, Reporter, Assignee, Severity, Reproducibility, Created, Due Date, Resolved, Labels` (labels joined with `; `).
⭐ `?format=xlsx`.

---

## 17. Global Search

Screen: **Topbar search box**. Triggers at 2+ characters and shows Projects and Issues groups.

### 17.1 `GET /api/search?q=atl&limit=5` 🆕

Only searches what the user can see.

```jsonc
{
  "data": {
    "projects": [ { "id": 3, "name": "Atlas Platform", "key": "ATL", "color": "#2563eb" } ],
    "issues":   [ { "id": 501, "key": "ATL-125", "title": "Login button…", "status": "in_progress", "priority": "high" } ]
  }
}
```

Projects match on name or key; issues match on title or key. ⭐ Also return `users` and `groups`.

---

## 18. System Settings

Screen: **Settings → System** (admin only).

### 18.1 `GET /api/settings` 🆕

Perm: `settings.view`.

```json
{
  "data": {
    "default_issue_status": "todo",
    "require_approval_for_completion": true,
    "allow_self_assignment": true,
    "notify_on_assignment": true,
    "notify_on_status_change": true
  }
}
```

### 18.2 `PATCH /api/settings` 🆕

Perm: `settings.update`. Any subset of the fields above. `default_issue_status` ∈ issue statuses (normally `todo` or `on_hold`).

How each setting affects the backend:
| Setting | Effect |
|---|---|
| `default_issue_status` | status of newly created issues |
| `require_approval_for_completion` | if `false`, `completed` is treated as final (approve step optional) |
| `allow_self_assignment` | blocks assigning issues to yourself when `false` |
| `notify_on_assignment` | send `issue_assigned` notifications |
| `notify_on_status_change` | send `issue_status_changed` notifications |

---

## 19. Lookups / Enums

⭐ `GET /api/meta/enums` returns all of these in one call. Otherwise the frontend keeps them hardcoded, so **the values must match exactly**.

| Enum | Values |
|---|---|
| `user.status` | `active`, `inactive` |
| `project.status` | `planning`, `active`, `on_hold`, `completed`, `archived` |
| `project.priority` | `low`, `medium`, `high`, `critical` |
| `issue.status` | `todo` (To Do), `in_progress` (In Progress), `completed` (Completed), `approved` (Approved), `on_hold` (On Hold) |
| `issue.priority` | `critical`, `high`, `medium`, `low` |
| `issue.type` | `bug`, `incident`, `task`, `improvement`, `security` |
| `issue.severity` | `sev1` (Critical — system down or data loss), `sev2` (High — major functionality broken), `sev3` (Medium — workaround available), `sev4` (Low — minor or cosmetic) |
| `group.type` | `default`, `private`, `secret` |
| `preferences.theme` | `light`, `dark` |
| Default project roles | `Project Manager`, `Frontend Developer`, `Backend Developer`, `Full-Stack Developer`, `UI/UX Designer`, `QA Engineer / Tester`, `DevOps Engineer`, `Business Analyst`, `Issue Assigner`, `Project Contributor / Other` (default) |
| Project colors | `#2563eb #dc2626 #059669 #7c3aed #d97706 #0891b2 #db2777 #64748b` |
| Avatar colors | `#2563eb #0891b2 #059669 #d97706 #dc2626 #7c3aed #db2777 #ea580c` |
| `notification.type` | `issue_assigned`, `issue_status_changed`, `issue_commented`, `project_membership`, `group_message`, `issue_deadline`, `role_changed` |
| `activity.action` | `project_created`, `project_updated`, `project_archived`, `project_restored`, `member_added`, `member_removed`, `member_role_changed`, `issue_created`, `issue_updated`, `issue_assigned`, `issue_unassigned`, `status_changed`, `issue_approved`, `issue_commented`, `issue_deleted`, `attachment_added`, `attachment_removed`, `group_created`, `group_updated`, `group_deleted`, `user_created`, `user_updated`, `user_activated`, `user_deactivated`, `role_created`, `role_updated`, `role_deleted` |
| `activity.entity_type` | `Project`, `Issue`, `Group`, `User`, `Role` |

---

## 20. Business rules the backend must enforce

The frontend checks these too, but **the backend is the source of truth**. Never trust the client.

### 20.1 Issue status state machine

| From ↓ / To → | todo | in_progress | completed | approved | on_hold |
|---|---|---|---|---|---|
| **todo** | — | ✅ | ✅ | ❌ | ✅ |
| **in_progress** | ✅ | — | ✅ | ❌ | ✅ |
| **completed** | ❌ | ✅ (reopen) | — | ✅ (needs `issues.approve`) | ❌ |
| **approved** | ❌ | ❌ | ❌ | — | ❌ (final) |
| **on_hold** | ✅ | ✅ | ❌ | ❌ | — |

Invalid → `400 INVALID_STATUS_TRANSITION`.

### 20.2 Visibility

- **Projects / issues / activity:** Super Admin sees all. Everyone else sees only projects where they are a member, and the issues in them.
- **Groups:** see the table in section 11. Secret groups return `404` to non-members.
- Anything not visible → `404` (not `403`).

### 20.3 Assignment rules

- Assignee must be an **active member of the issue's project**.
- A user whose only role is **"Issue Assigner"** (not also Developer or Super Admin) **can create issues but cannot assign, reassign or unassign** them. If they send `assignee_id` on create, ignore it.
- Respect `settings.allow_self_assignment`.

### 20.4 Projects & membership

- Project `key` is unique, 2–6 chars, uppercase. Lock it after the first issue exists.
- The owner is always a member and can't be removed.
- Every project has **exactly one** default group. Its membership always equals the project membership (add/remove member → sync).
- Removing a member also removes them from that project's private/secret groups.
- Archived projects are read-only (no new issues, comments or messages).

### 20.5 Roles & users

- Can't delete a role that has users assigned (`409 ROLE_IN_USE`).
- Super Admin system role: can't be deleted or renamed, and must keep all permissions.
- Can't deactivate yourself or the last active Super Admin.
- Inactive users: login blocked, tokens revoked, excluded from assignee and member pickers.
- Inactive roles grant no permissions.

### 20.6 Groups

- Default groups: no manual create, delete, rename or member changes.
- Private/secret group members must be members of the group's project.
- Only group members can read or send messages.

---

## 21. Side effects (activity log + notifications)

What each write endpoint must also do automatically:

| Endpoint | Activity `action` | History row | Notification (to whom) |
|---|---|---|---|
| POST /projects | `project_created` + `group_created` | — | `project_membership` → each member |
| PATCH /projects/{id} | `project_updated` | — | — |
| POST /projects/{id}/archive | `project_archived` | — | ⭐ members |
| POST /projects/{id}/restore | `project_restored` | — | ⭐ members |
| POST /projects/{id}/members | `member_added` | — | `project_membership` → added user |
| PATCH /projects/{id}/members/{u} | `member_role_changed` | — | `role_changed` → that user |
| DELETE /projects/{id}/members/{u} | `member_removed` | — | ⭐ removed user |
| POST /issues | `issue_created` (+ `issue_assigned`) | `created` (+ `assignee`) | `issue_assigned` → assignee |
| PATCH /issues/{id} | `issue_updated` | one per changed field | — |
| PATCH /issues/{id}/status | `status_changed` | `status` | `issue_status_changed` → assignee + reporter (not actor) |
| POST /issues/{id}/approve | `issue_approved` | `status` | `issue_status_changed` → assignee + reporter |
| PATCH /issues/{id}/assignee | `issue_assigned` / `issue_unassigned` | `assignee` | `issue_assigned` → new assignee |
| DELETE /issues/{id} | `issue_deleted` | — | — |
| POST /issues/{id}/comments | `issue_commented` | — | `issue_commented` → reporter + assignee (not author) |
| POST /issues/{id}/attachments | `attachment_added` | `attachment` | — |
| DELETE /attachments/{id} | `attachment_removed` | `attachment` | — |
| POST /groups | `group_created` | — | ⭐ added members |
| PATCH /groups/{id} | `group_updated` | — | — |
| DELETE /groups/{id} | `group_deleted` | — | — |
| POST /groups/{id}/messages | — | — | `group_message` → other members (throttled) |
| POST /users | `user_created` | — | ⭐ welcome email |
| PATCH /users/{id} | `user_updated` | — | `role_changed` if roles changed |
| PATCH /users/{id}/status | `user_activated` / `user_deactivated` | — | — |
| PATCH /profile | `user_updated` ("Updated own profile") | — | — |
| POST/PATCH/DELETE /roles | `role_created` / `role_updated` / `role_deleted` | — | — |
| ⏰ Scheduled job (daily) | — | — | `issue_deadline` → assignee when `due_date` is tomorrow or today (if `deadline_alerts` is on) |

Notification `link` values: issue → `/issues/{id}`, project → `/projects/{id}`, group → `/groups/{id}`.
Respect user preferences: `email_notifications` (also send email), `push_notifications`, `deadline_alerts`, `mention_alerts`.

---

## 22. Endpoint summary table

| # | Method | Path | Perm | Status |
|---|---|---|---|---|
| **Auth** |||||
| 1 | POST | `/api/auth/login` | public | ✅ |
| 2 | POST | `/api/auth/refresh` | public | ✅ |
| 3 | GET | `/api/auth/me` | auth | ✅ (add fields) |
| 4 | POST | `/api/auth/logout` | auth | ✅ |
| 5 | POST | `/api/auth/change-password` | auth | ✅ |
| 6 | POST | `/api/auth/forgot-password` | public | ✅ |
| 7 | POST | `/api/auth/verify-forgot-otp` | public | ✅ (fix response key) |
| 8 | POST | `/api/auth/reset-password` | public | ✅ |
| **Profile** |||||
| 9 | PATCH | `/api/profile` | auth | 🆕 |
| 10 | POST | `/api/profile/avatar` | auth | 🆕 |
| 11 | DELETE | `/api/profile/avatar` | auth | 🆕 |
| 12 | GET | `/api/profile/preferences` | auth | 🆕 |
| 13 | PATCH | `/api/profile/preferences` | auth | 🆕 |
| **Users** |||||
| 14 | GET | `/api/users` | users.view | 🆕 |
| 15 | GET | `/api/users/options` | auth | 🆕 |
| 16 | GET | `/api/users/{id}` | users.view | 🆕 |
| 17 | POST | `/api/users` | users.create | 🆕 |
| 18 | PATCH | `/api/users/{id}` | users.update | 🆕 |
| 19 | PATCH | `/api/users/{id}/status` | users.deactivate | 🆕 |
| **Roles** |||||
| 20 | GET | `/api/permissions` | roles.view | ⭐ |
| 21 | GET | `/api/roles` | roles.view | 🆕 |
| 22 | GET | `/api/roles/{id}` | roles.view | 🆕 |
| 23 | POST | `/api/roles` | roles.create | 🆕 |
| 24 | PATCH | `/api/roles/{id}` | roles.update | 🆕 |
| 25 | DELETE | `/api/roles/{id}` | roles.delete | 🆕 |
| **Projects** |||||
| 26 | GET | `/api/projects` | projects.view | 🆕 |
| 27 | GET | `/api/projects/options` | auth | 🆕 |
| 28 | GET | `/api/projects/{id}` | projects.view | 🆕 |
| 29 | POST | `/api/projects` | projects.create | 🆕 |
| 30 | PATCH | `/api/projects/{id}` | projects.update | 🆕 |
| 31 | POST | `/api/projects/{id}/archive` | projects.delete | 🆕 |
| 32 | POST | `/api/projects/{id}/restore` | projects.delete | 🆕 |
| **Project members** |||||
| 33 | GET | `/api/projects/{id}/members` | projects.view | 🆕 |
| 34 | POST | `/api/projects/{id}/members` | projects.assign_members | 🆕 |
| 35 | PATCH | `/api/projects/{id}/members/{userId}` | projects.assign_members | 🆕 |
| 36 | DELETE | `/api/projects/{id}/members/{userId}` | projects.assign_members | 🆕 |
| **Issues** |||||
| 37 | GET | `/api/issues` | issues.view | 🆕 |
| 38 | GET | `/api/issues/{id}` | issues.view | 🆕 |
| 39 | POST | `/api/issues` | issues.create | 🆕 |
| 40 | PATCH | `/api/issues/{id}` | issues.update | 🆕 |
| 41 | PATCH | `/api/issues/{id}/status` | issues.change_status | 🆕 |
| 42 | POST | `/api/issues/{id}/approve` | issues.approve | 🆕 |
| 43 | PATCH | `/api/issues/{id}/assignee` | issues.assign | 🆕 |
| 44 | DELETE | `/api/issues/{id}` | issues.delete | 🆕 |
| 45 | GET | `/api/issues/{id}/comments` | issues.view | 🆕 |
| 46 | POST | `/api/issues/{id}/comments` | issues.comment | 🆕 |
| 47 | GET | `/api/issues/{id}/attachments` | issues.view | 🆕 |
| 48 | POST | `/api/issues/{id}/attachments` | issues.update | 🆕 |
| 49 | DELETE | `/api/attachments/{id}` | uploader / issues.delete | 🆕 |
| 50 | GET | `/api/issues/{id}/history` | issues.view | 🆕 |
| **Groups** |||||
| 51 | GET | `/api/groups` | groups.view | 🆕 |
| 52 | GET | `/api/groups/{id}` | groups.view | 🆕 |
| 53 | POST | `/api/groups` | groups.create | 🆕 |
| 54 | PATCH | `/api/groups/{id}` | groups.update | 🆕 |
| 55 | DELETE | `/api/groups/{id}` | groups.delete | 🆕 |
| 56 | POST | `/api/groups/{id}/members` | groups.manage_members | 🆕 |
| 57 | DELETE | `/api/groups/{id}/members/{userId}` | groups.manage_members | 🆕 |
| 58 | GET | `/api/groups/{id}/messages` | group member | 🆕 |
| 59 | POST | `/api/groups/{id}/messages` | groups.send_message | 🆕 |
| 60 | POST | `/api/groups/{id}/read` | group member | 🆕 |
| **Notifications** |||||
| 61 | GET | `/api/notifications` | notifications.view | 🆕 |
| 62 | GET | `/api/notifications/unread-count` | auth | 🆕 |
| 63 | PATCH | `/api/notifications/{id}/read` | owner | 🆕 |
| 64 | POST | `/api/notifications/read-all` | auth | 🆕 |
| **Activity / Dashboard / Reports / Search / Settings** |||||
| 65 | GET | `/api/activity` | activity.view | 🆕 |
| 66 | GET | `/api/activity/export` | activity.export | 🆕 |
| 67 | GET | `/api/dashboard` | dashboard.view | 🆕 |
| 68 | GET | `/api/dashboard/developer` | dashboard.view | 🆕 |
| 69 | GET | `/api/reports/summary` | reports.view | 🆕 |
| 70 | GET | `/api/reports/issues/export` | reports.export | 🆕 |
| 71 | GET | `/api/search` | auth | 🆕 |
| 72 | GET | `/api/settings` | settings.view | 🆕 |
| 73 | PATCH | `/api/settings` | settings.update | 🆕 |
| 74 | GET | `/api/meta/enums` | auth | ⭐ |

**Optional extras (⭐):** `DELETE /api/users/{id}`, `DELETE /api/projects/{id}`, `GET /api/projects/{id}/member-roles`, `PATCH|DELETE /api/issues/{id}/comments/{cid}`, `POST /api/issues/{id}/reject`, `GET /api/attachments/{id}/download`, `GET /api/groups/{id}/eligible-members`, `DELETE /api/notifications/{id}`, WebSocket channels (section 12.4).

---

### Suggested build order

1. `/auth/me` field additions + permission name cleanup (section 0.6), because everything depends on them.
2. Users, Roles (admin setup).
3. Projects + Members + auto default group.
4. Issues + status/assign/approve + comments + history.
5. Attachments, Groups + Messages.
6. Notifications, Activity.
7. Dashboard, Reports, Search, Settings.
