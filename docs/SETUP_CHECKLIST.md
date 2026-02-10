# Moolabase Setup Checklist ✅

## Pre-Launch Tasks

### 1. Environment Setup
- [ ] **Get Supabase Credentials**
  - [ ] Log in to Supabase dashboard
  - [ ] Copy Project URL
  - [ ] Copy Anon Public Key
  - [ ] Copy Service Role Secret

- [ ] **Create `.env.local` File**
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
  ```

- [ ] **Verify File Location**
  - File should be in project root: `/moolabase/.env.local`
  - Never commit this file to version control

### 2. Database Setup
- [ ] **Create All Tables**
  - [ ] Open Supabase SQL Editor
  - [ ] Copy SQL from [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)
  - [ ] Execute the script
  - [ ] Verify all 6 tables created:
    - [ ] jobs
    - [ ] services
    - [ ] job_applications
    - [ ] service_applications
    - [ ] conversations
    - [ ] messages

- [ ] **Add Sample Data** (Optional but recommended for testing)
  ```sql
  INSERT INTO jobs (title, description, location, offer) VALUES
  ('React Developer', 'Build responsive web apps', 'San Francisco, CA', 5000),
  ('UI Designer', 'Design beautiful interfaces', 'New York, NY', 3000);
  ```

### 3. Local Development Setup
- [ ] **Install Dependencies**
  ```bash
  npm install
  ```

- [ ] **Restart Development Server**
  ```bash
  npm run dev
  ```

- [ ] **Verify Environment Variables**
  - Stop server (Ctrl+C)
  - Confirm `.env.local` is saved
  - Restart server
  - Check console for errors

### 4. Testing Checklist

#### Homepage
- [ ] Page loads at http://localhost:3000
- [ ] Jobs/services display from database (if sample data added)
- [ ] Search by keyword works
- [ ] Search by location works
- [ ] Click job → navigates to detail page
- [ ] Click service → navigates to detail page

#### Job Posting
- [ ] Go to /post/jobs
- [ ] Fill in all required fields
- [ ] Submit form
- [ ] Get success message
- [ ] Redirected to job detail page
- [ ] New job appears on homepage

#### Service Posting
- [ ] Go to /post/services
- [ ] Fill in service form
- [ ] Submit successfully
- [ ] Appears on homepage

#### Applications
- [ ] Can apply to jobs
- [ ] Can inquire about services
- [ ] Applications saved to database

#### Messaging
- [ ] Go to /messages
- [ ] Try sending a message (even with placeholder IDs)
- [ ] Messages appear with timestamps
- [ ] Refreshing shows message history

#### Navigation
- [ ] Bottom nav visible on all pages
- [ ] Home link works
- [ ] Messages link works
- [ ] Profile link works
- [ ] Active state highlights correctly
- [ ] Content not overlapped by nav

### 5. Error Verification
- [ ] No TypeScript errors: `npm run lint`
- [ ] Check browser console for errors (F12)
- [ ] Check browser Network tab for failed requests
- [ ] Check server terminal for error logs

### 6. Documentation Review
- [ ] Read [README.md](README.md) - Project overview
- [ ] Read [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Database details
- [ ] Read [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Technical details
- [ ] Read [PROJECT_SPEC.md](PROJECT_SPEC.md) - Original requirements

---

## Common Issues & Solutions

### "Server configuration error" when posting
**Problem**: Missing SUPABASE_SERVICE_ROLE_KEY
**Solution**:
1. Check `.env.local` exists in project root
2. Verify SUPABASE_SERVICE_ROLE_KEY is present
3. Restart dev server (stop and `npm run dev`)
4. Try posting again

### No jobs/services on homepage
**Problem**: Database tables don't exist or are empty
**Solution**:
1. Go to Supabase dashboard
2. Check "jobs" and "services" tables exist
3. Run SQL script from DATABASE_SCHEMA.md to create tables
4. Insert sample data
5. Refresh homepage

### "Cannot read property 'map' of undefined"
**Problem**: API returning error instead of array
**Solution**:
1. Check all 3 environment variables are correct
2. Verify Supabase credentials in .env.local
3. Check that tables are created in database
4. Look at browser console for specific error message

### Navigation bar overlapping content
**Problem**: Content behind bottom nav
**Solution**:
1. This should already be fixed with `pb-24` in layout.tsx
2. Check layout.tsx has the padding wrapper
3. Clear browser cache (Ctrl+Shift+Delete)
4. Restart dev server

### Messages not appearing
**Problem**: Conversations/messages tables missing
**Solution**:
1. Go to Supabase SQL Editor
2. Run the full DATABASE_SCHEMA.md SQL script
3. Verify "conversations" and "messages" tables exist
4. Refresh the page

---

## Verification Script

Run these commands to verify setup:

```bash
# Check Node.js version (should be 18+)
node --version

