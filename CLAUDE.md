# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Frank is a headless CMS built with Next.js 13 (App Router), TypeScript, MongoDB, and Chakra UI. It provides both a management portal and multiple REST APIs for content management and delivery.

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run ESLint
```

### CLI Tool (User Management)
Located in `cli/` directory. Requires `.env` file with `MONGO_URL`.

```bash
cd cli
npx ts-node frank.ts user-create <email> <name> <role>
# Example: npx ts-node frank.ts user-create john.doe@frank.app "John Doe" "admin"
# Roles: admin | user
```

## Environment Configuration

Create `.env` file in project root with the following required variables:

- `NODE_ENV` - development or production
- `MONGO_URL` - MongoDB connection string
- `JWT_SIGNINGKEY` - Key for signing JWT tokens
- `JWT_LOGIN_EXPIRES_IN` - Login token expiration (e.g., "1h")
- `JWT_AUTHTOKEN_EXPIRES_IN` - Auth token expiration (e.g., "24h")
- `EMAIL_SERVER_HOST`, `EMAIL_SERVER_PORT`, `EMAIL_SERVER_USER`, `EMAIL_SERVER_PASSWORD` - SMTP configuration
- `EMAIL_FROM` - Default email sender address
- `EMAIL_DEFAULT_LANGUAGE` - Default language for emails (defaults to "en")
- `OPENAI_APIKEY` - OpenAI API key for AI features
- `OPENAI_MODEL` - OpenAI model (e.g., "gpt-3.5-turbo")
- `PUBLIC_URL` - Frank server URL
- `S3_ACCESSKEYID`, `S3_SECRETACCESSKEY`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION` - S3 storage configuration (AWS or compatible services)
- `S3_PREFIX` - URL prefix for uploaded files (e.g., "frank-files/")
- `S3_ACL` - ACL for uploaded files
- `S3_LOCATIONTEMPLATE` - Template to override S3 location URL format ({path} will be replaced)
- `BRANDING_FRANK` - Custom brand name (defaults to "Frank")
- `FOLDER_DELETE_MODE` - Content cascade behavior on folder deletion: DETACH (default), CASCADE, or PROMPT
- `THEME_BLUE_*`, `THEME_GREEN_*`, `THEME_RED_*` (50-900) - Custom theme color palette
- `THEME_HORIZONTAL_LOGO`, `THEME_VERTICAL_LOGO` - Custom logo URLs

## Architecture

### API Route Structure

Frank uses Next.js 13 App Router with file-based API routing. Routes are organized as:

```
src/app/api/
├── user/                    # User management (login, profile, tokens)
├── space/[spaceid]/         # Space-scoped resources
│   ├── content/             # Content CRUD
│   ├── contenttype/         # Content type definitions
│   ├── asset/               # Asset management (with image processing)
│   ├── folder/              # Folder organization
│   ├── user/                # Space users and API keys
│   ├── accesskey/           # Content access keys
│   ├── webhook/             # Webhooks and events
│   ├── ai/                  # AI operations (translate, rephrase, tasks)
│   ├── link/                # Custom menu links
│   └── trash/               # Trash management
├── theme/                   # Theme configuration
└── runtime-config/          # Runtime configuration endpoint
```

Each endpoint follows a pattern:
- `route.ts` - Exports HTTP methods (GET, POST, etc.)
- `get.ts`, `post.ts`, `put.ts`, `delete.ts` - Individual method implementations
- `doc.ts` - OpenAPI documentation metadata

### Database Layer

**Models**: `src/models/` - Zod schemas defining data structures
- All models use Zod for runtime validation
- Models represent MongoDB documents

**Database Access**: `src/lib/db.ts`
- `DatabaseCollection<T>` - Generic MongoDB collection wrapper
- `collections` object - Pre-configured collection instances
- Methods: `findOne`, `getById`, `create`, `findMany`, `updateOne`, `updateMany`, `deleteMany`, `aggregate`

