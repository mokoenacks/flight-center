# FlightAngel

Travel desk for quoting flights, holidays, tours, cruises, and cars, and for keeping the social posts on the same offer.

Built with React, TypeScript, and Vite. Quotes, campaigns, and visit counts are stored in Supabase.

## Run it

1. Install Node.js.
2. Copy `.env.example` to `.env` and set your own Supabase URL and publishable key.
3. In the Supabase SQL editor, run `supabase/multi-agent.sql`, then `supabase/bids.sql`.
4. Start the desk:

```
npm install
npm run dev
```

On Windows, double-click `start.bat`. The desk opens at http://localhost:5173.
