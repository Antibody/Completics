# Next.js Multi-User Project Managment App in Kanban Style

**Free kanaban app:** 🔗 https://www.completics.co 


## Setup TL;DR

Here's a quick guide to get the app running locally:

1.  **Set up Supabase:** Create a project on Supabase.
2.  **Get Environment Variables:**
    *   From your Supabase project settings (Project Settings > API), find your `Project URL` and `Project API keys` (`anon` and `service_role`).
    *   From Supabase "connect" tab find your `URI` (this is your `DATABASE_URL`). Replace `[YOUR-PASSWORD]` with your database password, which you created your Supabase project.
    *   Set your own email and password in Supabase's **Authentication** menu.
    *   Set that email as `ADMIN_ALLOWED_EMAIL` in `.env.local` (see below).
3.  **Create `.env.local`:** In the root of the cloned repository, create a file named `.env.local` and add the following variables, replacing the placeholders with your actual keys and URLs:

    
```
NEXT_PUBLIC_SUPABASE_URL=[YOUR-PROJECT-ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

DATABASE_URL=postgres://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres  #find it in Supabase "connect" tab

## FOR LOCAL DEV YOU CAN USE DIRECT CONNECTION ##
## DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres?sslmode=require

ADVISORY_LOCK_KEY= 999999999999999999 #any other number that fits within a 64-bit integer range
ADMIN_ALLOWED_EMAIL=your_admin_email@example.com #this must be set (together with the password) in Supabase's Authentication menu
```
   
4.  **Clone the repository:**
    ```bash
    git clone https://github.com/Antibody/Completics.git
    ```
5.  **Navigate into the project directory:**
    ```bash
    cd Completics
    ```
6.  **Install dependencies:**
    ```bash
    npm install
    ```
7.  **Run the development server:**
    ```bash
    npm run dev
    ```
8.  For signup confirmatory emails use either default Supabase capability (limited to 2 per hour) or setup custom SMTP server. Setting custom SMTP in Supabase go to `Project setting` -> `Authentication`-> `SMTP settings` -> `Enable Custom SMTP`.
Then in menu `URL Configuration` select the URL to send users back after signup confiramtion
9.  Open your browser to `http://localhost:3000`. Log in as `ADMIN_ALLOWED_EMAIL`. The database schema and RLS policies will be set up automatically on admin's first login.

## Overview

This is a modern, responsive Kanban board application built with Next.js (App Router) and Supabase, now enhanced for **multi-user functionality**. It allows registered users to create and manage their own personal Kanban workspaces, tasks, projects, and versions (vers). Key features include user sign-up and login, automatic database schema setup (triggered by an initial admin action but creates a multi-user ready schema), user-specific workspaces, dynamic task management (add, edit, delete, archive), drag-and-drop for tasks, a calendar view for tasks with due dates, and dedicated sections for managing Projects and Vers. The application uses `@supabase/ssr` for authentication and data handling, ensuring data isolation between users through Row Level Security (RLS). Mobile responsiveness and a theme toggle are also included. **Recent updates have introduced user-defined Tags for tasks and a Rich Text Editor (Markdown) for task descriptions, including support for to-do lists.**

## Features

*   **User Authentication (Sign-up & Login, Logout, Account Removal):**
    *   Secure sign-up and login for all users using Supabase Auth, managed with the `@supabase/ssr` library.
    *   **User Logout:** Users can log out via a dropdown menu accessible from their email in the header.
    *   **Account Removal:** Users can permanently remove their account and all associated data. This action is initiated from the user menu and requires confirmation via a modal.
