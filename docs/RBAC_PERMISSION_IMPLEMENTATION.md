# RBAC & Permission Implementation

## 1. Architecture Overview

The platform uses **permission-based authorization** as the single source of truth.

Roles are **containers of permissions only**. Authorization decisions are never driven by role names.

```
User → [Role, Role, ...] → effectivePermissions (union of all role permissions)
       ↑ containers only

Permission check: user.effectivePermissions.includes(REQUIRED_PERMISSION)
```

Authorization never checks `if (user.role === 'ADMIN')`.

---

## 2. Permission Model

**File:** `src/models/permission.model.js`

| Field | Type | Description |
|-------|------|-------------|
| `code` | String (unique, uppercase) | Machine-readable identifier, e.g. `EVENT_CREATE` |
| `name` | String | Human-readable label |
| `description` | String | Explanation of what the permission allows |
| `module` | String | Grouping prefix, e.g. `EVENT`, `ROLE`, `USER` |
| `isActive` | Boolean | Whether permission is active (default: true) |
| `timestamps` | Auto | `createdAt`, `updatedAt` |

---

## 3. Role Model

**File:** `src/models/role.model.js`

| Field | Type | Description |
|-------|------|-------------|
| `name` | String (unique, uppercase) | Role identifier, e.g. `ADMIN`, `JUDGE` |
| `code` | String (unique, uppercase) | Stable role code used by API clients |
| `description` | String | Human-readable description |
| `permissions` | ObjectId[] → Permission | Permission list (containers only) |
| `isSystemRole` | Boolean | True for seed/built-in roles (cannot be deleted) |
| `isActive` | Boolean | Soft-delete support |
| `timestamps` | Auto | `createdAt`, `updatedAt` |

---

## 4. Effective Permission Resolution

**Middleware:** `src/middlewares/authHandlingMiddleware.js`

On every authenticated request:

```js
const user = await USER_SERVICE.getRawUserById(decoded.id)
const effectivePermissions = USER_SERVICE.getPermissionCodes(user)

req.user = {
  id, email, roles, role, permissions, effectivePermissions
}
```

`getPermissionCodes` (in `user.service.js`) unions permissions from all active assigned roles and ignores inactive permissions:

```js
const getPermissionCodes = (user) => {
  const directPermissions = user?.permissions || []
  const activeRoles = (user?.roles || []).filter(role => role.isActive !== false)
  const rolePermissions = activeRoles.flatMap(role => role.permissions || [])
  return [...new Set([...directPermissions, ...rolePermissions]
    .map(p => p.isActive === false ? null : p.code || p)
    .filter(Boolean))]
}
```

**Permission Middleware:** `src/middlewares/permission.middleware.js`

```js
permissionMiddleware('EVENT_CREATE')  // checks req.user.effectivePermissions
```

---

## 5. Permission Codes

All permission codes are defined in `src/constants/permissions.js`:

| Module | Codes |
|--------|-------|
| EVENT | `EVENT_CREATE`, `EVENT_VIEW`, `EVENT_UPDATE`, `EVENT_DELETE` |
| TRACK | `TRACK_CREATE`, `TRACK_VIEW`, `TRACK_UPDATE`, `TRACK_DELETE` |
| WORKSHOP | `WORKSHOP_CREATE`, `WORKSHOP_VIEW`, `WORKSHOP_UPDATE`, `WORKSHOP_DELETE`, ... |
| TEAM | `TEAM_CREATE`, `TEAM_VIEW`, `TEAM_UPDATE`, `TEAM_DELETE` |
| USER | `USER_CREATE`, `USER_VIEW`, `USER_UPDATE`, `USER_ROLE_ASSIGN`, `USER_ASSIGN_ROLE` |
| PARTICIPANT | `PARTICIPANT_VIEW`, `PARTICIPANT_APPROVE` |
| JUDGING | `JUDGING_ASSIGN` |
| SCORE | `SCORE_CREATE`, `SCORE_VIEW` |
| GITHUB | `GITHUB_CONFIGURE`, `GITHUB_REPOSITORY_CREATE`, `GITHUB_ACCESS_REVOKE` |
| AI | `AI_REVIEW_TRIGGER`, `AI_REVIEW_VIEW` |
| RESULT | `RESULT_PUBLISH` |
| AUDIT | `AUDIT_LOG_VIEW` |
| SYSTEM | `SYSTEM_CONFIG_MANAGE` |
| **ROLE** | `ROLE_VIEW`, `ROLE_CREATE`, `ROLE_UPDATE`, `ROLE_DELETE`, `ROLE_ASSIGN_PERMISSION` |
| **PERMISSION** | `PERMISSION_VIEW`, `PERMISSION_UPDATE` |
| GOOGLE | `GOOGLE_CONNECT` |

---

## 6. Admin Full-Permission Strategy

The `ADMIN` role **always receives all permissions** on every seed run.

**File:** `src/scripts/initDb.js`

```js
if (name === 'ADMIN') {
  permissionIds = allPermissionIds  // every permission in the database
} else {
  permissionIds = (ROLE_PERMISSION_MAP[name] || []).map(...)
}
```

This means:
- Adding a new permission code to `constants/permissions.js` and re-running `npm run db:init` **automatically** grants it to ADMIN.
- No manual database update is needed.
- The ADMIN role's permission set cannot be modified through role-permission APIs, preventing accidental removal of admin capabilities.

