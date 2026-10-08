# Focus Up

A personal finance app for people with ADHD, and anyone who finds the executive-function side of money
hard: forgotten subscriptions, missed bills, impulse spending. It aims to take as little remembering
and effort as possible.

**Design principles**

- Low effort: logging an expense takes a few taps.
- Nothing depends on the user remembering to do something.
- Non-shaming wording everywhere. Neutral, no guilt.
- The user decides how their spending is sorted, and the app remembers it.
- Status is never shown by color alone.

## Stack

- React Native with Expo (SDK 57), Expo Router, and TypeScript, for iOS and Android
- Supabase: PostgreSQL, email and password auth, row-level security
- Tested on a phone through Expo Go. Phone only, there is no web build.

## Running it

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` with your Supabase project's URL and publishable key. Both are public by design,
   because row-level security protects the data. Never put the secret key or database password here.

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=...
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
   ```

3. Start the app and open it in Expo Go:

   ```bash
   npx expo start
   ```

## Checks

```bash
npx tsc --noEmit   # typecheck
npx expo lint      # lint
npm test           # all automated tests (see below)
npm run test:watch # re-run tests as you edit
npm run test:db    # database security tests (needs the Supabase login and link, see Database)
npx expo-doctor    # project health
```

GitHub runs the typecheck, lint, and `npm test` on every pull request (`.github/workflows/ci.yml`).

## Tests

`npm test` runs everything below in a few seconds and never touches the network or a real account.

| Layer | Where | What it covers |
| --- | --- | --- |
| Logic | `src/lib/*.test.ts` | Money in cents, dates and month ranges, the left-to-spend math |
| Screens | `__tests__/*.test.tsx` | Each screen as a person uses it: tapping, typing, and what shows up. Supabase is faked. |
| Database | `supabase/tests/security.sql` | Row-level security, constraints, and sign-up behavior, against the real schema |

**Adding tests for a new feature**

- A new calculation or helper: add `something.test.ts` next to it in `src/lib/`.
- A new screen: add `__tests__/<screen>.test.tsx`. Copy the closest existing one. Mock `@/lib/api`, set up the
  data with `mockedApi.someFunction.mockResolvedValue(...)`, then `userEvent` and `screen` do the rest.
  `src/test-utils/fixtures.ts` has ready-made fake expenses and sessions.
- A new table or rule: add checks to `supabase/tests/security.sql` above the final `RAISE`, then run `npm run test:db`.
- Shared fakes (Supabase, the router, the date picker) live in `jest.setup.ts`.

## Database

The schema lives in `supabase/migrations/` and is applied with the Supabase CLI, which is a dev
dependency. Run these from the project folder:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Money is stored as whole cents (`1250` is $12.50). Every per-user table is limited to its owner by
row-level security, and the nine category "umbrellas" are shared, read-only rows.

## Code layout

- `src/app/`: screens and routes (Expo Router)
- `src/components/`: shared UI pieces
- `src/hooks/`: session and data hooks
- `src/lib/api.ts`: **every** Supabase call. Screens call functions like `addExpense()` and never use
  the Supabase client directly.
- `src/lib/money.ts`, `dates.ts`, `calc.ts`: pure logic, covered by tests
- `__tests__/`, `src/test-utils/`, `jest.setup.ts`, `supabase/tests/`: automated tests
- `src/constants/`: theme and the fixed umbrellas