*   **Multi-User Kanban Workspaces:** Each user can create and manage multiple personal Kanban workspaces.
*   **Automatic Database Setup (Multi-User Ready):**
    *   An initial setup (typically triggered by an admin visiting `/api/admin/initialize-schema` or on first admin login via `AuthContext`) configures the database for multi-user support.
    *   **Corrected RPC Function:** The `create_stage_at_start` RPC function (formerly `create_column_at_start`) and its references to `public.stages` have been corrected to ensure proper database schema initialization.
    *   Creates necessary tables: `users` (from Supabase Auth), `workspaces` (new), `stages`, `tasks`, `projects`, `vers`, **`tags` (for user-defined tags), and `task_tags` (a junction table linking tasks to tags)**.
    *   The `workspaces` table links to `auth.users.id`. `stages` and `tasks` link to `workspaces.id`. `projects` and `vers` link directly to `auth.users.id`. **`tags` also link to `auth.users.id`. `task_tags` links `tasks.id` and `tags.id`.**
    *   Seeds default stages ("To Do", "In Progress", "Done") *for each new workspace* a user creates (via `POST /api/workspaces`).
    *   Sets up user-centric Row Level Security (RLS) policies to ensure users can only access and manage their own data (workspaces, stages, tasks, projects, vers, **tags, and task-tag assignments**) based on `auth.uid()`.
*   **Dynamic Kanban Workspace (User-Specific):**
    *   Displays stages and non-archived tasks for the user's currently selected workspace.
    *   Users can switch between their workspaces.
*   **Task Management (Workspace-Specific):**
    *   **Add Tasks:** Add new tasks to any stage on the active workspace, with title, description, due date, associated project, and ver.
    *   **Edit Tasks:** Edit details of existing tasks. **Task descriptions now support Markdown formatting, including to-do lists.**
    *   **Delete Tasks:** Delete tasks with confirmation.
    *   **Search & Filter Tasks:** Filter tasks on the active Kanban workspace by search term, as well as by selected Project, Ver, and Tags. Filter controls are accessible via dropdown icons in the header on desktop, and within a dedicated "Manage & Filter" modal on mobile.
*   **Task Archiving (User-Specific):**
    *   Archive tasks from the "Done" stage of a user's workspace.
    *   Archived tasks are removed from the main workspace view but remain accessible.
    *   A dedicated "Archive" page (`/archive`) lists the user's archived tasks, with an option to unarchive them.
*   **Drag & Drop:** Move tasks between stages and reorder within stages on a user's workspace.
*   **Calendar View (User-Specific):** Visualize tasks with due dates from the user's workspaces.
*   **Projects Management (User-Specific):**
    *   Users can manage their own Projects (names, descriptions, colors, start/finish dates).
    *   UI refers to these as "Projects"; the underlying database table is `projects`.
    *   View associated tasks for each project.
*   **Vers Management (User-Specific):**
    *   Users can manage their own Vers (names, descriptions, status, start_date, release_date).
    *   UI refers to these as "Vers"; the underlying database table is `vers`.
*   **Workspace Sharing:** Users can generate shareable links for their workspaces, with options for read-only or editable access, and revoke sharing.
*   **Mobile Responsiveness & Modern UI:** The application is designed to be responsive. Key mobile features include:
    *   A horizontally scrolling Kanban workspace for optimal task viewing on smaller screens.
    *   A consolidated "Manage & Filter" modal accessible from the workspace controls bar, providing access to workspace selection, workspace actions (new, share), and task filtering (by Project, Ver, and Tag).
    *   Adaptive header and navigation elements.
*   **Tags (User-Defined Tags):**
    *   Users can create, manage, and assign custom tags to their tasks.
    *   Tags have a name and an optional color.
    *   Tags are user-specific, ensuring each user has their own set of tags.
    *   Tags are displayed as colored badges on the Kanban tasks.
    *   A dedicated popup (`TagsManagerPopup`) allows users to view, create, delete, and assign/unassign tags for a specific task.
*   **Rich Text Editor for Task Descriptions:**
    *   Task descriptions now utilize a Markdown editor, allowing for rich text formatting.
    *   Supports standard Markdown syntax.
    *   Includes support for GitHub Flavored Markdown (GFM), specifically enabling the creation and rendering of interactive to-do lists within the task description.

## Core Mechanics

### Authentication with `@supabase/ssr`

*   Authentication is handled using Supabase Auth, now integrated with the `@supabase/ssr` library for robust server-side and client-side auth in Next.js v15.3 App Router.

