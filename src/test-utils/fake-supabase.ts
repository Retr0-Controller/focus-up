import { supabase } from '@/lib/supabase';

type Call = { method: string; args: unknown[] };
type Result = { data?: unknown; error?: unknown };

/**
 * A stand-in for one Supabase query, like `supabase.from('expenses').select(...).eq(...)`.
 * It records every step so a test can check exactly what was asked of the database,
 * and it "returns" whatever result the test gives it, including an error.
 */
export function fakeQuery(result: Result = {}) {
  const calls: Call[] = [];

  const builder: unknown = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === 'then') {
          // `await query` resolves to { data, error }, like the real thing.
          return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
            Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          calls.push({ method: String(property), args });
          return builder;
        };
      },
    },
  );

  return {
    builder,
    calls,
    /** The arguments of the first call to `method`, or undefined if it was never called. */
    args: (method: string) => calls.find((call) => call.method === method)?.args,
    /** Every call to `method`, in order. */
    all: (method: string) => calls.filter((call) => call.method === method).map((call) => call.args),
    /** The steps in order, e.g. ["select", "gte", "lt", "order", "order"]. */
    steps: () => calls.map((call) => call.method),
  };
}

export type FakeQuery = ReturnType<typeof fakeQuery>;

/**
 * Routes `supabase.from(table)` to the fake query for that table.
 * Returns the list of tables that were queried, in order. Asking for a table with no fake fails loudly.
 */
export function fakeTables(tables: Record<string, FakeQuery>) {
  const queried: string[] = [];
  jest.mocked(supabase.from).mockImplementation(((table: string) => {
    queried.push(table);
    const query = tables[table];
    if (!query) throw new Error(`The test did not expect a query to "${table}"`);
    return query.builder;
  }) as never);
  return queried;
}