# Check npm is installed
npm --version

# Install dependencies
npm install

# Run TypeScript check
npm run lint

# Build check
npm run build

# Start dev server
npm run dev
```

If all pass with no errors, setup is complete! ✅

---

## Deployment Checklist

When ready to deploy to production:

### Before Deploying
- [ ] All features tested locally
- [ ] No console errors
- [ ] All environment variables work correctly
- [ ] Database has all tables
- [ ] Sample data works

### Deployment Steps (Vercel)
- [ ] Push code to GitHub
- [ ] Connect GitHub to Vercel
- [ ] Add environment variables in Vercel project settings:
  - [ ] NEXT_PUBLIC_SUPABASE_URL
  - [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
  - [ ] SUPABASE_SERVICE_ROLE_KEY
- [ ] Deploy
- [ ] Test deployed version

### After Deployment
- [ ] Test all features on live site
- [ ] Check performance
- [ ] Monitor error logs
- [ ] Get user feedback

---

## Quick Reference

### Project Commands
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Run production build locally
npm run lint     # Check for errors
```

### Important Files
- `.env.local` - Environment variables (LOCAL ONLY)
- `app/page.tsx` - Homepage
- `app/layout.tsx` - Root layout with navigation
- `docs/DATABASE_SCHEMA.md` - Database setup
- `docs/README.md` - Project documentation

### Supabase Links
- Dashboard: https://supabase.com/dashboard
- API Settings: https://supabase.com/dashboard/project/_/settings/api
- SQL Editor: https://supabase.com/dashboard/project/_/sql

### Key Endpoints
- Homepage: http://localhost:3000
- Post Job: http://localhost:3000/post/jobs
- Post Service: http://localhost:3000/post/services
- Messages: http://localhost:3000/messages
- Profile: http://localhost:3000/profile

---

## Success Indicators ✅

You'll know everything is working when:

1. **Homepage** shows jobs and services from Supabase
2. **Search** filters results in real-time
3. **Posting** creates new jobs/services that appear immediately
4. **Applications** are saved to database
5. **Messages** send and display with history
6. **Navigation** bar works on all pages
7. **No errors** in console or server logs

---

## Support Resources

If you get stuck:

1. **Check Documentation**
   - Start with README.md
   - Then DATABASE_SCHEMA.md
   - Then IMPLEMENTATION_SUMMARY.md

2. **Check Error Messages**
   - Browser console (F12 → Console tab)
   - Network tab (F12 → Network tab)
   - Server terminal (where you ran `npm run dev`)

3. **Common Mistakes**
   - Wrong Supabase credentials
   - Tables not created
   - Environment variable typos
   - Not restarting dev server after .env.local changes

4. **Verification Steps**
   - Confirm .env.local has all 3 variables
   - Confirm all 6 database tables exist
   - Run `npm run lint` to check for errors
   - Check browser console for JavaScript errors

---

**Status**: Ready to Launch 🚀

**Phases Completed**:
- ✅ Phase 1 - Job & Service Posting
- ✅ Phase 2 - Messaging Foundation  
- ✅ Phase 3 - Navigation Bar

**Total Files Created/Modified**: 20+
**Database Tables**: 6
**API Routes**: 4
**Pages**: 12

**Estimated Setup Time**: 10-15 minutes
