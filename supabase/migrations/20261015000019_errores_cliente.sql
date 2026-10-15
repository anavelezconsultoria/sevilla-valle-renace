-- =============================================================================
-- Registro de errores de la pagina (lo que falla en el celular de la gente).
-- Antes nos enterabamos por WhatsApp (el caso del iPhone viejo). Ahora la app
-- anota cada error UNA vez por firma (mensaje + ruta + version) y cuenta cuantas
-- veces se repite. Sin datos personales: solo mensaje tecnico, ruta sin
-- parametros, navegador y version. Nadie lo lee por la API salvo la coordinacion.
-- =============================================================================

create table if not exists public.errores_cliente (
  id uuid primary key default gen_random_uuid(),
  firma text not null unique,
  mensaje text not null check (char_length(mensaje) <= 500),
  pila text check (char_length(pila) <= 2000),
  ruta text not null default '' check (char_length(ruta) <= 200),
  navegador text not null default '' check (char_length(navegador) <= 300),
  version text not null default '' check (char_length(version) <= 60),
  veces int not null default 1,
  primera_vez timestamptz not null default now(),
  ultima_vez timestamptz not null default now()
);

create index if not exists errores_cliente_ultima_idx on public.errores_cliente (ultima_vez desc);

alter table public.errores_cliente enable row level security;
revoke all on public.errores_cliente from anon, authenticated;

/** Tope antiabuso: errores NUEVOS por hora. Los repetidos solo suman al contador. */
create or replace function public._tope_errores_por_hora() returns int language sql immutable as $$ select 300 $$;

create or replace function public.registrar_error_cliente(
  p_mensaje text, p_pila text, p_ruta text, p_navegador text, p_version text
) returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_mensaje text := left(coalesce(nullif(btrim(p_mensaje), ''), 'Error sin mensaje'), 500);
  v_ruta text := left(split_part(coalesce(p_ruta, ''), '?', 1), 200);
  v_version text := left(coalesce(p_version, ''), 60);
  v_firma text := md5(v_mensaje || '|' || v_ruta || '|' || v_version);
begin
  if not exists (select 1 from public.errores_cliente where firma = v_firma)
     and (select count(*) from public.errores_cliente where primera_vez > now() - interval '1 hour') >= public._tope_errores_por_hora() then
    return;
  end if;

  insert into public.errores_cliente (firma, mensaje, pila, ruta, navegador, version)
  values (v_firma, v_mensaje, left(p_pila, 2000), v_ruta, left(coalesce(p_navegador, ''), 300), v_version)
  on conflict (firma) do update
    set veces = public.errores_cliente.veces + 1,
        ultima_vez = now(),
        navegador = excluded.navegador;
end
$$;

/** Los 100 errores mas recientes, para la coordinacion. */
create or replace function public.errores_recientes()
returns table (
  mensaje text, ruta text, navegador text, version text, veces int, primera_vez timestamptz, ultima_vez timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public._exigir_coordinacion();
  return query
    select e.mensaje, e.ruta, e.navegador, e.version, e.veces, e.primera_vez, e.ultima_vez
      from public.errores_cliente e
     order by e.ultima_vez desc
     limit 100;
end
$$;

revoke execute on function public._tope_errores_por_hora() from public, anon, authenticated;
revoke execute on function public.registrar_error_cliente(text, text, text, text, text) from public;
revoke execute on function public.errores_recientes() from public, anon;
grant execute on function public.registrar_error_cliente(text, text, text, text, text) to anon, authenticated;
grant execute on function public.errores_recientes() to authenticated;
