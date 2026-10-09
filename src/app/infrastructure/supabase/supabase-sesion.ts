import { inject, Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { Ayudante, ErrorLimiteEnvios, InicioSesionPayload, SesionGateway } from '../../core/ports/necesidades.ports';
import { exigir, SUPABASE_CLIENTE } from './supabase-cliente';
import { FilaPerfil } from './supabase-filas';

const SEGUNDOS_ESPERA_LIMITE = 60;

/**
 * Sesion de quien ayuda SIN correo: Supabase Anonymous Sign-ins crea un usuario
 * al instante y la sesion queda guardada en el celular. El alias es publico; el
 * celular va a una tabla privada que solo lee la coordinacion.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseSesion implements SesionGateway {
  private readonly cliente = inject(SUPABASE_CLIENTE);
  readonly ayudante = signal<Ayudante | null>(null);

  constructor() {
    this.cliente.auth.onAuthStateChange((_evento, sesion) => {
      // Fuera del callback: Supabase recomienda no llamar a la API dentro de onAuthStateChange.
      setTimeout(() => void this.sincronizar(sesion), 0);
    });
  }

  async iniciarSesion({ alias, celular }: InicioSesionPayload): Promise<void> {
    await this.asegurarSesion();
    const perfil = exigir<FilaPerfil>(
      await this.cliente.rpc('asegurar_perfil', { p_alias: alias.trim(), p_celular: celular.replace(/\D/g, '') }),
    );
    this.ayudante.set({ id: perfil.id, alias: perfil.alias });
  }

  async cerrarSesion(): Promise<void> {
    await this.cliente.auth.signOut();
    this.ayudante.set(null);
  }

  /** Reutiliza la sesion guardada en el celular; si no hay, crea una anonima. */
  private async asegurarSesion(): Promise<void> {
    const { data } = await this.cliente.auth.getSession();
    if (data.session) return;
    const { error } = await this.cliente.auth.signInAnonymously();
    if (error) throw this.traducirError(error.status, error.message);
  }

  /** Al volver a abrir la app, recupera el perfil de la sesion guardada. */
  private async sincronizar(sesion: Session | null): Promise<void> {
    if (!sesion) {
      this.ayudante.set(null);
      return;
    }
    const perfil = exigir<FilaPerfil | null>(
      await this.cliente.from('perfiles').select('id, alias').eq('id', sesion.user.id).maybeSingle(),
    );
    this.ayudante.set(perfil ? { id: perfil.id, alias: perfil.alias } : null);
  }

  private traducirError(estado: number | undefined, mensaje: string): Error {
    if (estado === 429 || /rate limit|too many/i.test(mensaje)) return new ErrorLimiteEnvios(SEGUNDOS_ESPERA_LIMITE);
    if (/anonymous sign-ins are disabled/i.test(mensaje)) {
      return new Error('El acceso para voluntarios todavía no está habilitado. Avísale a la coordinación.');
    }
    return new Error('No pudimos identificarte. Revisa tu conexión e inténtalo de nuevo.');
  }
}
