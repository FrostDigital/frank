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
- `EMAIL_SERVER_*` - SMTP configuration
- `OPENAI_APIKEY` - OpenAI API key for AI features
- `OPENAI_MODEL` - OpenAI model (e.g., "gpt-3.5-turbo")
- `PUBLIC_URL` - Frank server URL
- `S3_*` - S3 storage configuration (AWS or compatible services like OpenStack Swift)
- Theme colors via `THEME_BLUE_*`, `THEME_GREEN_*`, `THEME_RED_*` environment variables

## Architecture

### API Route Structure

Frank uses Next.js 13 App Router with file-based API routing. Routes are organized as:

```
src/app/api/
├── user/                    # User management
├── space/[spaceid]/         # Space-scoped resources
│   ├── content/             # Content CRUD
│   ├── contenttype/         # Content type definitions
│   ├── asset/               # Asset management
│   ├── folder/              # Folder organization
│   ├── user/                # Space users
│   ├── accesskey/           # Content access keys
│   ├── webhook/             # Webhooks
│   ├── ai/                  # AI operations
│   └── trash/               # Trash management
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
- Cron jobs for scheduled tasks (`/schedule/oneminute`, `/schedule/fiveminute`)
- Production build with Next.js