---

## 7. API Endpoints

### Permissions

| Method | Path | Permission Required | Description |
|--------|------|---------------------|-------------|
| GET | `/api/permissions` | `PERMISSION_VIEW` | List all permissions |
| GET | `/api/permissions/grouped` | `PERMISSION_VIEW` | List grouped by module |
| GET | `/api/permissions/:id` | `PERMISSION_VIEW` | Get permission by ID |
| PATCH | `/api/permissions/:id` | `PERMISSION_UPDATE` | Update name/description/module/isActive |

### Roles

| Method | Path | Permission Required | Description |
|--------|------|---------------------|-------------|
| GET | `/api/roles` | `ROLE_VIEW` | List all roles |
| POST | `/api/roles` | `ROLE_CREATE` | Create a new role |
| GET | `/api/roles/:id` | `ROLE_VIEW` | Get role by ID |
| PATCH | `/api/roles/:id` | `ROLE_UPDATE` | Update role |
| DELETE | `/api/roles/:id` | `ROLE_DELETE` | Soft-delete (system roles are protected) |
| GET | `/api/roles/:id/permissions` | `ROLE_VIEW` | Get permissions of a role |
| PUT | `/api/roles/:id/permissions` | `ROLE_ASSIGN_PERMISSION` | Replace all permissions, except ADMIN |
| POST | `/api/roles/:id/permissions` | `ROLE_ASSIGN_PERMISSION` | Add active permissions, except ADMIN |
| DELETE | `/api/roles/:id/permissions/:permissionId` | `ROLE_ASSIGN_PERMISSION` | Remove one permission, except ADMIN |

### User Role Assignment

| Method | Path | Permission Required | Description |
|--------|------|---------------------|-------------|
| PATCH | `/api/users/:id/roles` | `USER_ROLE_ASSIGN` | Assign roles by name (replaces) |
| PATCH | `/api/users/:id/role` | `USER_ASSIGN_ROLE` | Assign one role by `roleId`, or roles by `roleIds` (replaces) |
| GET | `/api/users/:id/effective-permissions` | `USER_VIEW` | Get resolved permissions |

---

## 8. User Response Shape

`/auth/me`, `/users/:id`, and all user endpoints return:

```json
{
  "id": "...",
  "email": "...",
  "roles": [
    {
      "id": "...",
      "name": "ADMIN",
      "code": "ADMIN",
      "isSystemRole": true,
      "permissions": [{ "id": "...", "code": "EVENT_CREATE", "module": "EVENT" }]
    }
  ],
  "permissions": ["EVENT_CREATE", "ROLE_VIEW", ...],
  "effectivePermissions": ["EVENT_CREATE", "ROLE_VIEW", ...]
}
```

`permissions` and `effectivePermissions` are identical — both contain the union of all role permission codes.

---

## 9. Audit Log Integration

The following RBAC actions are recorded in `AuditLog`:

| Action | Trigger |
|--------|---------|
| `ROLE_CREATE` | New role created |
| `ROLE_UPDATE` | Role fields updated |
| `ROLE_DELETE` | Role soft-deleted |
| `ROLE_ASSIGN_PERMISSION` | Permissions added/removed/replaced on a role |
| `USER_ASSIGN_ROLE` | User roles updated by name or ID |

Audit logs include `userId` (actor), `resourceType`, `resourceId`, and `metadata` with before/after state.

---

## 10. Frontend Integration Guide

### Checking permissions in frontend

Use the `effectivePermissions` array from `/auth/me`:

```ts
const canCreateRole = user.effectivePermissions.includes('ROLE_CREATE')
const canViewPermissions = user.effectivePermissions.includes('PERMISSION_VIEW')
```

### Loading roles for assignment UI

```
GET /api/roles?limit=100
→ array of { id, name, code, description, permissionCount }
```

### Assigning roles to a user

```
PATCH /api/users/:id/role
Body: { "roleId": "<roleObjectId>" }
# or
Body: { "roleIds": ["<roleObjectId>"] }
```

### Loading grouped permissions for role editor

```
GET /api/permissions/grouped
→ [{ module: "EVENT", permissions: [{ id, code, name }] }, ...]
```

### Updating permissions on a role

```
PUT /api/roles/:id/permissions
Body: { "permissions": ["<permId1>", "<permId2>"] }
```

---

## 11. Seeding

Run seed to initialize/sync all permissions and roles:

```bash
npm run db:init
# or inside Docker:
docker-compose exec api node src/scripts/initDb.js
```

Seed is **idempotent** — running it multiple times is safe. It uses `upsert` (findOneAndUpdate with upsert:true).

New permissions added to `constants/permissions.js` will be:
1. Created in the database on next seed run
2. Automatically added to the ADMIN role
3. Reflected in grouped permissions endpoint

---

## 12. System Role Protection

System roles (`ADMIN`, `COORDINATOR`, `JUDGE`, `MENTOR`, `SPEAKER`, `PARTICIPANT`, `EVENT_COORDINATOR`) **cannot be deleted** or renamed via API.

Attempting to delete or rename a system role returns `403 FORBIDDEN`.

Non-system (custom) roles can be soft-deleted only when they are not assigned to users. Deleted roles are marked `isActive: false`; inactive roles cannot be assigned and do not contribute effective permissions.
