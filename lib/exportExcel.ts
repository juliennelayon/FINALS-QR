import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform, Share } from "react-native";
import * as XLSX from "xlsx-js-style";

export type ExportCell = string | number | null | undefined;

export type BlockGroup = {
  block: string;
  rows: ExportCell[][];
  present: number;
  late: number;
  absent: number;
  rate: number;
};

export type ExportSummary = {
  total: number;
  present: number;
  late: number;
  absent: number;
  rate: number;
};

export type CourseSection = {
  course: string;
  eventTitle: string;
  eventCode: string;
  eventInfo: [string, string][];
  summary: ExportSummary;
  blocks: BlockGroup[];
};

const COLS = 5;
const BLANK_ROWS_BETWEEN = 4;

const THIN = { style: "thin", color: { rgb: "D4D4D8" } } as const;
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN } as const;
const HEADER_BG = "06B6D4";
const TITLE_BG = "CFFAFE";
const SECTION_BG = "E4E4E7";
const GROUP_BG = "F4F4F5";
const RATE_OK = "DCFCE7";
const RATE_WARN = "FEF3C7";
const RATE_BAD = "FEE2E2";
const STATUS_COLORS: Record<string, string> = {
  present: RATE_OK,
  late: RATE_WARN,
  absent: RATE_BAD,
};

function rateColor(rate: number): string {
  if (rate >= 90) return RATE_OK;
  if (rate >= 70) return RATE_WARN;
  return RATE_BAD;
}

function str(v: ExportCell): XLSX.CellObject {
  return { v: v ?? "", t: "s" };
}

function labelCell(text: string, bg?: string): XLSX.CellObject {
  return {
    v: text,
    t: "s",
    s: {
      font: { bold: true, color: { rgb: "18181B" } },
      alignment: { vertical: "center" },
      fill: bg ? { fgColor: { rgb: bg } } : undefined,
    },
  };
}

function valueCell(text: string): XLSX.CellObject {
  return {
    v: text,
    t: "s",
    s: {
      alignment: { vertical: "center" },
      font: { color: { rgb: "3F3F46" } },
    },
  };
}

function sectionStyle(): XLSX.CellStyle {
  return {
    font: { bold: true, color: { rgb: "0E7490" } },
    fill: { fgColor: { rgb: SECTION_BG } },
    alignment: { vertical: "center" },
  };
}

