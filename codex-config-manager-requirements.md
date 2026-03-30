# Codex Config Manager Requirements

## 1. Project Overview

This project is a private web application deployed on a server for managing runtime configuration profiles.

Phase 1 supports `codex`.
Later phases will extend the same system to support `openclaw`.

The main value of the system is:

- Store multiple configuration profiles in a managed list
- Let the administrator create, edit, delete, and activate profiles
- When a profile is activated, immediately write the selected values into the real config files on the server

This is not just a CRUD app. Activation is a file-application action and must update the actual config files used by `codex`.

## 2. Current Confirmed Scope

### 2.1 User Model

- Only one administrator account is required
- Login is mandatory before accessing the management pages
- No multi-user, role, or permission system is needed in V1

### 2.2 Managed Application

- V1 managed application: `codex`
- Future managed application: `openclaw`

### 2.3 Configuration Fields

Each configuration record contains:

- `name`
- `url`
- `apiKey`

### 2.4 Supported Operations

- Login
- View configuration list
- Add configuration
- Edit configuration
- Delete configuration
- Activate configuration

## 3. Real Codex File Mapping

The activation action for `codex` must update two files under `~/.codex`.

### 3.1 Target Files

- `~/.codex/config.toml`
- `~/.codex/auth.json`

### 3.2 Field Mapping

- `url` maps to `base_url` in `config.toml`
- `apiKey` maps to `OPENAI_API_KEY` in `auth.json`

### 3.3 Known File Structure

Based on the files currently present in this directory:

- `config.toml` contains a top-level `base_url` field
- `auth.json` contains a top-level `OPENAI_API_KEY` field

### 3.4 Runtime Behavior

- After `codex` config is updated, it can take effect immediately
- No service restart is required after activation

## 4. Product Goals

### 4.1 Core Goals

- Provide a simple private admin site for managing `codex` endpoint and API key profiles
- Make switching active configuration safe and fast
- Keep sensitive values hidden by default in the UI
- Prepare the architecture for future support of more applications such as `openclaw`

### 4.2 Non-Goals for V1

- No public landing page
- No user registration
- No multi-admin collaboration
- No approval workflow
- No audit dashboard beyond basic apply status fields
- No remote multi-server sync in V1

## 5. Main User Flow

### 5.1 Login Flow

1. User opens the website
2. If not logged in, user is redirected to `/login`
3. User enters administrator username and password
4. On success, user is redirected to the config list page
5. On failure, user stays on the login page and sees an error message

### 5.2 Daily Usage Flow

1. User logs in
2. User views all existing config profiles for `codex`
3. User may add, edit, delete, or activate a profile
4. If user activates a profile, the system writes the selected values to `~/.codex/config.toml` and `~/.codex/auth.json`
5. If file application succeeds, that profile becomes the only active profile for `codex`
6. If file application fails, the previous active state remains unchanged and the error is shown to the user

## 6. Pages and UI Requirements

## 6.1 Login Page

Route: `/login`

Required elements:

- Username input
- Password input
- Login button
- Error message area

Behavior:

- Submit via button or Enter key
- Password must not be visible by default
- Successful login creates a server-side authenticated session
- Logged-in users visiting `/login` should be redirected to `/configs`

## 6.2 Config List Page

Route: `/configs`

This is the main page after login.

Required elements:

- Page title
- Logout button
- Application filter, with `codex` as the initial value
- Add config button
- Table or list of configuration records

Required columns:

- Name
- App Type
- URL
- API Key
- Active Status
- Last Apply Status
- Updated Time
- Actions

API key display rules:

- By default, show masked content only
- Provide a `Show` action to reveal the full value
- Provide a `Hide` action to mask it again
- Full API key must not be shown by default after page refresh

Actions per row:

- Edit
- Delete
- Activate
- Show or Hide API Key

Delete behavior:

- Delete immediately
- No confirmation dialog is required in V1

Activate behavior:

- If the row is already active, disable or hide the activate action
- If activation succeeds, refresh the list state immediately
- If activation fails, show the failure reason

## 6.3 Add and Edit Form

Can be implemented as a modal or a dedicated page.
V1 recommendation: use a modal to keep the flow simple.

Required fields:

- App Type
- Name
- URL
- API Key

Field rules:

- `App Type` is required
- `Name` is required
- `URL` is required
- `API Key` is required

Validation rules:

- `Name` cannot be empty
- `URL` must be a valid URL format
- `API Key` cannot be empty

Form actions:

- Save
- Cancel

Save behavior:

- New record creates a config
- Existing record updates the config
- Save does not automatically activate the config

