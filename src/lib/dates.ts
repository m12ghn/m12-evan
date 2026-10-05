export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const dayStart = (s: string) => new Date(`${s}T00:00:00`).toISOString();
export const dayAfter = (s: string) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + 1); return d.toISOString(); };

// Supabase giới hạn 1000 dòng/lần → tải theo trang
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await build(from, from + 999);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}
