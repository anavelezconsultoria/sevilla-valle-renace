-- =============================================================================
-- Fotos y video al pedir ayuda (opcional).
--  - Fotos: publicas (ayudan a que la gente done). El celular las re-codifica,
--    asi que no llevan ubicacion GPS.
--  - Video: PRIVADO. Los videos de celular guardan la ubicacion exacta en sus
--    metadatos y el navegador no puede borrarla: solo lo ven quien atiende la
--    necesidad y la coordinacion.
--  - Contra abuso: solo se sube a una necesidad recien registrada (1 hora),
--    maximo 3 fotos y 1 video, con tamanio y tipo limitados por el bucket.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('solicitudes', 'solicitudes', true, 2097152, array['image/jpeg']),
       ('solicitudes-video', 'solicitudes-video', false, 26214400, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do nothing;

create table public.adjuntos_solicitud (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades (id) on delete cascade,
  tipo text not null check (tipo in ('foto', 'video')),
  ruta text not null unique,
  creado_en timestamptz not null default now()
);
create index adjuntos_solicitud_necesidad_idx on public.adjuntos_solicitud (necesidad_id);

alter table public.adjuntos_solicitud enable row level security;
revoke all on public.adjuntos_solicitud from anon, authenticated;
grant select on public.adjuntos_solicitud to anon, authenticated;
-- Solo las fotos son publicas; que exista un video tampoco se expone.
create policy "fotos de solicitudes publicas" on public.adjuntos_solicitud
  for select to anon, authenticated using (tipo = 'foto');

create or replace function public._limite_adjuntos(p_tipo text) returns int language sql immutable
as $$ select case p_tipo when 'foto' then 3 else 1 end $$;

/** La ruta es <necesidad_id>/<archivo>: devuelve el id si es valido, o null. */
create or replace function public._necesidad_de_ruta(p_ruta text)
returns uuid language plpgsql immutable
set search_path = ''
as $$
declare
  v_carpeta text := split_part(coalesce(p_ruta, ''), '/', 1);
begin
  if v_carpeta !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  if split_part(p_ruta, '/', 3) <> '' or split_part(p_ruta, '/', 2) = '' then
    return null;
  end if;
  return v_carpeta::uuid;
end
$$;

/** Se puede subir: necesidad recien registrada, esperando ayuda, y sin pasar el limite. */
create or replace function public._puede_adjuntar(p_bucket text, p_ruta text)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_necesidad uuid := public._necesidad_de_ruta(p_ruta);
  v_tipo text := case p_bucket when 'solicitudes' then 'foto' when 'solicitudes-video' then 'video' end;
begin
  if v_necesidad is null or v_tipo is null then
    return false;
  end if;
  if not exists (
    select 1 from public.necesidades
     where id = v_necesidad and estado = 'registrada' and registrada_en > now() - interval '1 hour'
  ) then
    return false;
  end if;
  return (select count(*) from storage.objects o
           where o.bucket_id = p_bucket and public._necesidad_de_ruta(o.name) = v_necesidad) < public._limite_adjuntos(v_tipo);
end
$$;

/** Ve el video: quien atiende la necesidad o la coordinacion. */
create or replace function public._puede_ver_video(p_ruta text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.necesidades n
     where n.id = public._necesidad_de_ruta(p_ruta)
       and (n.ayudante_id = auth.uid()
            or exists (select 1 from public.perfiles p where p.id = auth.uid() and p.rol = 'coordinacion'))
  )
$$;

create policy "subir fotos al pedir ayuda" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'solicitudes' and public._puede_adjuntar(bucket_id, name));

create policy "subir video al pedir ayuda" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'solicitudes-video' and public._puede_adjuntar(bucket_id, name));

create policy "ver video solo quien atiende o coordinacion" on storage.objects
  for select to authenticated
  using (bucket_id = 'solicitudes-video' and public._puede_ver_video(name));

/**
 * Registra los archivos ya subidos. Solo el celular que registro la necesidad
 * (tiene su llave interna) puede hacerlo. Ignora rutas que no existan.
 */
create or replace function public.registrar_adjuntos(p_codigo text, p_fotos text[], p_video text default null)
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_necesidad public.necesidades := public._necesidad_por_codigo(p_codigo);
  v_ruta text;
  v_total int := 0;
begin
  foreach v_ruta in array coalesce(p_fotos, '{}') loop
    if public._necesidad_de_ruta(v_ruta) = v_necesidad.id
       and exists (select 1 from storage.objects where bucket_id = 'solicitudes' and name = v_ruta) then
      insert into public.adjuntos_solicitud (necesidad_id, tipo, ruta) values (v_necesidad.id, 'foto', v_ruta)
      on conflict (ruta) do nothing;
      v_total := v_total + 1;
    end if;
  end loop;
  if p_video is not null
     and public._necesidad_de_ruta(p_video) = v_necesidad.id
     and exists (select 1 from storage.objects where bucket_id = 'solicitudes-video' and name = p_video) then
    insert into public.adjuntos_solicitud (necesidad_id, tipo, ruta) values (v_necesidad.id, 'video', p_video)
    on conflict (ruta) do nothing;
    v_total := v_total + 1;
  end if;
  return v_total;
end
$$;

/** Ruta del video para quien atiende o coordinacion; null si no hay o no puede verlo. */
create or replace function public.video_solicitud(p_necesidad uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select a.ruta from public.adjuntos_solicitud a
   where a.necesidad_id = p_necesidad and a.tipo = 'video' and public._puede_ver_video(a.ruta)
   limit 1
$$;

revoke execute on function public._limite_adjuntos(text) from public, anon, authenticated;
revoke execute on function public._necesidad_de_ruta(text) from public;
revoke execute on function public._puede_adjuntar(text, text) from public;
revoke execute on function public._puede_ver_video(text) from public;
-- Las politicas de Storage se evaluan con el rol de quien sube: necesitan ejecutar estas.
grant execute on function public._necesidad_de_ruta(text) to anon, authenticated;
grant execute on function public._puede_adjuntar(text, text) to anon, authenticated;
grant execute on function public._puede_ver_video(text) to authenticated;
revoke execute on function public.registrar_adjuntos(text, text[], text) from public;
grant execute on function public.registrar_adjuntos(text, text[], text) to anon, authenticated;
revoke execute on function public.video_solicitud(uuid) from public, anon;
grant execute on function public.video_solicitud(uuid) to authenticated;
