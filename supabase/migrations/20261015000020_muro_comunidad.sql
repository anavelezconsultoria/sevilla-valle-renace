-- =============================================================================
-- Red social solidaria, primera parte: el muro de la comunidad.
--
-- El muro se arma solo con lo que ya pasa en la plataforma: entregas y
-- confirmaciones. Nunca muestra el nombre, el celular ni la direccion de la
-- familia: solo el sector (ya publico), la categoria y el alias de quien ayudo.
-- Cualquier persona puede dar "Gracias", una vez por dispositivo y publicacion.
-- =============================================================================

create table if not exists public.gracias (
  evento_id uuid not null references public.eventos_necesidad (id) on delete cascade,
  -- Identificador aleatorio que guarda el navegador (no es un dato personal).
  dispositivo text not null check (dispositivo ~ '^[A-Za-z0-9-]{16,64}$'),
  creado_en timestamptz not null default now(),
  primary key (evento_id, dispositivo)
);

create index if not exists gracias_dispositivo_idx on public.gracias (dispositivo, creado_en);

alter table public.gracias enable row level security;
revoke all on public.gracias from anon, authenticated;

/** Tope antiabuso: "Gracias" por dispositivo y por hora. */
create or replace function public._tope_gracias_por_hora() returns int language sql immutable as $$ select 60 $$;

/**
 * Publicaciones del muro, la mas reciente primero. Paginado por fecha:
 * p_antes = fecha de la ultima publicacion ya mostrada (null = las mas nuevas).
 */
create or replace function public.muro_comunidad(p_limite int default 20, p_antes timestamptz default null)
returns table (
  evento_id uuid, tipo text, ocurrido_en timestamptz, ayudante text,
  categoria public.categoria_necesidad, sector text, personas_hogar int,
  foto text, gracias bigint
)
language sql stable security definer
set search_path = ''
as $$
  select e.id,
         e.tipo::text,
         e.ocurrido_en,
         case when e.tipo = 'entregada' then e.actor_alias else (select p.alias from public.perfiles p where p.id = n.ayudante_id) end,
         n.categoria,
         n.sector,
         n.personas_hogar,
         (select ev.ruta from public.evidencias ev where ev.evento_id = e.id order by ev.creado_en limit 1),
         (select count(*) from public.gracias g where g.evento_id = e.id)
    from public.eventos_necesidad e
    join public.necesidades n on n.id = e.necesidad_id
   where e.tipo in ('entregada', 'confirmada')
     and n.estado in ('entregada', 'atendida')
     and (p_antes is null or e.ocurrido_en < p_antes)
   order by e.ocurrido_en desc
   limit least(greatest(coalesce(p_limite, 20), 1), 50)
$$;

/** Da "Gracias" a una publicacion. Devuelve el total de gracias de esa publicacion. */
create or replace function public.dar_gracias(p_evento uuid, p_dispositivo text)
returns bigint
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.eventos_necesidad e
      join public.necesidades n on n.id = e.necesidad_id
     where e.id = p_evento and e.tipo in ('entregada', 'confirmada') and n.estado in ('entregada', 'atendida')
  ) then
    raise exception 'Esta publicación ya no está disponible.' using errcode = 'P0001';
  end if;

  if (select count(*) from public.gracias where dispositivo = p_dispositivo and creado_en > now() - interval '1 hour')
     >= public._tope_gracias_por_hora() then
    raise exception 'Ya diste muchas gracias por ahora. Vuelve más tarde.' using errcode = 'P0001';
  end if;

  insert into public.gracias (evento_id, dispositivo) values (p_evento, p_dispositivo)
  on conflict do nothing;

  return (select count(*) from public.gracias where evento_id = p_evento);
end
$$;

revoke execute on function public._tope_gracias_por_hora() from public, anon, authenticated;
revoke execute on function public.muro_comunidad(int, timestamptz) from public;
revoke execute on function public.dar_gracias(uuid, text) from public;
grant execute on function public.muro_comunidad(int, timestamptz) to anon, authenticated;
grant execute on function public.dar_gracias(uuid, text) to anon, authenticated;
