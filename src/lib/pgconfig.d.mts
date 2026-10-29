// Types for pgconfig.mjs, which stays plain JavaScript so scripts/migrate.mjs can use it without a build step.
import type { PoolConfig } from 'pg';

export function pgConfig(url: string, extra?: Record<string, unknown>): PoolConfig;
export function directUrl(url: string): string;
export function neonRegion(url: string): string;