## 7. Business Rules

### 7.1 Active Record Rule

- For the same `appType`, only one configuration can be active at a time
- In V1 this applies to `codex`
- After `openclaw` is introduced, `codex` and `openclaw` each maintain their own single active record

### 7.2 Activation Success Rule

A configuration is considered activated only when all required target files are updated successfully.

For `codex`, success requires:

- `config.toml` updated successfully
- `auth.json` updated successfully

If either step fails:

- Database active state must not switch to the new config
- Previous active config remains active
- Failure reason must be stored and shown

### 7.3 Delete Rule

- Config records can be deleted directly
- No confirmation popup is required in V1
- If the deleted record is currently active, deletion is still allowed
- Deleting an active record does not roll back the already applied server files
- After deleting an active record:
  - the deleted record is removed from the database
  - no config record remains active for that `appType`
  - the actual server file content stays as last applied until another config is activated

This rule matches the current product decision for V1: direct delete is allowed without confirmation.

### 7.4 Sensitive Data Rule

- API keys must be masked by default in the UI
- API keys must never be printed in server logs
- API keys must not be returned in list APIs unless required by the authenticated page
- If full value is returned to the frontend, it must only be returned for authenticated requests

### 7.5 Session Rule

- Access to `/configs` and related management APIs requires authentication
- Unauthenticated access must redirect to login or return `401`
- Logout must invalidate the session

## 8. Data Model

## 8.1 Config Table

Recommended table name: `configs`

Recommended fields:

- `id`
- `appType`
- `name`
- `url`
- `apiKey`
- `isActive`
- `createdAt`
- `updatedAt`
- `lastAppliedAt`
- `lastApplyStatus`
- `lastApplyMessage`

Recommended field details:

- `id`: primary key
- `appType`: string, initial value `codex`
- `name`: string
- `url`: string
- `apiKey`: string
- `isActive`: boolean
- `createdAt`: datetime
- `updatedAt`: datetime
- `lastAppliedAt`: datetime, nullable
- `lastApplyStatus`: enum-like string such as `success`, `failed`, `never`
- `lastApplyMessage`: text, nullable

Recommended constraints:

- Unique active config per `appType`
- Index on `appType`
- Index on `updatedAt`

## 8.2 Admin Auth Storage

V1 recommendation:

- Do not create an admin user table unless needed later
- Store admin username and password hash in environment variables

Recommended environment variables:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `SESSION_SECRET`

This keeps V1 simple and is sufficient for a single private admin.

## 9. Backend Functional Requirements

## 9.1 Authentication Module

Responsibilities:

- Validate username and password
- Create authenticated session
- Protect private routes
- Logout and destroy session

Requirements:

- Password stored as hash, never plain text
- Session cookie should be `HttpOnly`
- Session cookie should use `Secure` in production
- Session cookie should use a strict or at least `Lax` same-site policy

## 9.2 Config CRUD Module

Responsibilities:

- List configs by `appType`
- Create config
- Update config
- Delete config

Requirements:

- All operations require authentication
- Validation must run on the server, not only in the frontend
- Responses should return clear field-level errors when validation fails

## 9.3 Activation Module

Responsibilities:

- Load the selected config
- Write values to the real server config files
- Update database active state
- Record apply result

Requirements:

- Activation must be a dedicated server action or API endpoint
- File write and database state switch must behave as one logical transaction
- If file write fails, database active state must not change

## 9.4 App Adapter Layer

To support future applications, file-write logic should not be hardcoded everywhere.

Recommended structure:

- One adapter per `appType`
- Each adapter defines:
  - required fields
  - target files
  - mapping rules
  - apply logic
  - validation logic if needed

Initial adapter:

- `codex` adapter

Future adapter:

- `openclaw` adapter

## 10. File Update Requirements

## 10.1 Target Environment

The website must run under the same server user context that owns or can write:

- `~/.codex/config.toml`
- `~/.codex/auth.json`

If the web app cannot write these files, activation will fail.

## 10.2 Path Resolution

Do not hardcode a specific absolute home directory path.

The system should resolve the current runtime user's home directory and then build:

- `~/.codex/config.toml`
- `~/.codex/auth.json`

## 10.3 Update Strategy

For `config.toml`:

- Parse TOML safely
- Update only `base_url`
- Preserve unrelated settings

For `auth.json`:

- Parse JSON safely
- Update only `OPENAI_API_KEY`
- Preserve unrelated fields if more fields are added later

## 10.4 Write Safety

Recommended write process:

1. Read current file
2. Parse current file
3. Build updated content
4. Optionally create a backup copy
5. Write updated content to a temporary file
6. Replace original file atomically if possible