/** Builds a single sheet containing every course stacked vertically. */
export function buildWorkbookMulti(sections: CourseSection[]): XLSX.WorkBook {
  const data: XLSX.CellObject[][] = [];
  const merges: XLSX.Range[] = [];
  const headerRowIndexes: number[] = [];

  const blankRow = () => [str(""), str(""), str(""), str(""), str("")];
  const mergeRow = (r: number, from: number, to: number) =>
    merges.push({ s: { r, c: from }, e: { r, c: to } });

  sections.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      for (let b = 0; b < BLANK_ROWS_BETWEEN; b += 1) data.push(blankRow());
    }

    // Title
    data.push([
      {
        v: `ATTENDANCE REPORT — ${section.course}`,
        t: "s",
        s: {
          font: { bold: true, sz: 16, color: { rgb: "0E7490" } },
          alignment: { horizontal: "center", vertical: "center" },
          fill: { fgColor: { rgb: TITLE_BG } },
        },
      },
      str(""),
      str(""),
      str(""),
      str(""),
    ]);
    mergeRow(data.length - 1, 0, COLS - 1);

    // Subtitle
    data.push([
      {
        v: `${section.eventTitle}  ·  ${section.eventCode}`,
        t: "s",
        s: {
          font: { bold: true, sz: 12, color: { rgb: "18181B" } },
          alignment: { horizontal: "center" },
          fill: { fgColor: { rgb: TITLE_BG } },
        },
      },
      str(""),
      str(""),
      str(""),
      str(""),
    ]);
    mergeRow(data.length - 1, 0, COLS - 1);

    data.push(blankRow());

    // Section headers
    data.push([
      { v: "EVENT INFO", t: "s", s: sectionStyle() },
      str(""),
      { v: `${section.course} SUMMARY`, t: "s", s: sectionStyle() },
      str(""),
      str(""),
    ]);
    const sectionHeaderRow = data.length - 1;
    mergeRow(sectionHeaderRow, 0, 1);
    mergeRow(sectionHeaderRow, 2, 4);

    // Dashboard body
    const dashRows = Math.max(section.eventInfo.length, 5);
    for (let i = 0; i < dashRows; i += 1) {
      const info = section.eventInfo[i];
      const summaryRow = buildSummaryRow(i, section.summary);
      data.push([
        info ? labelCell(info[0], SECTION_BG) : str(""),
        info ? valueCell(info[1]) : str(""),
        summaryRow ? summaryRow[0] : str(""),
        summaryRow ? summaryRow[1] : str(""),
        summaryRow ? summaryRow[2] : str(""),
      ]);
    }

    data.push(blankRow());

    // Table header
    headerRowIndexes.push(data.length);
    data.push(
      ["No.", "Student Name", "Block", "Status", "Scanned At"].map((h) => ({
        v: h,
        t: "s",
        s: {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: HEADER_BG } },
          alignment: { horizontal: "center", vertical: "center" },
          border: BORDER,
        },
      })),
    );

    let rowNo = 1;
    section.blocks.forEach((group) => {
      data.push([
        {
          v: `BLOCK ${group.block}`,
          t: "s",
          s: {
            font: { bold: true, color: { rgb: "0E7490" } },
            fill: { fgColor: { rgb: GROUP_BG } },
            alignment: { vertical: "center" },
          },
        },
        {
          v: `${group.rows.length}`,
          t: "s",
          s: {
            font: { bold: true, color: { rgb: "0E7490" } },
            fill: { fgColor: { rgb: GROUP_BG } },
            alignment: { horizontal: "right" },
          },
        },
        str(""),
        str(""),
        str(""),
      ]);
      mergeRow(data.length - 1, 1, COLS - 1);

      group.rows.forEach((row) => {
        const status = String(row[3] ?? "").toLowerCase();
        data.push([
          {
            v: rowNo,
            t: "n",
            s: { border: BORDER, alignment: { horizontal: "center" } },
          },
          { v: row[1] ?? "", t: "s", s: { border: BORDER } },
          {
            v: row[2] ?? "",
            t: "s",
            s: { border: BORDER, alignment: { horizontal: "center" } },
          },
          {
            v: row[3] ?? "",
            t: "s",
            s: {
              border: BORDER,
              alignment: { horizontal: "center" },
              fill: STATUS_COLORS[status]
                ? { fgColor: { rgb: STATUS_COLORS[status] } }
                : undefined,
            },
          },
          {
            v: row[4] ?? "",
            t: "s",
            s: { border: BORDER, alignment: { horizontal: "center" } },
          },
        ]);
        rowNo += 1;
      });

      // Per-block subtotal
      data.push([
        {
          v: `Subtotal · Present ${group.present} · Late ${group.late} · Attendance Rate ${group.rate}%`,
          t: "s",
          s: {
            font: { italic: true, color: { rgb: "52525B" } },
            fill: { fgColor: { rgb: GROUP_BG } },
          },
        },
        str(""),
        str(""),
        str(""),
        str(""),
      ]);
      mergeRow(data.length - 1, 0, COLS - 1);
    });

    data.push(blankRow());

    // Course grand total
    const totalCell = (text: string, bg?: string): XLSX.CellObject => ({
      v: text,
      t: "s",
      s: {
        font: { bold: true, color: { rgb: "18181B" } },
        alignment: { horizontal: "center", vertical: "center" },
        fill: { fgColor: { rgb: bg ?? SECTION_BG } },
      },
    });
    data.push([
      {
        v: `${section.course} TOTAL`,
        t: "s",
        s: {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: HEADER_BG } },
          alignment: { vertical: "center" },
        },
      },
      totalCell(`Total ${section.summary.total}`),
      totalCell(`Present ${section.summary.present}`, RATE_OK),
      totalCell(`Late ${section.summary.late}`, RATE_WARN),
      totalCell(
        `Rate ${section.summary.rate}%`,
        rateColor(section.summary.rate),
      ),
    ]);
  });

  // Build sheet
  const sheet = XLSX.utils.aoa_to_sheet([]);
  XLSX.utils.sheet_add_aoa(
    sheet,
    data.map((row) => row.map((cell) => cell.v)),
    { origin: "A1" },
  );
  for (let r = 0; r < data.length; r += 1) {
    for (let c = 0; c < data[r].length; c += 1) {
      sheet[XLSX.utils.encode_cell({ r, c })] = data[r][c];
    }
  }

  sheet["!merges"] = merges;
  sheet["!cols"] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
  ];
  sheet["!rows"] = data.map((_, r) => ({
    hpt: headerRowIndexes.includes(r) ? 22 : 18,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Attendance");
  return wb;
}

function buildSummaryRow(
  index: number,
  summary: ExportSummary,
): XLSX.CellObject[] | null {
  switch (index) {
    case 0:
      return [labelCell("Total"), valueCell(String(summary.total)), str("")];
    case 1:
      return [
        labelCell("Present"),
        {
          v: summary.present,
          t: "n",
          s: {
            font: { bold: true, color: { rgb: "15803D" } },
            fill: { fgColor: { rgb: RATE_OK } },
            alignment: { horizontal: "center" },
          },
        },
        str(""),
      ];
    case 2:
      return [
        labelCell("Late"),
        {
          v: summary.late,
          t: "n",
          s: {
            font: { bold: true, color: { rgb: "B45309" } },
            fill: { fgColor: { rgb: RATE_WARN } },
            alignment: { horizontal: "center" },
          },
        },
        str(""),
      ];
    case 3:
      return [
        labelCell("Absent"),
        {
          v: summary.absent,
          t: "n",
          s: {
            font: { bold: true, color: { rgb: "B91C1C" } },
            fill: { fgColor: { rgb: RATE_BAD } },
            alignment: { horizontal: "center" },
          },
        },
        str(""),
      ];
    case 4:
      return [
        labelCell("Attendance Rate"),
        {
          v: `${summary.rate}%`,
          t: "s",
          s: {
            font: { bold: true, color: { rgb: "18181B" } },
            fill: { fgColor: { rgb: rateColor(summary.rate) } },
            alignment: { horizontal: "center" },
          },
        },
        str(""),
      ];
    default:
      return null;
  }
}

export function excelFileName(prefix: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
}

export async function exportExcel(
  fileName: string,
  workbook: XLSX.WorkBook,
): Promise<{ error: string | null }> {
  try {
    const base64 = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "base64",
    });

    if (Platform.OS === "web") {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1)
        bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return { error: null };
    }

    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.create({ overwrite: true });
    file.write(base64, { encoding: "base64" });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: fileName,
        UTI: "org.openxmlformats.spreadsheetml.sheet",
      });
      return { error: null };
    }

    await Share.share({ message: file.uri });
    return { error: null };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not export Excel.",
    };
  }
}
