import { InjectionToken } from '@angular/core';

export interface SupabaseConfig {
  readonly url: string;
  /** Llave publica (anon/publishable). Es publica por diseno: la seguridad la dan las politicas RLS. */
  readonly anonKey: string;
  readonly bucketEvidencias: string;
}

export const SUPABASE_CONFIG = new InjectionToken<SupabaseConfig>('SUPABASE_CONFIG');

export const CONFIG_SUPABASE: SupabaseConfig = {
  url: 'https://wabslvejumtvdpjxgsgx.supabase.co',
  anonKey: '',
  bucketEvidencias: 'evidencias',
};

/** Sin llave configurada, la app arranca en modo demostracion. */
export const supabaseConfigurado = (config: SupabaseConfig): boolean => config.anonKey.length > 0;
