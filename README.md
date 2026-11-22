# Yuzu

[![CI](https://github.com/ahyanadatia/yuzu/actions/workflows/ci.yml/badge.svg)](https://github.com/ahyanadatia/yuzu/actions/workflows/ci.yml)

Earn your rank. A private league for one flat: daily, weekly and eight-week goals, proved with images, refereed by flatmates, scored out of 100 each week.

- `index.html` is the whole site, built from `src/`. It is deployed on Netlify.
- `supabase.sql` creates the database tables and functions on Supabase.
- Sign-in is phone number plus a 6-digit PIN, with a flat invite code for new members. No text messages are sent.

No framework, no bundler and no runtime dependencies: about 800 lines of plain JavaScript, 260 of HTML and CSS, and 170 of SQL.

## How the league works

- **Three kinds of goal.** Dailies you tick each day, weekly outcomes, and seasonal goals with a baseline and a target over an eight-week season.
- **A week is always out of 100**, however many goals you set: 50 for dailies, 30 for weekly outcomes, 20 for seasonal progress. Nothing scores until your goals span three categories.
- **Proof is an image.** When you close out a day, one of the goals you ticked is drawn as the spot check and you upload one image for it. The draw is a fixed function of person, day and ticks, so anyone can verify it.
- **Flatmates referee.** One approval verifies a proof, and so does 24 hours with no review. A rejection zeroes it unless two other flatmates approve. Each week everyone has one assigned referee, rotating from week to week.
- **Standings** rank by points, then days with a check-in, then reviews done.

These rules live in `src/core.js` as pure functions with no DOM or network access, which is what `tests/core.test.js` exercises.

## Design notes

- **The database is the API.** The browser calls Postgres functions over Supabase's REST endpoint with `fetch`; there is no application server and no client library.
- **Locked down without policies.** Every table has row level security enabled and no policies, so the publishable key cannot read or write a single row directly. All access goes through `security definer` functions that check a session token on each call.
- **PIN sign-in, done carefully.** PINs are stored as bcrypt hashes (`pgcrypto`). Eight wrong PINs in a row lock the number for 15 minutes, and a wrong invite code or unknown number is answered after a half-second delay to slow guessing.
- **One file to deploy.** `build.sh` concatenates `src/` into a single `index.html` and substitutes the Supabase URL and key.

## Run your own
1. Create a free Supabase project. Open the SQL editor, paste `supabase.sql`, change `CHANGE-ME` to your invite code, and run it.
2. Copy the project URL and the publishable key from Project Settings > API Keys.
3. `SUPABASE_URL=... SUPABASE_KEY=... ./build.sh`
4. Drop `index.html` onto Netlify.

The publishable key is meant to be public. Tables have row level security with no policies, so the key cannot read or write them; every call goes through a function that checks a session token.

## Looking after it
- Change the invite code: `update public.yz_config set invite_code = 'NEW-CODE' where id = 1;`
- Reset a PIN: `update public.yz_users set pin_hash = extensions.crypt('123456', extensions.gen_salt('bf')), fails = 0, locked_until = null where phone = '+447700900123';`
- Remove someone and their data: `delete from public.yz_users where phone = '+447700900123';`
- Clear old photos: `delete from public.yz_photos where created_at < now() - interval '70 days';`
- Free Supabase projects pause after a week without use. Restore from the dashboard.

## Tests
- `node tests/core.test.js` checks the scoring and review rules.
- `tests/e2e.py` drives two simulated phones against a local Postgres through `tests/shim.py`.
