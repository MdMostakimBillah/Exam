"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";

export interface QueryResult<T> {
  data: T | null;
  error: PostgrestError | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useSupabaseQuery<T>(
  table: string,
  options?: {
    columns?: string;
    filters?: Record<string, unknown>;
    order?: { column: string; ascending?: boolean };
    limit?: number;
    single?: boolean;
    enabled?: boolean;
  }
): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<PostgrestError | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (options?.enabled === false) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const supabase = createClient();
    let query = supabase.from(table).select(options?.columns || "*");

    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== undefined && value !== null && value !== "") {
          query = query.eq(key, value);
        }
      }
    }
    if (options?.order) {
      query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.single) {
      const { data: result, error: err } = await query.single();
      setData(result as T | null);
      setError(err);
    } else {
      const { data: result, error: err } = await query;
      setData(result as T | null);
      setError(err);
    }
    setLoading(false);
  }, [table, options?.columns, JSON.stringify(options?.filters), options?.order?.column, options?.order?.ascending, options?.limit, options?.single, options?.enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, error, loading, refetch: fetchData };
}

export function useSupabaseInsert<T>(table: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PostgrestError | null>(null);

  const insert = useCallback(async (row: Record<string, unknown>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.from(table).insert(row).select().single();
    setLoading(false);
    if (err) { setError(err); return null; }
    return data as T;
  }, [table]);

  return { insert, loading, error };
}

export function useSupabaseUpdate<T>(table: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PostgrestError | null>(null);

  const update = useCallback(async (id: string, row: Record<string, unknown>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error: err } = await supabase.from(table).update(row).eq("id", id).select().single();
    setLoading(false);
    if (err) { setError(err); return null; }
    return data as T;
  }, [table]);

  return { update, loading, error };
}

export function useSupabaseDelete(table: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PostgrestError | null>(null);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.from(table).delete().eq("id", id);
    setLoading(false);
    if (err) { setError(err); return false; }
    return true;
  }, [table]);

  return { remove, loading, error };
}
