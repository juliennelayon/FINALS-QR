import { useEffect, useRef, useState } from "react";

import { supabase } from "./supabase";

export type RealtimeStatus = "connecting" | "live" | "error";

/**
 * Subscribes to Postgres changes for the given tables and invokes
 * `onChange` (debounced) whenever a row is inserted/updated/deleted.
 *
 * `onChange` is kept in a ref so callers do not need to memoize it, and the
 * subscription is only re-created when the channel name or table set changes.
 * The reload performed by callers is RLS-protected, so stale or unauthorized
 * events are harmless.
 */
export function useRealtime(
  channelName: string,
  onChange: () => void,
  tables: string[] = ["attendance"],
  enabled = true,
): RealtimeStatus {
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tablesKey = tables.join(",");

  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel(channelName);

    tablesKey.split(",").forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            handlerRef.current();
          }, 400);
        },
      );
    });

    setStatus("connecting");
    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        setStatus("live");
      } else if (
        state === "CHANNEL_ERROR" ||
        state === "TIMED_OUT" ||
        state === "CLOSED"
      ) {
        setStatus("error");
      }
    });

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [channelName, tablesKey, enabled]);

  return status;
}
