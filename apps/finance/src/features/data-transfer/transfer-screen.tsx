import * as React from "react";
import { ScrollView } from "react-native";


import { ExportSection } from "./export-screen";
import { ImportSection } from "./import-screen";

/** CSV import and export. */
export function TransferScreen() {
  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="gap-6 pb-12 pt-4"
    >
      <ImportSection />
      <ExportSection />
    </ScrollView>
  );
}
