import ExcelJS from "exceljs";
import { phDate } from "@/lib/domain";
import {
  totals,
  type Ranking,
  type ReportRow,
} from "./reporting";
import type { EventRecord, Profile } from "@/lib/types";

type Cell = string | number | null;

export type WorkbookOptions = {
  rows: ReportRow[];
  events: EventRecord[];
  ranking: Ranking[];
  isRanking: boolean;
  school: string;
  filters: string;
  exportedBy: string;
  profiles: Profile[];
  logo?: string;
};

export function buildReportWorkbook(
  options: WorkbookOptions,
) {
  const wb = new ExcelJS.Workbook();

  wb.creator = options.exportedBy;
  wb.created = new Date();

  const logo = options.logo
    ? wb.addImage({
        base64: options.logo,
        extension: "png",
      })
    : null;

  const statusColors: Record<string, string> = {
    present: "DCFCE7",
    late: "FEF3C7",
    absent: "FEE2E2",
    "not yet recorded": "E5E7EB",
  };

  function sheet(
    name: string,
    headers: string[],
    rows: Cell[][],
    widths: number[],
    statusColumn = -1,
    percentageColumns: number[] = [],
  ) {
    const ws = wb.addWorksheet(name, {
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
      views: [{ state: "frozen", ySplit: 7 }],
    });

    const columns = headers.length;

    ws.columns = widths.map((width) => ({ width }));

    for (let row = 1; row <= 3; row++) {
      ws.getRow(row).height = 23;

      for (let column = 1; column <= columns; column++) {
        const cell = ws.getCell(row, column);

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF047857" },
        };

        cell.font = {
          name: "Calibri",
          color: { argb: "FFFFFFFF" },
          bold: true,
          size: row === 1 ? 17 : 11,
        };
      }

      ws.mergeCells(row, 3, row, columns);
    }

    ws.getCell(1, 3).value = `ScanIn · ${name}`;

    ws.getCell(2, 3).value =
      options.school.trim() || "School Attendance Report";

    ws.getCell(3, 3).value =
      "Attendance and Academic Event Records";

    if (logo !== null) {
      ws.addImage(logo, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: 60, height: 60 },
      });
    }

    ws.mergeCells(4, 1, 4, columns);
    ws.getCell(4, 1).value = options.filters;

    ws.getCell(4, 1).alignment = {
      wrapText: true,
      vertical: "middle",
    };

    ws.getCell(4, 1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD1FAE5" },
    };

    ws.getRow(4).height = 48;

    ws.mergeCells(5, 1, 5, columns);

    ws.getCell(5, 1).value =
      `Exported by: ${options.exportedBy} | ` +
      `${phDate(wb.created.toISOString())} | Philippine Time`;

    ws.getCell(5, 1).alignment = {
      wrapText: true,
      vertical: "middle",
    };

    ws.getRow(5).height = 30;
    ws.getRow(7).values = headers;
    ws.getRow(7).height = 32;

    ws.getRow(7).eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF047857" },
      };

      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      };

      cell.alignment = {
        wrapText: true,
        vertical: "middle",
      };
    });

    rows.forEach((values, index) => {
      const row = ws.getRow(index + 8);
      row.values = values;

      row.height = Math.min(
        180,
        Math.max(
          30,
          ...values.map(
            (value, column) =>
              15 *
              (Math.ceil(
                String(value ?? "").length /
                  Math.max(8, widths[column] - 2),
              ) +
                1),
          ),
        ),
      );

      for (let column = 1; column <= columns; column++) {
        const cell = row.getCell(column);

        cell.font = {
          name: "Calibri",
          size: 11,
          color: { argb: "FF064E3B" },
        };

        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: index % 2 ? "FFF0FDF4" : "FFFFFFFF",
          },
        };

        cell.alignment = {
          wrapText: true,
          vertical: "middle",
        };

        cell.border = {
          bottom: {
            style: "thin",
            color: { argb: "FFC9DFD5" },
          },
        };

        if (percentageColumns.includes(column - 1)) {
          cell.numFmt = "0.0%";
        }

        if (column - 1 === statusColumn) {
          const color =
            statusColors[
              String(values[column - 1]).toLowerCase()
            ];

          if (color) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: `FF${color}` },
            };
          }
        }
      }
    });

    ws.autoFilter = {
      from: { row: 7, column: 1 },
      to: {
        row: Math.max(7, rows.length + 7),
        column: columns,
      },
    };

    const footer = rows.length + 11;
    const middle = Math.floor(columns / 2);

    ws.mergeCells(footer, 1, footer, middle);
    ws.mergeCells(
      footer,
      middle + 1,
      footer,
      columns,
    );

    ws.getCell(footer, 1).value =
      `Prepared by: ${options.exportedBy}`;

    ws.getCell(footer, middle + 1).value =
      "Verified by: ____________________";

    ws.getRow(footer).height = 40;
    ws.getRow(footer).alignment = {
      wrapText: true,
      vertical: "middle",
    };

    const lastColumn = ws.getColumn(columns).letter;

    ws.pageSetup.printArea =
      `A1:${lastColumn}${footer}`;

    ws.pageSetup.printTitlesRow = "7:7";

    ws.pageSetup.margins = {
      left: 0.25,
      right: 0.25,
      top: 0.4,
      bottom: 0.4,
      header: 0.2,
      footer: 0.2,
    };

    ws.headerFooter.oddFooter =
      "&LScanIn&CPage &P of &N&RPhilippine Time";

    return ws;
  }

  const summary = totals(options.rows);

  const summaryRows: Cell[][] = [
    [
      "Events",
      options.events.length,
      "Events matching the selected event/date scope",
    ],
    [
      "Unique Students",
      summary.students,
      "Each student counted once",
    ],
    [
      "Expected Attendance Entries",
      summary.expected,
      "One eligible student per event; totals follow exported rows",
    ],
    ["Present", summary.present, "Recorded Present"],
    ["Late", summary.late, "Recorded Late"],
    [
      "Absent",
      summary.absent,
      "Recorded/finalized absences only",
    ],
    [
      "Not Yet Recorded",
      summary.unrecorded,
      "No attendance record; no absence or scan time invented",
    ],
    [
      "Attendance Rate",
      summary.rate === null
        ? "N/A"
        : `${(summary.rate * 100).toFixed(1)}%`,
      "(Present + Late) / exported expected entries",
    ],
  ];

  if (options.isRanking) {
    summaryRows.push([
      "Ranking",
      options.ranking.length,
      "Top 10 ranks, including ties; completed required events only",
    ]);
  }

  sheet(
    "Summary",
    ["Metric", "Value", "Notes"],
    summaryRows,
    [32, 22, 85],
  );

  sheet(
    "Events",
    [
      "Event",
      "Code",
      "Venue",
      "Description",
      "Start (PH)",
      "End (PH)",
      "Organizer",
      "Course",
      "Year",
      "Block",
      "Type",
    ],
    options.events.map((event) => [
      event.title,
      event.event_code,
      event.venue || "—",
      event.description || "—",
      phDate(event.start_time),
      phDate(event.end_time),
      options.profiles.find(
        (profile) => profile.id === event.created_by,
      )?.full_name || "School organizer",
      event.audience_course || "All",
      event.audience_year || "All",
      event.audience_block || "All",
      event.required ? "Required" : "Optional",
    ]),
    [28, 20, 24, 55, 25, 25, 25, 18, 18, 12, 14],
  );

  sheet(
    "Attendance",
    [
      "Event",
      "Code",
      "Student",
      "Student ID",
      "Course",
      "Year",
      "Block",
      "Status",
      "Scanned At (PH)",
      "Reviewed At (PH)",
      "Correction Reason",
    ],
    options.rows.map((row) => [
      row.event.title,
      row.event.event_code,
      row.name,
      row.schoolId,
      row.course,
      row.year,
      row.block,
      row.status,
      row.scanned ? phDate(row.scanned) : "—",
      row.corrected ? phDate(row.corrected) : "—",
      row.reason || "—",
    ]),
    [28, 20, 30, 20, 18, 18, 12, 22, 25, 25, 40],
    7,
  );

  if (options.isRanking) {
    sheet(
      "Top Attendees",
      [
        "Rank",
        "Student",
        "Student ID",
        "Course",
        "Year",
        "Block",
        "Eligible Events",
        "Present",
        "Late",
        "Absent",
        "Not Recorded",
        "Attendance Rate",
      ],
      options.ranking.map((student) => [
        student.rank,
        student.name,
        student.schoolId,
        student.course,
        student.year,
        student.block,
        student.expected,
        student.present,
        student.late,
        student.absent,
        student.unrecorded,
        student.rate,
      ]),
      [10, 30, 20, 18, 18, 12, 18, 12, 12, 12, 18, 20],
      -1,
      [11],
    );
  }

  return wb;
}