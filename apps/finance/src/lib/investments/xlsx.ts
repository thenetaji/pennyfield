const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

function textOf(xml: string): string {
  let out = "";
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += m[1];
  return unescapeXml(out);
}

function columnIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/[^A-Za-z]/g, "").toUpperCase())
    n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function readSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return [...xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map((m) =>
    textOf(m[1]),
  );
}

function readSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    let next = 0;
    // Self-closing cells (<c r="A1" s="1"/>) carry no value.
    const cellRe = /<c((?:\s[^>]*?)?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    for (const cell of rowMatch[1].matchAll(cellRe)) {
      const attrs = cell[1] ?? "";
      const body = cell[2] ?? "";
      const ref = /\sr="([A-Za-z]+\d*)"/.exec(attrs)?.[1];
      const type = /\st="([^"]*)"/.exec(attrs)?.[1];
      const index = ref ? columnIndex(ref) : next;
      next = index + 1;
      let value = "";
      if (type === "inlineStr") value = textOf(body);
      else {
        const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
        value = type === "s" ? (shared[Number(raw)] ?? "") : unescapeXml(raw);
      }
      while (cells.length < index) cells.push("");
      cells[index] = value;
    }
    if (cells.some((c) => c !== "")) rows.push(cells);
  }
  return rows;
}

/** Sheets in sheet-number order, each as rows of cell strings; gaps are "". */
export function readXlsxRows(files: Record<string, string>): string[][][] {
  const shared = readSharedStrings(files["xl/sharedStrings.xml"]);
  return Object.keys(files)
    .map((path) => ({ path, n: /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(path)?.[1] }))
    .filter((f): f is { path: string; n: string } => f.n !== undefined)
    .sort((a, b) => Number(a.n) - Number(b.n))
    .map((f) => readSheet(files[f.path], shared));
}
