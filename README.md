# Moolabase - Jobs & Services Marketplace

A modern marketplace platform built with Next.js, Supabase, and Tailwind CSS. Connect employers with job seekers and service providers with clients.

## Features

### ✅ Phase 1: Job & Service Posting (Complete)
- **Post Jobs**: Employers can create and list job opportunities
- **Post Services**: Service providers can offer their expertise
- **Live Listings**: Real-time job and service feed
- **Search & Filter**: Find jobs/services by keyword and location
- **Job Details**: Detailed job descriptions with apply functionality
- **Service Details**: Service offerings with inquiries
- **Applications**: Apply to jobs or inquire about services

### ✅ Phase 2: Messaging Foundation (Complete)
- **Conversations**: Browse conversations with other users
- **Real-time Messaging**: Send and receive messages instantly
- **Message History**: Full conversation threads with timestamps
- **Auto-refresh**: Messages update every 3 seconds

### ✅ Phase 3: Navigation (Complete)
- **Bottom Navigation Bar**: Quick access to Home, Messages, and Profile
- **Active State Indicators**: Visual feedback for current page
- **Responsive Design**: Works seamlessly on mobile and desktop
- **Profile Page**: User profile dashboard (placeholder for auth integration)

## Tech Stack

- **Frontend**: Next.js 16.1.2 (App Router) with TypeScript
- **Backend**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **Authentication**: Ready for Supabase Auth integration

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (https://supabase.com)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables (.env.local)
# Create file with:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# 3. Set up database
# Follow docs/DATABASE_SCHEMA.md to create tables

# 4. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

## Getting Environment Variables

1. Go to your Supabase project dashboard
2. Navigate to **Settings → API**
3. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service role secret** → `SUPABASE_SERVICE_ROLE_KEY`

## Project Structure

```
moolabase/
├── app/
│   ├── components/          # Reusable components (BottomNav)
│   ├── api/                 # Server-side API routes
│   │   ├── jobs/            # Job posting endpoint
│   │   ├── services/        # Service posting endpoint
│   │   ├── conversations/   # Conversation management
│   │   └── messages/        # Message handling
│   ├── post/
│   │   ├── jobs/            # Job posting form & details
│   │   └── services/        # Service posting form & details
│   ├── messages/            # Messaging UI
│   ├── profile/             # User profile (placeholder)
│   ├── layout.tsx           # Root layout with bottom nav
│   ├── page.tsx             # Homepage with listings & search
│   └── globals.css          # Global styles
├── docs/
│   ├── PROJECT_SPEC.md      # Project specification
│   └── DATABASE_SCHEMA.md   # Database setup guide
├── lib/
│   └── supabase/            # Supabase client configuration
└── public/                  # Static assets
```

## Pages & Routes

### Public Pages
- **`/`** - Homepage with live job/service listings and search
- **`/post/jobs`** - Form to post new jobs
- **`/post/jobs/[id]`** - View job details
- **`/post/jobs/[id]/apply`** - Apply to a job
- **`/post/services`** - Form to post new services
- **`/post/jobs/service/[id]`** - View service details
- **`/post/jobs/service/[id]/apply`** - Inquire about service
- **`/messages`** - View all conversations
- **`/messages/[id]`** - Chat with a user
- **`/profile`** - User profile (placeholder)

### API Routes
- **`POST /api/jobs`** - Create a new job
- **`POST /api/services`** - Create a new service
- **`GET /api/conversations`** - List user conversations
- **`POST /api/conversations`** - Create new conversation
- **`GET /api/messages?conversation_id=`** - Get messages
- **`POST /api/messages`** - Send a message

## Database Schema

The app uses 6 main tables:

1. **jobs** - Job listings with title, description, location, offer
2. **services** - Service offerings with title, category, price
3. **job_applications** - Applications to jobs
4. **service_applications** - Inquiries to services
5. **conversations** - Messaging threads between users
6. **messages** - Individual messages within conversations

See [DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md) for complete schema with all fields.

## Key Features Explained

### Live Data Fetching
- Homepage fetches jobs and services in real-time from Supabase
- Results update as new listings are posted
- Search filters data client-side for instant results

### Secure API Routes
- Job and service posting use server-side API routes
- Secret API keys never exposed to the browser
- Service role key used only on server for authenticated operations
- Full validation and error handling

### Messaging System
- Users can start conversations after connecting
- Messages sync every 3 seconds
- Full message history available
- Timestamps for all messages

### Bottom Navigation
- Fixed navigation bar on all pages
- Home, Messages, Profile links
- Active state styling
- Mobile-optimized design

## Development Commands

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Check for errors
```

## Troubleshooting

### "Server configuration error" when posting jobs/services
**Solution**: 
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is in `.env.local`
- Restart dev server after updating env vars
- Verify key is correct in Supabase dashboard

### No jobs/services show on homepage
**Solution**:
- Check that `jobs` and `services` tables exist in Supabase
- Insert sample data to test
- Open DevTools → Network tab to debug requests

### Messages not sending
**Solution**:
- Verify `conversations` and `messages` tables are created
- Check `SUPABASE_SERVICE_ROLE_KEY` is configured
- Open browser console for specific error messages

### Environment variables not working
**Solution**:
- Verify `.env.local` exists in project root
- Check all 3 variables are present
- Restart dev server after changes
- Variables are case-sensitive

## Next Phases / Future Features

### Phase 4: User Authentication
- Supabase Auth integration
- User registration and login
- Profile customization
- User avatars and ratings

### Phase 5: Advanced Messaging
- Typing indicators
- Seen/read receipts
- Push notifications
- File sharing

### Phase 6: Payments & Transactions
- Stripe/PayPal integration
- Transaction history
- Dispute resolution
- Escrow management

### Phase 7: Reviews & Ratings
- 5-star review system
- Ratings for both sides
- Review moderation
- Rating badges

## Deployment

### Deploy to Vercel
1. Push code to GitHub
2. Create project on Vercel
3. Connect GitHub repository
4. Add environment variables in Vercel settings
5. Deploy automatically on push

For more details: https://nextjs.org/docs/deployment

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues, questions, or feature requests:
- Open an issue in GitHub
- Check existing documentation
- Review error messages in browser console

## License

This project is licensed under the MIT License - see LICENSE file for details.

---

**Status**: Phases 1-3 Complete ✅
**Last Updated**: January 2024
**Version**: 1.0.0
**Next**: Phase 4 - User Authentication
