import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import {
  buildReportWorkbook,
  type WorkbookOptions,
} from "./reportWorkbook";
import { phDay } from "./reporting";

export async function exportReport(
  options: WorkbookOptions,
) {
  if (
    Platform.OS !== "web" &&
    !(await Sharing.isAvailableAsync())
  ) {
    throw new Error(
      "File sharing is unavailable on this device.",
    );
  }

  const asset = Asset.fromModule(
    require("@/assets/images/qr-logo.png"),
  );

  await asset.downloadAsync();

  let logo: string;

  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);

    if (!response.ok) {
      throw new Error("Unable to load the ScanIn logo.");
    }

    const bytes = new Uint8Array(
      await response.arrayBuffer(),
    );

    let binary = "";

    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    logo = btoa(binary);
  } else {
    logo = await new File(
      asset.localUri || asset.uri,
    ).base64();
  }

  const workbook = buildReportWorkbook({
    ...options,
    logo,
  });

  const bytes = new Uint8Array(
    await workbook.xlsx.writeBuffer(),
  );

  const name =
    `ScanIn-${options.isRanking ? "Top-Attendees" : "Attendance"}-` +
    `${phDay(new Date().toISOString())}-${Date.now()}.xlsx`;

  const mime =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([bytes.buffer as ArrayBuffer], {
        type: mime,
      }),
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = name;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } else {
    const file = new File(Paths.cache, name);

    file.create({ overwrite: true });
    file.write(bytes);

    await Sharing.shareAsync(file.uri, {
      mimeType: mime,
      UTI: "org.openxmlformats.spreadsheetml.sheet",
      dialogTitle: name,
    });
  }
}