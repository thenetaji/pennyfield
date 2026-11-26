import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { strFromU8, unzipSync } from "fflate";

import { readXlsxRows } from "@/lib/investments/xlsx";

/** Picks one or more .xlsx files and returns each workbook as sheets of string rows; null when cancelled. */
export async function pickXlsxWorkbooks(): Promise<string[][][][] | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream",
    ],
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const books: string[][][][] = [];
  for (const asset of result.assets) {
    const bytes = asset.file
      ? new Uint8Array(await asset.file.arrayBuffer())
      : await new File(asset.uri).bytes();
    const entries = unzipSync(bytes, {
      filter: (f) => f.name === "xl/sharedStrings.xml" || f.name.startsWith("xl/worksheets/sheet"),
    });
    const files: Record<string, string> = {};
    for (const [name, data] of Object.entries(entries)) files[name] = strFromU8(data);
    books.push(readXlsxRows(files));
  }
  return books;
}
