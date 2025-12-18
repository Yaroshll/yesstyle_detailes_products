import * as XLSX from "xlsx";
import fs from "fs";

function getTimestamp() {
  const now = new Date();

  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const time = now
    .toTimeString()
    .split(" ")[0]
    .replace(/:/g, "-"); // HH-MM-SS

  return `${date}_${time}`;
}

export function saveToExcelAndCsv(rows) {
  if (!rows || rows.length === 0) {
    console.log("⚠️ No rows to save");
    return;
  }

  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Products");

  if (!fs.existsSync("output")) fs.mkdirSync("output");

  const timestamp = getTimestamp();

  XLSX.writeFile(wb, `output/yesstyle_${timestamp}.xlsx`);
  XLSX.writeFile(wb, `output/yesstyle_${timestamp}.csv`);

  console.log("✅ Saved:", `yesstyle_${timestamp}`);
}
