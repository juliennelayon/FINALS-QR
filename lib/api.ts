import type { TableName, TableRows } from "./types";
import { supabase } from "./supabase";
export async function rpc<T = unknown>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw Error(error.message);
  return data as T;
}
export async function query<K extends TableName>(
  table: K,
): Promise<TableRows[K][]> {
  const result: TableRows[K][] = [];
  const key =
    table === "student_profiles"
      ? "user_id"
      : ["event_audience", "saved_events"].includes(table)
        ? "event_id"
        : "id";
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from(table)
      .select("*")
      .order(key)
      .range(from, from + 999);
    if (["event_audience", "saved_events"].includes(table))
      q = q.order("student_id");
    const { data, error } = await q;
    if (error) throw Error(error.message);
    result.push(...((data || []) as unknown as TableRows[K][]));
    if (!data || data.length < 1000) return result;
  }
}
export async function uploadImage(
  uri: string,
  kind: "avatar" | "attachment",
  userId: string,
) {
  const response = await fetch(uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024)
    throw Error("Please choose an image smaller than 5 MB.");
  const mime = response.headers.get("content-type") || "image/jpeg";
  if (!["image/jpeg", "image/png", "image/webp"].includes(mime.split(";")[0]))
    throw Error("Choose a JPG, PNG or WebP image.");
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg"}`;
  const bucket = kind === "avatar" ? "avatars" : "request-files";
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: mime });
  if (error) throw Error(error.message);
  return kind === "avatar"
    ? supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
    : path;
}
