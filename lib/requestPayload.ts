import type { Json } from "./types";
export function parseProposal(text: string): Record<string, Json> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw Error(
      "The proposed changes are invalid. Open the event editor and submit them again.",
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("The proposed changes must describe an event.");
  return value as Record<string, Json>;
}
export function proposalPreview(text: string): Record<string, Json> {
  try {
    return parseProposal(text);
  } catch {
    return {};
  }
}
