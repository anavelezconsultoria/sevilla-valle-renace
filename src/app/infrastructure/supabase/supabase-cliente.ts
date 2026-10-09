import { inject, InjectionToken } from '@angular/core';
import { createClient, PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './supabase.config';
import { mensajeParaPersona } from './errores-base';

/** Cliente unico de Supabase para toda la app. */
export const SUPABASE_CLIENTE = new InjectionToken<SupabaseClient>('SUPABASE_CLIENTE', {
  providedIn: 'root',
  factory: () => {
    const { url, anonKey } = inject(SUPABASE_CONFIG);
    return createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  },
});

export interface RespuestaSupabase {
  readonly data: unknown;
  readonly error: PostgrestError | null;
}

/**
 * Convierte una respuesta de Supabase en el dato tipado o en un Error con el
 * mensaje de la base (las funciones ya devuelven mensajes en español para la persona).
 */
export function exigir<T>({ data, error }: RespuestaSupabase): T {
  if (error) throw new Error(mensajeParaPersona(error));
  return data as T;
}
