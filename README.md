# SCS Student Council File Repository System

A modern, sleek file repository web app for the Student Council (SCS), built with **React + Vite + Tailwind CSS + Supabase**.

Theme: light mode, NU Blue (`#0033A0`) primary + NU Gold (`#FFC72C`) accent lining.

---

## ✅ Features implemented

- **Login / authentication** via Supabase Auth (email + password). Only Admins can create new accounts.
- **Templates Module** — folders per department (`GENERAL`, `Administrative`, `Internal Affairs`, `External Affairs`, `Operations`), with nested custom folders. Admin-only uploads.
- **Documents Module** — same department folders, each with an extra layer: **Document Drafts** and **Final Copies**, plus nested custom folders inside either. Officers may only upload into their own department's **Drafts**. Only **Administrative Department** accounts may upload **Final Copies**, and Admins can upload/access everything everywhere.
- **File metadata** on every file card: Document Name, Date Uploaded, Uploaded By, Version Number, Division, and either a Download button (actual attachment via Supabase Storage) or an Open Link button (external link).
- **Request Access button** appears automatically on any file belonging to a department the signed-in officer doesn't belong to.
- **Ticketing system** (`Access Requests` page) — officers submit requests with a reason; Admins see every pending/approved/denied request and can Approve/Deny. Approval instantly grants that officer download access to that specific file.
- **Access control**:
  - `admin` role (Administrative Department) → full access everywhere, uploads templates, only role allowed to upload Final Copies.
  - `officer` role → can browse/see the *listing* of every department's files, but can only download files in their own department (or ones they've been granted), and can only upload into their own department's Document Drafts folder.
- **Account creation** (Admin-only page `/accounts`) — Name, Position, Department, Division, Role tag.
- Modern techy UI: blue/gold NU palette, glass sidebar, glowing cards, animated transitions.

---

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Go to **SQL Editor** → paste the **entire contents** of `schema.sql` → Run. One run does everything:
   - Drops and recreates all tables (`profiles`, `folders`, `files`, `access_requests`, `file_access_grants`), Row Level Security policies, and the `scs-files` + `avatars` storage buckets.
   - Sets up the auto-generated Member ID system (`20260001`-style IDs, assigned automatically to every account from here on).
   - Safe to re-run any time you want a clean slate.
3. Go to **Authentication → Providers** and make sure **Email** is enabled.
4. Go to **Project Settings → API** and copy your **Project URL**, **anon/publishable key**, and **service_role key** into `.env` (see `.env.example`).
5. Create the first 4 Administrative Department accounts with **one command**:
   ```bash
   npm install
   npm run create-admins
   ```
   This creates real, working, pre-confirmed logins for all 4 accounts (names, positions, member IDs included) — no Dashboard clicking, no SQL, no UUID copying. Password for all 4: `SCSSC20262027`.
6. Sign in with any of those 4 accounts and use the in-app **Manage Accounts** page to create everyone else — their Member ID gets assigned automatically too.

### (Optional but recommended) Instant account creation Edge Function
The in-app "Create Account" form uses standard `supabase.auth.signUp`, which is subject to your project's email-confirmation setting. For an Admin to create fully working accounts instantly (no confirmation email), deploy the included Edge Function:

```bash
supabase functions deploy create-officer
supabase secrets set SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY
```

Then, in `src/pages/Accounts.jsx`, swap the `supabase.auth.signUp(...)` call for a `fetch` to `${SUPABASE_URL}/functions/v1/create-officer` (POST, with the Admin's access token in the `Authorization` header and the form fields as JSON body). This keeps the service-role key server-side only.

### Account editing / password reset / deletion Edge Function

The **Manage Accounts** page's per-account "Edit" panel (update details, reset password to the default `SCSSC20262027`, delete account) calls a second Edge Function the same way. Deploy it alongside `create-officer`:

```bash
supabase functions deploy manage-officer
```

It reuses the same `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` secrets already set above, and is admin-only (checked server-side against `profiles.role`).

---

## 2. Local setup

```bash
npm install
cp .env.example .env
# edit .env and paste your Supabase URL + anon key
npm run dev
```

Visit `http://localhost:5173`.

### Logo
A placeholder `public/SCSLogo.png` is included. Replace it with the real SCS logo (same filename, ideally a square PNG with transparency) — it's used on the login screen and sidebar automatically.

---

## 3. Deploy

Any static host works (Vercel, Netlify, Cloudflare Pages):

```bash
npm run build
```

Deploy the `dist/` folder, and set the two `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` environment variables in your host's dashboard.

---

## 4. Project structure

```
scs/
├── index.html
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── vite.config.js
├── schema.sql                     ← run this in Supabase SQL Editor
├── .env.example
├── public/
│   └── SCSLogo.png                ← replace with real logo
├── supabase/functions/create-officer/index.ts   ← optional Edge Function
└── src/
    ├── main.jsx
    ├── App.jsx                    ← routes + auth guard
    ├── index.css
    ├── supabaseClient.js          ← Supabase client + department constants
    ├── lib/auth.jsx                ← AuthProvider / useAuth hook
    ├── components/
    │   ├── Sidebar.jsx
    │   ├── Navbar.jsx
    │   ├── FolderGrid.jsx
    │   ├── FileCard.jsx
    │   ├── UploadModal.jsx
    │   └── RequestAccessModal.jsx
    └── pages/
        ├── Login.jsx
        ├── Dashboard.jsx
        ├── Templates.jsx
        ├── Documents.jsx
        ├── Tickets.jsx
        └── Accounts.jsx           ← admin-only account creation
```

## 5. Data model summary

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users` with Name, Position, Department, Division, Role (`admin`/`officer`) |
| `folders` | Custom nested folders per module/department(/stage) |
| `files` | Document Name, Date Uploaded, Uploader, Version, Division, storage path or external link |
| `access_requests` | The ticketing system — officer requests, admin responses |
| `file_access_grants` | Auto-created when a request is approved, unlocks download for that officer on that file |

Storage bucket `scs-files` is private; downloads happen through short-lived signed URLs, so files outside a user's department can never be fetched directly even if they inspect network requests — only after an approved grant.