**Connection**: `src/lib/mongodb.ts` - MongoDB client singleton

**Important**: Content listing API (`src/app/api/space/[spaceid]/content/get.ts`) loads ALL content items without pagination. This design choice prioritizes simplicity over scalability - filtering and "Load more" functionality is handled client-side. To mitigate performance impact:
- Search input uses 300ms debouncing to reduce excessive filtering on keystroke
- Consider reintroducing server-side pagination if content sets grow very large

### API Utilities (`src/lib/apiUtils.ts`)

Key helper functions for API routes:

- `withUser(req, role, callback)` - Authenticates user via JWT, checks role
- `withSpaceRole(user, spaceId, role, callback)` - Verifies space access
- `withContentAccess(req, spaceId, callback)` - Validates content access keys
- `withRequestBody(req, schema, callback)` - Validates request body with Zod
- `returnJSON(data, schema)` - Validates and returns JSON response
- `returnError()`, `returnNotFound()`, `returnConflict()`, `returnInvalidData()` - Standard error responses

### Authentication Flow

1. User requests login token via email (passwordless)
2. User verifies with token to get JWT auth token
3. JWT auth token used for subsequent API calls
4. Space-level permissions checked via `SpaceUser` collection
5. Content API can use optional access keys for public/restricted content

### Frontend Architecture

**UI Framework**: Chakra UI v2 with custom theme colors
**State Management**: Zustand (`src/stores/appStore.ts`)
**Structure**:
- `src/app/(portal)/` - Main portal UI
  - `login/` - Authentication pages
  - `portal/(main)/` - Top-level navigation (spaces, users)
  - `portal/(space)/spaces/[spaceid]/` - Space-specific views
    - `content/` - Content management
    - `contenttype/` - Content type builder
    - `asset/` - Asset library
    - `settings/` - Space settings with nested layouts

**Components**: `src/components/`
- `ContentEditor/` - Main content editing interface
- `FieldEditors/` - Specialized editors for different field types (String, Number, Boolean, Asset, Reference, Block, etc.)
- `FieldValidators/` - Validation components (Required, MinLength, MaxLength, etc.)
- `AI/` - AI-powered features (translate, rephrase, check)

### Content Model

Frank uses a flexible content type system:

1. **Content Type** - Schema definition with fields
2. **Content** - Metadata (status, dates, references)
3. **Content Data** - Actual field values, versioned by language
4. **Field Types**: String, Number, Boolean, Asset, AssetArray, Reference, ReferenceArray, Object, ObjectArray, Block, Table

Content lifecycle: `new` → `draft` → `published`

### OpenAPI Documentation

Auto-generated OpenAPI docs available at:
- `/docs/management` - Management API (users, spaces)
- `/docs/space/[spaceid]` - Space API (content management)
- `/docs/content/[spaceid]` - Content API (published content delivery)

Documentation generator: `src/lib/docs.ts`
Each route exports a `*_DOC` constant for OpenAPI spec generation

## Key Domain Concepts

- **Space**: Isolated workspace with content types, content, assets, and users
- **Content Type**: Schema definition for content (similar to database table)
- **Content**: Instance of a content type
- **Asset**: Files (images, documents) stored in S3-compatible storage
- **Folder**: Hierarchical organization for content and assets
- **Access Key**: Token for public/restricted content API access
- **Space User**: User with role in a specific space (owner/member)
- **Webhook**: HTTP callbacks for content events
- **Link**: Custom menu items (external or embedded)
- **Module**: Optional features (e.g., translation module)

## Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`)

## Docker

Dockerfile includes:
- Node.js 16 with libvips (for Sharp image processing)
- Cron setup for scheduled tasks (configured to call `/schedule/oneminute` every minute and `/schedule/fiveminute` every 5 minutes)
- Production build with Next.js

**Note**: Schedule endpoints referenced in Dockerfile may need to be implemented if scheduled tasks are required.
