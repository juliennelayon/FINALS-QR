import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import { query, rpc } from "./api";
import { useRealtime } from "./useRealtime";
import type { AppContextValue, DataState, Profile, TableName } from "./types";
const blank: DataState = {
  profiles: [],
  student_profiles: [],
  events: [],
  attendance: [],
  event_audience: [],
  saved_events: [],
  requests: [],
  notifications: [],
  audit_log: [],
  system_settings: [],
};
const Context = createContext<AppContextValue | null>(null);
const labels: Record<TableName | "sync", string> = {
  profiles: "accounts",
  student_profiles: "student details",
  events: "events",
  attendance: "attendance",
  event_audience: "event rosters",
  saved_events: "saved events",
  requests: "requests",
  notifications: "notifications",
  audit_log: "activity logs",
  system_settings: "settings",
  sync: "attendance synchronization",
};
export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<DataState>(blank),
    [me, setMe] = useState<Profile | null>(null),
    [loading, L] = useState(false),
    [ready, R] = useState(false),
    [errors, ER] = useState<AppContextValue["errors"]>({}),
    [updated, U] = useState(""),
    [offset, O] = useState(0),
    [clock, C] = useState(Date.now());
  const running = useRef<string | null>(null),
    identity = useRef(user?.id);
  identity.current = user?.id;
  const reload = useCallback(async () => {
    const uid = user?.id;
    if (!uid || running.current === uid) return;
    running.current = uid;
    L(true);
    const failures: AppContextValue["errors"] = {};
    try {
      const { data: account, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single();
      if (error) throw error;
      if (identity.current !== uid) return;
      const p = account as Profile;
      setMe(p);
      if (p.status !== "approved" || p.suspended) {
        setData({ ...blank, profiles: [p] });
        ER({});
        R(true);
        return;
      }
      try {
        const time = await rpc<string>("scanin_sync");
        const delta = Date.parse(time) - Date.now();
        if (!Number.isFinite(delta)) throw Error("Invalid server time");
        if (identity.current !== uid) return;
        O(delta);
        C(Date.now() + delta);
      } catch (e) {
        failures.sync =
          e instanceof Error ? e.message : "Unable to synchronize attendance";
      }
      const tables: TableName[] = [
        "profiles",
        "student_profiles",
        "events",
        "attendance",
        "event_audience",
        "system_settings",
        "requests",
        "notifications",
      ];
      if (p.role === "student") tables.push("saved_events");
      if (p.role === "administrator") tables.push("audit_log");
      const results = await Promise.allSettled(
        tables.map((name) => query(name)),
      );
      if (identity.current !== uid) return;
      const succeeded: Partial<DataState> = {};
      for (let i = 0; i < tables.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          Object.assign(succeeded, { [tables[i]]: result.value });
        } else
          failures[tables[i]] =
            result.reason instanceof Error
              ? result.reason.message
              : "Unable to load";
      }
      setData((previous) => ({
        ...previous,
        ...succeeded,
        profiles: succeeded.profiles || [p],
        ...(p.role !== "administrator" ? { audit_log: [] } : {}),
        ...(p.role !== "student" ? { saved_events: [] } : {}),
      }));
      const critical: TableName[] = [
        "events",
        "attendance",
        "event_audience",
        "student_profiles",
        "system_settings",
      ];
      R(!failures.sync && critical.every((name) => !failures[name]));
      ER(failures);
      U(new Date().toISOString());
    } catch (e) {
      if (identity.current === uid) {
        ER({
          profiles: e instanceof Error ? e.message : "Unable to load account",
        });
        R(false);
      }
    } finally {
      if (identity.current === uid) {
        running.current = null;
        L(false);
      }
    }
  }, [user?.id]);
  useEffect(() => {
    setData(blank);
    setMe(null);
    ER({});
    R(false);
    running.current = null;
    U("");
    void reload();
  }, [reload]);
  const live = useRealtime(
    `scanin-${user?.id || "guest"}`,
    reload,
    [
      "events",
      "attendance",
      "event_audience",
      "profiles",
      "student_profiles",
      "requests",
      "notifications",
      "saved_events",
      "system_settings",
    ],
    !!user,
  );
  useEffect(() => {
    const tick = setInterval(() => C(Date.now() + offset), 1000);
    const refresh = setInterval(() => {
      if (AppState.currentState === "active") void reload();
    }, 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void reload();
    });
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
      sub.remove();
    };
  }, [offset, reload]);
  const act = async <T,>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> => {
    const result = await rpc<T>(name, args);
    await reload();
    return result;
  };
  const failed = Object.keys(errors) as (TableName | "sync")[];
  const error = failed.length
    ? `Could not refresh ${failed.map((key) => labels[key]).join(", ")}. Check your connection and retry.`
    : "";
  return (
    <Context.Provider
      value={{
        ...data,
        me,
        loading,
        ready,
        error,
        errors,
        updated,
        now: clock,
        live,
        reload,
        act,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useData(): AppContextValue {
  const value = useContext(Context);
  if (!value) throw Error("Missing ScanIn provider");
  return value;
}
