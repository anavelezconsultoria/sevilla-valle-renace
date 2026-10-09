import { inject, Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { Ayudante, InicioSesionPayload, SesionGateway } from '../../core/ports/necesidades.ports';
import { exigir, SUPABASE_CLIENTE } from './supabase-cliente';
import { FilaPerfil } from './supabase-filas';

const CLAVE_ALIAS_PENDIENTE = 'sevilla-renace-alias-pendiente';
const RUTA_RETORNO = '/mis-atenciones';

/**
 * Sesion de quien ayuda con enlace al correo (sin contrasenas). El alias se
 * guarda mientras la persona abre el enlace y se convierte en su perfil publico.
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

  async iniciarSesion({ correo, alias }: InicioSesionPayload): Promise<'enlace_enviado'> {
    this.guardarAliasPendiente(alias.trim());
    const { error } = await this.cliente.auth.signInWithOtp({
      email: correo.trim(),
      options: { emailRedirectTo: `${location.origin}${RUTA_RETORNO}`, data: { alias: alias.trim() } },
    });
    if (error) throw new Error(this.mensajeAuth(error.message));
    return 'enlace_enviado';
  }

  async cerrarSesion(): Promise<void> {
    await this.cliente.auth.signOut();
    this.ayudante.set(null);
  }

  private async sincronizar(sesion: Session | null): Promise<void> {
    if (!sesion) {
      this.ayudante.set(null);
      return;
    }
    const perfil = await this.asegurarPerfil(sesion);
    this.ayudante.set({ id: perfil.id, alias: perfil.alias, correo: sesion.user.email ?? '' });
  }

  private async asegurarPerfil(sesion: Session): Promise<FilaPerfil> {
    const pendiente = this.leerAliasPendiente();
    const existente = await this.cliente.from('perfiles').select('id, alias').eq('id', sesion.user.id).maybeSingle();
    const perfil = exigir<FilaPerfil | null>(existente);
    if (perfil && !pendiente) return perfil;
    const alias = pendiente ?? this.aliasDeMetadatos(sesion) ?? sesion.user.email?.split('@')[0] ?? 'Ayudante';
    const creado = exigir<FilaPerfil>(await this.cliente.rpc('asegurar_perfil', { p_alias: alias }));
    this.guardarAliasPendiente(null);
    return creado;
  }

  private aliasDeMetadatos(sesion: Session): string | null {
    const alias = sesion.user.user_metadata['alias'];
    return typeof alias === 'string' && alias.length >= 2 ? alias : null;
  }

  private mensajeAuth(mensaje: string): string {
    return /rate limit|too many/i.test(mensaje)
      ? 'Se enviaron demasiados correos en poco tiempo. Espera unos minutos e inténtalo de nuevo.'
      : 'No pudimos enviarte el enlace. Revisa el correo e inténtalo de nuevo.';
  }

  private guardarAliasPendiente(alias: string | null): void {
    try {
      if (alias) localStorage.setItem(CLAVE_ALIAS_PENDIENTE, alias);
      else localStorage.removeItem(CLAVE_ALIAS_PENDIENTE);
    } catch {
      /* Sin almacenamiento: se usa el alias de los metadatos del usuario. */
    }
  }

  private leerAliasPendiente(): string | null {
    try {
      return localStorage.getItem(CLAVE_ALIAS_PENDIENTE);
    } catch {
      return null;
    }
  }
}
