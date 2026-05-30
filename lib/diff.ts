// Minimal line-based diff. Not a perfect Myers, but produces clean side-by-side output
// for a prototype. Aligns common lines, marks added/removed.

export type DiffLine =
  | { kind: "ctx"; left: string; right: string; leftNo: number; rightNo: number }
  | { kind: "add"; right: string; rightNo: number }
  | { kind: "del"; left: string; leftNo: number };

/** LCS-based line diff. O(n*m) — fine for prototype-sized files. */
export function diffLines(before: string | null, after: string | null): DiffLine[] {
  const A = (before ?? "").split("\n");
  const B = (after ?? "").split("\n");
  const n = A.length, m = B.length;

  // LCS table
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (A[i] === B[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0, j = 0;
  let li = 1, ri = 1;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      out.push({ kind: "ctx", left: A[i], right: B[j], leftNo: li++, rightNo: ri++ });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "del", left: A[i], leftNo: li++ });
      i++;
    } else {
      out.push({ kind: "add", right: B[j], rightNo: ri++ });
      j++;
    }
  }
  while (i < n) { out.push({ kind: "del", left: A[i++], leftNo: li++ }); }
  while (j < m) { out.push({ kind: "add", right: B[j++], rightNo: ri++ }); }
  return out;
}

export function diffStats(lines: DiffLine[]) {
  let adds = 0, dels = 0;
  for (const l of lines) {
    if (l.kind === "add") adds++;
    else if (l.kind === "del") dels++;
  }
  return { adds, dels };
}
