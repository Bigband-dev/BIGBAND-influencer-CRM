VERCEL BUILD FIX

1. DELETE:
   app/api/google/gmail/send/route.ts

   The active Gmail sending endpoint is:
   app/api/gmail/send-bulk/route.ts

2. REPLACE:
   components/influencer-table.tsx

   Use:
   components/influencer-table.tsx
   from this ZIP.

3. Run:
   npm run build

Reason:
- TS2306: app/api/google/gmail/send/route.ts exists but is not a valid module.
- InfluencersPage passes currentUserName and totalRegisteredInfluencers,
  so InfluencerTable must declare both props.