### Workspace Sharing

*   Users can enable sharing for their workspaces via the UI, generating a unique shareable link.
*   Sharing can be configured in two modes:
    *   **Read-Only:** Anyone with the link can view the workspace's stages, non-archived tasks, and associated projects/vers. No authentication is required to view.
    *   **Editable:** Signed-in users with the link can view and interact with the workspace (add, edit, delete, move tasks, etc.). Authentication is required for editing.
*   Workspace owners can revoke the share link at any time, disabling public access.
*   The `/api/workspaces/[workspaceId]/sharing` API route (POST/DELETE) is used by the workspace owner to manage the sharing state and mode.
*   The `/api/public/workspaces/[shareToken]` API route is used to fetch shared workspace data publicly. This route uses the **Supabase Service Role Key** to bypass RLS and retrieve workspace details, stages, tasks (non-archived), and associated projects/vers based on the `shareToken`.
*   The `/shared-workspace/[shareToken]` page component renders the shared workspace, determining whether to enable editing based on the fetched `public_share_mode` and the viewer's authentication status.

### Automatic Database Setup (Multi-User Schema)

The `/api/admin/initialize-schema` route (typically triggered once by an admin) initializes the database schema for multi-user functionality:
*   **Corrected RPC Function:** The `create_stage_at_start` RPC function (formerly `create_column_at_start`) and its references to `public.stages` have been corrected to ensure proper database schema initialization.
*   Supports user sign-up and login.
*   The `AuthContext.tsx` component manages the user's session state and makes it available via `useAuth()`.
*   The `Login.tsx` component provides UI for both sign-in and sign-up.
*   Client-side Supabase instance is created using `createBrowserClient` from `@supabase/ssr` (see `lib/supabaseClient.ts`).
*   API Route Handlers use `createServerClient` from `@supabase/ssr` for authenticated requests.
*   **User Menu & Session Management:**
    *   The user's email in the `Header.tsx` component acts as a trigger for a dropdown menu.
    *   The "Logout" option calls `supabase.auth.signOut()`. The `AuthContext.tsx` handles session termination and UI updates (e.g., redirecting to the login page).
*   **Account Removal Process:**
    *   Initiated via a "Remove Account" button (styled in red) in the user menu.
    *   A confirmation modal (`DeleteAccountModal.tsx`) appears, warning the user about the permanent nature of the action and data loss.
    *   If confirmed by the user, a `DELETE` request is made from `Header.tsx` to the `/api/user/remove-account/route.ts` API endpoint.
    *   The backend API route verifies the user's session. It then uses a Supabase admin client (initialized with the `SUPABASE_SERVICE_ROLE_KEY`) to delete the user from `auth.users` using `supabase.auth.admin.deleteUser(userId)`.
    *   Database `ON DELETE CASCADE` constraints on foreign keys referencing `auth.users.id` (for `workspaces`, `projects`, `vers`, **`tags`**) and `workspaces.id` (for `stages`, `tasks`) ensure all associated user data is automatically deleted from the database. **The `task_tags` table also has `ON DELETE CASCADE` on `task_id` and `tag_id` to automatically clean up assignments.**
    *   The client-side then forces a logout and displays a success/error toast notification.

### Database Schema (`workspaces`, `stages`, `tasks`, `projects`, `vers`, `tags`, `task_tags`)