Recommended backup behavior:

- Keep one latest backup per file, or
- Keep timestamped backups with a cleanup rule

V1 recommendation:

- Create a timestamped backup before each successful replace

## 10.5 Error Handling

Activation must fail clearly if any of these occur:

- Target file does not exist
- Target file cannot be read
- Target file cannot be parsed
- Target file cannot be written
- File permission is insufficient

The error message saved to `lastApplyMessage` should be safe and readable.
It should help troubleshooting without exposing secrets.

## 11. Suggested API Design

This section is an implementation recommendation, not a strict UI requirement.

### 11.1 Auth APIs

- `POST /api/login`
- `POST /api/logout`
- `GET /api/session`

### 11.2 Config APIs

- `GET /api/configs?appType=codex`
- `POST /api/configs`
- `PUT /api/configs/:id`
- `DELETE /api/configs/:id`
- `POST /api/configs/:id/activate`

### 11.3 Response Principles

- Return explicit success or failure state
- Return readable error messages
- Do not include secrets in logs
- Avoid returning the full API key to pages that do not need it

## 12. Suggested Frontend Behavior

### 12.1 List Interaction

- Default sort: active first, then most recently updated
- Active rows should have a visible status indicator
- Failed apply status should be visually distinguishable

### 12.2 API Key Masking

Recommended masking format:

- Show first 4 characters and last 4 characters
- Replace the middle portion with `*`

Example:

- `sk-12ab********89xy`

### 12.3 Error Feedback

- Form validation errors should appear near the relevant field
- Activation errors should appear as a toast, inline notice, or row status
- Login errors should stay on the login page

## 13. Non-Functional Requirements

### 13.1 Security

- HTTPS in production
- Session-based authentication
- Password stored only as hash
- No secret logging
- No unauthenticated access to management routes

### 13.2 Reliability

- File writes should avoid partial corruption
- Database and file state should stay consistent as much as possible
- Activation failures must be recoverable by retrying another profile

### 13.3 Maintainability

- Separate UI, data access, and adapter logic
- Keep `codex` apply logic isolated from future `openclaw` logic
- Keep field mapping centralized per app type

### 13.4 Performance

- Fast enough for private admin use
- No special performance requirements in V1

## 14. Deployment Assumptions

Recommended stack:

- Frontend and backend: `Next.js`
- Database: `SQLite`
- Auth: session-based login
- Deployment: one Node.js process behind a reverse proxy such as Nginx

Server requirements:

- The application process must be able to read and write `~/.codex/*`
- The database file must be stored in a persistent location
- Environment variables for admin auth and session secret must be set securely

## 15. Future Extension for Openclaw

The V1 design should reserve support for `openclaw` without changing the core architecture.

Future `openclaw` support should reuse:

- Same login system
- Same config list page
- Same CRUD flow
- Same activation model

Future `openclaw` support will add:

- A new `appType`
- A new adapter
- New file mapping rules
- Potentially different validation rules

## 16. Acceptance Criteria

The V1 system is accepted when all of the following are true:

1. Unauthenticated users cannot access the config management page.
2. Administrator can log in and log out successfully.
3. Administrator can create a `codex` config with `name`, `url`, and `apiKey`.
4. Administrator can edit an existing config.
5. Administrator can delete a non-active config.
6. The list page masks API keys by default.
7. The list page can reveal and hide the full API key on demand.
8. Only one `codex` config can be active at a time.
9. Activating a config updates `~/.codex/config.toml` with the selected `base_url`.
10. Activating a config updates `~/.codex/auth.json` with the selected `OPENAI_API_KEY`.
11. If both file writes succeed, the selected config becomes active.
12. If either file write fails, the selected config does not become active.
13. The system records last apply time and last apply result.
14. `codex` changes can take effect immediately after activation.

## 17. Open Questions and Deferred Decisions

These items do not block V1 requirements writing, but should be finalized before implementation:

- Should deletion of the currently active config be blocked or allowed
- Whether to keep apply history records beyond the latest status fields
- Whether to encrypt `apiKey` at rest in the database
- Exact file mapping and runtime behavior for future `openclaw` support
- Whether backups should be auto-cleaned and how many should be kept

## 18. Recommended Implementation Order

1. Scaffold project and auth flow
2. Create database schema and config CRUD
3. Build config list UI with masked key display
4. Implement `codex` adapter and safe file-write logic
5. Implement activation flow and apply status recording
6. Add error handling, backups, and deployment config
7. Reserve `openclaw` adapter interface for later expansion
