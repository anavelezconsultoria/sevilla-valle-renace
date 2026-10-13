import { inject, Injectable, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';
import { Ayudante, ErrorClaveAyudante, ErrorLimiteEnvios, InicioSesionPayload, SesionGateway } from '../../core/ports/necesidades.ports';
import { exigir, SUPABASE_CLIENTE } from './supabase-cliente';
import { aAyudante, FilaPerfil } from './supabase-filas';

const SEGUNDOS_ESPERA_LIMITE = 60;
/** Violacion de llave foranea: el usuario de la sesion fue borrado. */
const CODIGO_USUARIO_INEXISTENTE = '23503';

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

  async iniciarSesion({ alias, celular, clave }: InicioSesionPayload): Promise<void> {
    await this.asegurarSesion();
    const argumentos = { p_alias: alias.trim(), p_celular: celular.replace(/\D/g, ''), p_clave: clave };
    let respuesta = await this.cliente.rpc('asegurar_perfil', argumentos);
    // La sesion guardada es de un usuario que ya no existe (perfiles unidos): se empieza una nueva.
    if (respuesta.error?.code === CODIGO_USUARIO_INEXISTENTE) {
      await this.cliente.auth.signOut({ scope: 'local' });
      await this.asegurarSesion();
      respuesta = await this.cliente.rpc('asegurar_perfil', argumentos);
    }
    const perfil = exigir<FilaPerfil | null>(respuesta);
    if (!perfil?.id) throw new ErrorClaveAyudante();
    this.ayudante.set(aAyudante(perfil));
  }

  async tengoClave(): Promise<boolean> {
    return exigir<boolean>(await this.cliente.rpc('tengo_clave_ayudante'));
  }

  async establecerClave(clave: string): Promise<void> {
    exigir<null>(await this.cliente.rpc('establecer_clave_ayudante', { p_clave: clave }));
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
      await this.cliente.from('perfiles').select('id, alias, rol').eq('id', sesion.user.id).maybeSingle(),
    );
    this.ayudante.set(perfil ? aAyudante(perfil) : null);
  }

  private traducirError(estado: number | undefined, mensaje: string): Error {
    if (estado === 429 || /rate limit|too many/i.test(mensaje)) return new ErrorLimiteEnvios(SEGUNDOS_ESPERA_LIMITE);
    if (/anonymous sign-ins are disabled/i.test(mensaje)) {
      return new Error('El acceso para voluntarios todavía no está habilitado. Avísale a la coordinación.');
    }
    return new Error('No pudimos identificarte. Revisa tu conexión e inténtalo de nuevo.');
  }
}