*   **`workspaces` Table:** Stores user-owned workspaces, including sharing configuration (`id`, `user_id`, `name`, `created_at`, `share_token` (UUID, nullable), `is_shared_publicly` (BOOLEAN), `public_share_mode` (TEXT/ENUM: `'read-only'` | `'editable'`, nullable)).
*   **`stages` Table:** Stores stages for each workspace (`id`, `title`, `order`, `workspace_id`). New stages are added via the `create_stage_at_start` RPC function, which shifts existing stages to maintain order.
*   **`tasks` Table:** Stores tasks for each stage/workspace (`id`, `title`, `description`, `stage_id`, `workspace_id`, `order`, `due_date`, `project_id`, `ver_id`, `is_archived`, `created_at`). **The `description` field now stores Markdown text. Tasks are linked to `tags` via the `task_tags` table.**
*   **`projects` Table:** Stores user-owned "Projects" (UI term) (`id`, `user_id`, `name`, `description`, `color`, `start_date`, `finish_date`, `created_at`).
*   **`vers` Table:** Stores user-owned versions (`id`, `user_id`, `name`, `description`, `status`, `start_date`, `release_date`, `created_at`).
*   **`tags` Table:** Stores user-defined tags (`id`, `user_id`, `name`, `color`, `is_global` (boolean, `TRUE` for predefined tags like 'Urgent', 'Requested', 'Abandoned'), `created_at`). Each user has their own set of tags, and can also see global tags.
*   **`task_tags` Table:** A junction table to associate multiple tags with a single task (`task_id` (UUID, FK to `tasks`, ON DELETE CASCADE), `tag_id` (UUID, FK to `tags`, ON DELETE CASCADE), `assigned_at`). This table has a unique constraint on `(task_id, tag_id)` to prevent duplicate assignments.

### API Routes

*   **`/api/tags` (GET, POST):** Fetches all tags owned by the authenticated user.
*   **`/api/tags/[tagId]` (PUT):** Updates a specific tag owned by the authenticated user. Requires `tagId` in the path. Accepts optional `name` and `color` fields in the body. Returns the updated tag.
*   **`/api/tags/[tagId]` (DELETE):** Deletes a specific tag owned by the authenticated user. Requires `tagId` in the path. Deleting a tag automatically removes its assignments from all tasks due to `ON DELETE CASCADE` on the `task_tags` table.
*   **`/api/tasks/[taskId]/tags` (POST):** Assigns an existing tag to a specific task. Requires `taskId` in the path and `tag_id` (UUID) in the body. Creates an entry in the `task_tags` table.
*   **`/api/tasks/[taskId]/tags/[tagId]` (DELETE):** Removes a specific tag assignment from a task. Requires `taskId` and `tagId` in the path. Deletes the corresponding entry in the `task_tags` table.
*   **Task Operations (Add, Edit, Delete, Move):** These operations are handled directly from client-side components (e.g., `AddTaskForm.tsx`, `KanbanBoard.tsx`, `KanbanTask.tsx`) by interacting with the Supabase client (`supabase.from('tasks').insert/update/delete`). This approach leverages Supabase's Postgrest API for secure and efficient data manipulation, rather than dedicated Next.js API routes for each task action.
*   **`/api/workspaces` (GET, POST):** Manages user's workspaces.
*   **`/api/workspaces/[workspaceId]` (GET, PUT, DELETE):** Manages a specific user workspace.
*   **`/api/workspaces/[workspaceId]/sharing` (POST, DELETE):** Manages workspace sharing (generating share tokens, managing sharing modes).
*   **`/api/workspaces/[workspaceId]/shared-tags` (GET):** Retrieves shared tags for a specific workspace.
*   **`/api/public/workspaces/[shareToken]` (GET):** Retrieves shared workspace data.
*   **`/api/user/remove-account` (DELETE):** Handles user account removal.
*   **`/api/admin/initialize-schema` (POST):** Initializes the database schema and RLS policies (triggered by admin).
*   **`/api/projects` (GET, POST):** Manages user's projects.
*   **`/api/projects/[projectId]` (GET, PUT, DELETE):** Manages a specific user project.
*   **`/api/vers` (GET, POST):** Manages user's versions.
*   **`/api/vers/[verId]` (GET, PUT, DELETE):** Manages a specific user version.
*   **`/api/stages` (GET, POST):** Manages stages within a workspace.
*   **`/api/stages/[stageId]` (PUT, DELETE):** Manages a specific stage.

### User-Specific Data Flow

