/**
 * Paginated query utility for Supabase.
 * Fetches all rows from a query that might exceed the default 1000-row limit.
 */

const PAGE_SIZE = 1000;

/**
 * Fetch all rows from a Supabase query using pagination.
 * @param queryFn - Function that returns a Supabase query builder (without .range())
 * @returns All rows concatenated
 */
export async function fetchAllPaginated<T>(
  queryFn: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> }
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryFn().range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('fetchAllPaginated error:', error);
      break;
    }

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  return allRows;
}
