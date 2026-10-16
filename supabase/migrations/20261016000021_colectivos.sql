-- =============================================================================
-- Colectivos: entregar a nombre de un grupo (Baltimore-Maryland, una parroquia,
-- los Scouts) sin que ese grupo tenga celular propio. La coordinacion crea el
-- colectivo y queda como su administradora. Al actuar, la app envia el
-- encabezado x-sr-a-nombre-de con el id del colectivo; _perfil_actual() lo
-- acepta SOLO si quien inicio sesion administra ese colectivo. Asi todas las
-- acciones (tomar, entregar, liberar, pedir mas tiempo, ver contacto) funcionan
-- igual y quedan registradas a nombre del colectivo.
-- =============================================================================

create table if not exists public.colectivos (
  perfil_id uuid primary key references public.perfiles (id) on delete cascade,
  administrador_id uuid not null references public.perfiles (id) on delete cascade,
  creado_en timestamptz not null default now()
);

create index if not exists colectivos_administrador_idx on public.colectivos (administrador_id);

alter table public.colectivos enable row level security;
revoke all on public.colectivos from anon, authenticated;

/** Id del colectivo pedido en el encabezado x-sr-a-nombre-de, o null. */
create or replace function public._a_nombre_de()
returns uuid language plpgsql stable
set search_path = ''
as $$
declare
  v_texto text := nullif(btrim(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-sr-a-nombre-de'), '');
begin
  if v_texto is null then
    return null;
  end if;
  return v_texto::uuid;
exception when invalid_text_representation then
  raise exception 'Colectivo no válido.' using errcode = '22P02';
end
$$;

-- Perfil con el que se actua: el propio, o el colectivo que administra.
create or replace function public._perfil_actual()
returns public.perfiles
language plpgsql stable
set search_path = ''
as $$
declare
  v_perfil public.perfiles;
  v_colectivo uuid := public._a_nombre_de();
begin
  select * into v_perfil from public.perfiles where id = auth.uid();
  if v_perfil.id is null then
    raise exception 'Debes identificarte para atender necesidades.' using errcode = '28000';
  end if;
  if v_colectivo is null or v_colectivo = v_perfil.id then
    return v_perfil;
  end if;
  if not exists (select 1 from public.colectivos c where c.perfil_id = v_colectivo and c.administrador_id = v_perfil.id) then
    raise exception 'No puedes actuar a nombre de ese colectivo.' using errcode = '42501';
  end if;
  select * into v_perfil from public.perfiles where id = v_colectivo;
  return v_perfil;
end
$$;

/** La coordinacion crea un colectivo y queda como su administradora. Devuelve su id. */
create or replace function public.crear_colectivo(p_alias text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_admin public.perfiles;
  v_alias text := btrim(coalesce(p_alias, ''));
  v_id uuid := gen_random_uuid();
begin
  if public._a_nombre_de() is not null then
    raise exception 'Crea el colectivo desde tu propio perfil.' using errcode = '42501';
  end if;
  v_admin := public._exigir_coordinacion();
  if char_length(v_alias) not between 2 and 40 then
    raise exception 'El nombre del colectivo debe tener entre 2 y 40 letras.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.perfiles p where lower(btrim(p.alias)) = lower(v_alias)) then
    raise exception 'Ya existe alguien con ese nombre. Elige otro.' using errcode = 'P0001';
  end if;
  -- Usuario interno sin correo ni clave: nadie puede iniciar sesion como el colectivo.
  insert into auth.users (id, aud, role, is_anonymous) values (v_id, 'authenticated', 'authenticated', true);
  insert into public.perfiles (id, alias, rol) values (v_id, v_alias, 'ayudante');
  insert into public.colectivos (perfil_id, administrador_id) values (v_id, v_admin.id);
  return v_id;
end
$$;

/** Colectivos que administra quien inicio sesion (sin importar a nombre de quien actua). */
create or replace function public.mis_colectivos()
returns table (id uuid, alias text)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.alias
    from public.colectivos c
    join public.perfiles p on p.id = c.perfil_id
   where c.administrador_id = auth.uid()
   order by p.alias
$$;

-- Fotos de entrega: tambien en la carpeta de un colectivo que se administra.
drop policy if exists "ayudantes suben evidencias en su carpeta" on storage.objects;
create policy "ayudantes suben evidencias en su carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidencias'
    and (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      or exists (
        select 1 from public.colectivos c
         where c.perfil_id::text = (storage.foldername(name))[1]
           and c.administrador_id = (select auth.uid())
      )
    )
  );

-- Soporte: para un colectivo, el celular es el de quien lo administra.
create or replace function public.atenciones_en_curso()
returns table (
  necesidad_id uuid, titulo text, categoria public.categoria_necesidad, sector text,
  prioridad_cero boolean, tomada_en timestamptz, vence_en timestamptz,
  ayudante_alias text, ayudante_celular text
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public._exigir_coordinacion();
  return query
    select n.id, n.titulo, n.categoria, n.sector, n.prioridad_cero,
           (select max(e.ocurrido_en) from public.eventos_necesidad e where e.necesidad_id = n.id and e.tipo = 'tomada'),
           n.vence_en, p.alias, coalesce(pp.celular, pa.celular)
      from public.necesidades n
      join public.perfiles p on p.id = n.ayudante_id
      left join public.perfiles_privado pp on pp.id = p.id
      left join public.colectivos c on c.perfil_id = p.id
      left join public.perfiles_privado pa on pa.id = c.administrador_id
     where n.estado = 'en_atencion'
     order by n.vence_en nulls last;
end
$$;

revoke execute on function public._a_nombre_de() from public, anon, authenticated;
revoke execute on function public.crear_colectivo(text) from public, anon;
revoke execute on function public.mis_colectivos() from public, anon;
grant execute on function public.crear_colectivo(text) to authenticated;
grant execute on function public.mis_colectivos() to authenticated;