*   Users sign up/log in.
*   `app/page.tsx` fetches the user's workspaces via `GET /api/workspaces`. If none, prompts to create one.
*   When a workspace is selected, its `workspaceId` is used by `KanbanBoard.tsx` to fetch its specific stages and tasks. **Task data now includes associated tags.**
*   `ProjectsManager.tsx` (for route `/projects`) and `VersManager.tsx` (for route `/vers`) fetch and manage projects/vers owned by the logged-in user (RLS handles data scoping).
*   All task operations (add, edit, delete, archive, move) are scoped to the user's workspaces and tasks. **Tag management and assignment are also user-specific and scoped to the user's tasks and tags.**

### Task Search, Task Archiving, Drag & Drop

*   These features now operate within the context of the authenticated user's selected workspace and data.

## Environment Variables Setup (`.env.local`)

Create a `.env.local` file in the root of your project:

```
NEXT_PUBLIC_SUPABASE_URL=[YOUR-PROJECT-ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

DATABASE_URL=postgres://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres  #find it in Supabase "connect" tab

## FOR LOCAL DEV YOU CAN USE DIRECT CONNECTION ##
## DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-ID].supabase.co:5432/postgres?sslmode=require

ADVISORY_LOCK_KEY= 999999999999999999 #any other number that fits within a 64-bit integer range
ADMIN_ALLOWED_EMAIL=your_admin_email@example.com #this must be set (together with the password) in Supabase's Authentication menu
```
*   The `ADMIN_ALLOWED_EMAIL` is primarily for gating the execution of the `/api/admin/initialize-schema` route. The RLS policies created by this script are user-centric based on `auth.uid()`.
*   The `SUPABASE_SERVICE_ROLE_KEY` is critical for backend operations that require bypassing RLS, such as deleting a user from the `auth.users` table or fetching publicly shared workspace data without authentication. **Never expose this key on the client-side or commit it to public repositories if not using a `.env.local` file.**

## Sending signup confirmatory emails 

Use either default Supabase capability (limited to 2 per hour) or setup custom SMTP server. 
For setting custom SMTP in Supabase go to `Project setting` -> `Authentication`-> `SMTP settings` -> `Enable Custom SMTP`.
Then in menu `URL Configuration` select the URL to send users back after signup confiramtion


## Dependencies

This project uses the following key dependencies:

*   `next`: 15.3.2 - The React framework for building the application.
*   `react`, `react-dom`: 18.2.0 - React libraries for building the UI.
*   `@supabase/supabase-js`: 2.39.7 - Supabase client library for database interaction and authentication.
*   `@supabase/ssr`: 0.5.0 - Supabase client libraries for database interaction and authentication, specifically for server-side and client-side auth in Next.js App Router.
*   `@supabase/auth-helpers-nextjs`: (version added by npm install) - Provides utilities like `createRouteHandlerClient` and `createServerClient` for Next.js App Router authentication.
*   `@dnd-kit/core`: 6.1.0 - Libraries for implementing drag-and-drop functionality.
*   `@dnd-kit/utilities`: 3.2.2 - Libraries for implementing drag-and-drop functionality.
*   `@fullcalendar/core`: 6.1.11 - Libraries for the calendar view.
*   `@fullcalendar/daygrid`: 6.1.11 - Libraries for the calendar view.
*   `@fullcalendar/interaction`: 6.1.11 - Libraries for the calendar view.
*   `@fullcalendar/react`: 6.1.10 - Libraries for the calendar view.
*   `pg`: 8.11.3 - PostgreSQL client for server-side database operations (used in admin setup).
*   `react-toastify`: 10.0.4 - For displaying toast notifications.
*   `uuid`: 9.0.1 - For generating unique IDs (e.g., for share tokens).
*   `zod`: 3.22.4 - For data validation (used in API routes).
*   **`@uiw/react-md-editor`:** 4.3.0 - Markdown editor component for task descriptions.
*   **`react-markdown`:** 9.0.1 - Renders Markdown content.
*   **`remark-gfm`:** 4.0.0 - Plugin for `react-markdown` to support GitHub Flavored Markdown, including task lists.
