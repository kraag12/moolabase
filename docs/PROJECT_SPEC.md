# Moolabase Project Specification (Continuation)

## 1. Project Overview

Moolabase is a two-sided jobs & services marketplace.  
Users can:
- Post jobs (clients)
- Post services (service providers)
- Browse, search, and interact with listings

This document is a continuation of an existing project.

---

## 2. Tech Stack

- Next.js (App Router)  
- TypeScript  
- Tailwind CSS  
- Supabase (Database, Auth, Storage)  
- Client-side Supabase usage

---

## 3. Current Project State

- Dashboard/homepage implemented  
- Post a Job & Post a Service pages implemented  
- Job details page: `/post/jobs/[id]`  
- Service details page: `/post/jobs/service/[id]`  
- Authentication (signup, login, forgot password) implemented  

### Database Tables

#### Jobs Table
- id (uuid/text)
- created_at
- title
- description
- location
- offer
- remote_or_local
- duration
- image_url

#### Services Table
- id (uuid/text)
- created_at
- title
- description
- location
- offer
- skills_background
- image_url

---

## 4. Work Rules

- Tasks are done **step by step**, not all at once  
- Only one task is executed before asking for review  
- No refactoring unrelated code  
- No introducing features not explicitly asked for  
- Folder structure must remain consistent

---

## 5. Immediate Focus

**Next steps after `[id]` deletion**:

1. Recreate Jobs `[id]` page  
2. Recreate Services `[id]` page  
3. Make jobs & services on the dashboard clickable  
4. Test routing with real IDs  
5. Confirm Supabase data loads properly

---

## 6. UX / Design Guidelines

- Minimal, clean black & white theme  
- Proper spacing; not cluttered  
- Buttons positioned correctly (Post Job above Post Service)  
- Centered headers & subheaders where appropriate  
- Functional search bar  
- Footer includes About, Contact, Terms, Privacy

---

## 7. Future Phases (Do Not Implement Yet)

- Job application forms  
- Service contact forms  
- Messaging  
- Payments  
- Reviews  
- Notifications  
- Location autocomplete
- RLS and authorization rules
