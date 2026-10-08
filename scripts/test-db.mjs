// Runs supabase/tests/security.sql against the linked Supabase project and reports the result.
// The SQL always rolls itself back, so nothing is saved. Usage: npm run test:db
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['supabase', 'db', 'query', '--linked', '-f', 'supabase/tests/security.sql'], {
  encoding: 'utf8',
});
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

if (output.includes('ALL_CHECKS_PASSED')) {
  console.log('Database tests passed: security rules and constraints all hold. (Rolled back, nothing was saved.)');
  process.exit(0);
}

const failure = output.match(/FAIL [^\\"\n]*/);
if (failure) {
  console.error(`Database test failed: ${failure[0].trim()}`);
} else if (/link|login|access token|not logged in/i.test(output)) {
  console.error('Could not reach the database. Run `npx supabase login` and `npx supabase link --project-ref <ref>` first.');
} else {
  console.error('Database tests did not finish cleanly. Output:\n' + output.slice(0, 2000));
}
process.exit(1);
