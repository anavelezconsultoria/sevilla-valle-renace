-- =============================================================================
-- Sevilla Renace: esquema inicial
--
-- Principios:
--   1. El cliente NUNCA escribe tablas directamente. Toda escritura pasa por
--      funciones SECURITY DEFINER que aplican el ciclo de vida.
--   2. Los datos de contacto viven en una tabla sin politicas de lectura: solo
--      se obtienen con contacto_necesidad(), que exige ser el ayudante asignado.
--   3. El servidor genera el codigo de seguimiento y desplaza la ubicacion
--      publica; nada de eso se confia al navegador.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.estado_necesidad as enum ('registrada', 'en_atencion', 'entregada', 'atendida', 'cancelada');
create type public.cierre_atencion as enum ('confirmada', 'cerrada_automaticamente');
create type public.categoria_necesidad as enum (
  'alimentos', 'agua', 'techo', 'salud', 'medicamentos', 'ropa',
  'aseo', 'materiales', 'transporte', 'mascotas', 'otra'
);
create type public.urgencia_necesidad as enum ('alta', 'media', 'baja');
create type public.tipo_evento as enum (
  'registrada', 'tomada', 'liberada', 'liberada_por_vencimiento', 'entregada',
  'no_recibida', 'confirmada', 'cerrada_automaticamente', 'cancelada'
);

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  alias text not null check (char_length(btrim(alias)) between 2 and 40),
  rol text not null default 'ayudante' check (rol in ('ayudante', 'coordinacion')),
  creado_en timestamptz not null default now()
);

create table public.necesidades (
  id uuid primary key default gen_random_uuid(),
  categoria public.categoria_necesidad not null,
  titulo text not null check (char_length(btrim(titulo)) between 3 and 80),
  descripcion text not null check (char_length(btrim(descripcion)) between 15 and 600),
  urgencia public.urgencia_necesidad not null,
  personas_hogar int not null check (personas_hogar between 1 and 30),
  sector text not null check (char_length(btrim(sector)) between 2 and 80),
  -- Ubicacion PUBLICA: desplazada entre 150 y 300 m del punto real.
  lat_aprox double precision not null,
  lng_aprox double precision not null,
  estado public.estado_necesidad not null default 'registrada',
  cierre public.cierre_atencion,
  ayudante_id uuid references public.perfiles (id),
  registrada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  vence_en timestamptz,
  constraint cierre_solo_si_atendida check ((estado = 'atendida') = (cierre is not null)),
  constraint ayudante_si_en_curso check (estado not in ('en_atencion', 'entregada') or ayudante_id is not null)
);

create index necesidades_estado_idx on public.necesidades (estado, urgencia, registrada_en);
create index necesidades_ayudante_idx on public.necesidades (ayudante_id) where ayudante_id is not null;
create index necesidades_vence_idx on public.necesidades (vence_en) where vence_en is not null;

-- Datos privados: sin politicas de lectura. Solo funciones SECURITY DEFINER.
create table public.necesidades_privado (
  necesidad_id uuid primary key references public.necesidades (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 2 and 80),
  telefono text not null check (telefono ~ '^3[0-9]{9}$'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  referencias text not null default '' check (char_length(referencias) <= 200),
  codigo_hash text not null unique,
  autoriza_datos_en timestamptz not null default now()
);

create index necesidades_privado_telefono_idx on public.necesidades_privado (telefono);

-- Historial inmutable: solo se inserta desde las funciones.
create table public.eventos_necesidad (
  id uuid primary key default gen_random_uuid(),
  necesidad_id uuid not null references public.necesidades (id) on delete cascade,
  tipo public.tipo_evento not null,
  ocurrido_en timestamptz not null default now(),
  actor_id uuid references public.perfiles (id),
  actor_alias text not null,
  nota text check (char_length(nota) <= 400)
);

create index eventos_necesidad_idx on public.eventos_necesidad (necesidad_id, ocurrido_en);

create table public.evidencias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos_necesidad (id) on delete cascade,
  necesidad_id uuid not null references public.necesidades (id) on delete cascade,
  ruta text not null,
  creado_en timestamptz not null default now()
);

create index evidencias_evento_idx on public.evidencias (evento_id);

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila
-- ---------------------------------------------------------------------------
alter table public.perfiles enable row level security;
alter table public.necesidades enable row level security;
alter table public.necesidades_privado enable row level security;
alter table public.eventos_necesidad enable row level security;
alter table public.evidencias enable row level security;

create policy "lectura publica de perfiles" on public.perfiles for select to anon, authenticated using (true);
create policy "lectura publica de necesidades" on public.necesidades for select to anon, authenticated using (true);
create policy "lectura publica de eventos" on public.eventos_necesidad for select to anon, authenticated using (true);
create policy "lectura publica de evidencias" on public.evidencias for select to anon, authenticated using (true);
-- necesidades_privado: sin politicas = nadie la lee ni la escribe por la API.

-- Defensa en profundidad: solo lectura para los roles de la API, y nada sobre lo privado.
revoke all on public.perfiles, public.necesidades, public.necesidades_privado, public.eventos_necesidad, public.evidencias from anon, authenticated;
grant select on public.perfiles, public.necesidades, public.eventos_necesidad, public.evidencias to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reglas de negocio
-- ---------------------------------------------------------------------------
create or replace function public._horas_para_entregar() returns interval language sql immutable as $$ select interval '48 hours' $$;
create or replace function public._horas_para_confirmar() returns interval language sql immutable as $$ select interval '48 hours' $$;

create or replace function public._hash_codigo(p_codigo text)
returns text language sql immutable
set search_path = ''
as $$
  select encode(extensions.digest(upper(regexp_replace(p_codigo, '[^A-Za-z0-9]', '', 'g')), 'sha256'), 'hex')
$$;

-- Codigo legible XXXX-XXXX sin 0/O ni 1/I, generado con azar criptografico.
create or replace function public._generar_codigo()
returns text language plpgsql volatile
set search_path = ''
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  codigo text := '';
begin
  for i in 0..7 loop
    codigo := codigo || substr(alfabeto, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return substr(codigo, 1, 4) || '-' || substr(codigo, 5, 4);
end
$$;

-- Desplaza un punto entre 150 y 300 m en direccion aleatoria.
create or replace function public._desplazar(p_lat double precision, p_lng double precision, out lat double precision, out lng double precision)
language plpgsql volatile
set search_path = ''
as $$
declare
  distancia double precision := 150 + random() * 150;
  angulo double precision := random() * 2 * pi();
begin
  lat := p_lat + (distancia * cos(angulo)) / 111320;
  lng := p_lng + (distancia * sin(angulo)) / (111320 * cos(radians(p_lat)));
end
$$;

create or replace function public._registrar_evento(
  p_necesidad uuid, p_tipo public.tipo_evento, p_actor_id uuid, p_actor_alias text, p_nota text default null
) returns uuid
language sql volatile
set search_path = ''
as $$
  insert into public.eventos_necesidad (necesidad_id, tipo, actor_id, actor_alias, nota)
  values (p_necesidad, p_tipo, p_actor_id, p_actor_alias, nullif(btrim(p_nota), ''))
  returning id
$$;

create or replace function public._perfil_actual()
returns public.perfiles
language plpgsql stable
set search_path = ''
as $$
declare
  v_perfil public.perfiles;
begin
  select * into v_perfil from public.perfiles where id = auth.uid();
  if v_perfil.id is null then
    raise exception 'Debes identificarte para atender necesidades.' using errcode = '28000';
  end if;
  return v_perfil;
end
$$;

-- ---------------------------------------------------------------------------
-- API del solicitante (sin cuenta, por codigo)
-- ---------------------------------------------------------------------------
create or replace function public.registrar_necesidad(
  p_categoria public.categoria_necesidad,
  p_titulo text,
  p_descripcion text,
  p_urgencia public.urgencia_necesidad,
  p_personas_hogar int,
  p_sector text,
  p_lat double precision,
  p_lng double precision,
  p_nombre text,
  p_telefono text,
  p_referencias text default ''
) returns table (necesidad_id uuid, codigo text)
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_telefono text := regexp_replace(p_telefono, '[^0-9]', '', 'g');
  v_codigo text;
  v_id uuid;
  v_aprox record;
begin
  -- Freno al abuso: un mismo celular no puede tener mas de 3 necesidades activas.
  if (select count(*) from public.necesidades_privado pr
        join public.necesidades n on n.id = pr.necesidad_id
       where pr.telefono = v_telefono
         and n.estado in ('registrada', 'en_atencion', 'entregada')) >= 3 then
    raise exception 'Este celular ya tiene 3 necesidades activas.' using errcode = 'P0001';
  end if;

  select * into v_aprox from public._desplazar(p_lat, p_lng);

  insert into public.necesidades (categoria, titulo, descripcion, urgencia, personas_hogar, sector, lat_aprox, lng_aprox)
  values (p_categoria, btrim(p_titulo), btrim(p_descripcion), p_urgencia, p_personas_hogar, btrim(p_sector), v_aprox.lat, v_aprox.lng)
  returning id into v_id;

  -- Reintenta en el caso (astronomicamente raro) de un codigo repetido.
  loop
    v_codigo := public._generar_codigo();
    begin
      insert into public.necesidades_privado (necesidad_id, nombre, telefono, lat, lng, referencias, codigo_hash)
      values (v_id, btrim(p_nombre), v_telefono, p_lat, p_lng, coalesce(btrim(p_referencias), ''), public._hash_codigo(v_codigo));
      exit;
    exception when unique_violation then
      -- otro codigo
    end;
  end loop;

  perform public._registrar_evento(v_id, 'registrada', null, 'Solicitante');
  return query select v_id, v_codigo;
end
$$;

create or replace function public._necesidad_por_codigo(p_codigo text)
returns public.necesidades
language plpgsql stable
set search_path = ''
as $$
declare
  v_necesidad public.necesidades;
begin
  select n.* into v_necesidad
    from public.necesidades n
    join public.necesidades_privado pr on pr.necesidad_id = n.id
   where pr.codigo_hash = public._hash_codigo(p_codigo);
  if v_necesidad.id is null then
    raise exception 'No encontramos una necesidad con ese código.' using errcode = 'P0002';
  end if;
  return v_necesidad;
end
$$;

create or replace function public.consultar_por_codigo(p_codigo text)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select pr.necesidad_id from public.necesidades_privado pr where pr.codigo_hash = public._hash_codigo(p_codigo)
$$;

create or replace function public.confirmar_recibida(p_codigo text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_necesidad public.necesidades := public._necesidad_por_codigo(p_codigo);
begin
  update public.necesidades
     set estado = 'atendida', cierre = 'confirmada', vence_en = null, actualizada_en = now()
   where id = v_necesidad.id and estado = 'entregada';
  if not found then
    raise exception 'Esta acción ya no está disponible para esta necesidad.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(v_necesidad.id, 'confirmada', null, 'Solicitante');
  return v_necesidad.id;
end
$$;

create or replace function public.reportar_no_recibida(p_codigo text, p_nota text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_necesidad public.necesidades := public._necesidad_por_codigo(p_codigo);
begin
  update public.necesidades
     set estado = 'en_atencion', vence_en = now() + public._horas_para_entregar(), actualizada_en = now()
   where id = v_necesidad.id and estado = 'entregada';
  if not found then
    raise exception 'Esta acción ya no está disponible para esta necesidad.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(v_necesidad.id, 'no_recibida', null, 'Solicitante', left(p_nota, 400));
  return v_necesidad.id;
end
$$;

create or replace function public.cancelar_necesidad(p_codigo text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_necesidad public.necesidades := public._necesidad_por_codigo(p_codigo);
begin
  update public.necesidades
     set estado = 'cancelada', actualizada_en = now()
   where id = v_necesidad.id and estado = 'registrada';
  if not found then
    raise exception 'Esta acción ya no está disponible para esta necesidad.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(v_necesidad.id, 'cancelada', null, 'Solicitante');
  return v_necesidad.id;
end
$$;

-- ---------------------------------------------------------------------------
-- API del ayudante (con sesion)
-- ---------------------------------------------------------------------------
create or replace function public.asegurar_perfil(p_alias text)
returns public.perfiles
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles;
begin
  if auth.uid() is null then
    raise exception 'Debes identificarte.' using errcode = '28000';
  end if;
  insert into public.perfiles (id, alias) values (auth.uid(), btrim(p_alias))
  on conflict (id) do update set alias = excluded.alias
  returning * into v_perfil;
  return v_perfil;
end
$$;

create or replace function public.tomar_necesidad(p_necesidad uuid)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
begin
  -- Evita que una sola persona acapare: maximo 5 necesidades en curso.
  if (select count(*) from public.necesidades where ayudante_id = v_perfil.id and estado = 'en_atencion') >= 5 then
    raise exception 'Ya tienes 5 necesidades en curso. Entrega o libera alguna antes de tomar otra.' using errcode = 'P0001';
  end if;
  -- La condicion de estado hace la toma atomica: si dos personas intentan a la vez, solo una gana.
  update public.necesidades
     set estado = 'en_atencion', ayudante_id = v_perfil.id,
         vence_en = now() + public._horas_para_entregar(), actualizada_en = now()
   where id = p_necesidad and estado = 'registrada';
  if not found then
    raise exception 'Otra persona ya la tomó o cambió de estado.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(p_necesidad, 'tomada', v_perfil.id, v_perfil.alias);
  return p_necesidad;
end
$$;

create or replace function public.liberar_necesidad(p_necesidad uuid)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
begin
  update public.necesidades
     set estado = 'registrada', ayudante_id = null, vence_en = null, actualizada_en = now()
   where id = p_necesidad and estado = 'en_atencion' and ayudante_id = v_perfil.id;
  if not found then
    raise exception 'Esta necesidad la está atendiendo otra persona.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(p_necesidad, 'liberada', v_perfil.id, v_perfil.alias);
  return p_necesidad;
end
$$;

create or replace function public.entregar_necesidad(p_necesidad uuid, p_nota text, p_rutas text[] default '{}')
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
  v_evento uuid;
  v_ruta text;
begin
  if coalesce(array_length(p_rutas, 1), 0) > 3 then
    raise exception 'Máximo 3 fotos por entrega.' using errcode = 'P0001';
  end if;
  if char_length(btrim(coalesce(p_nota, ''))) < 3 then
    raise exception 'Cuéntanos qué entregaste.' using errcode = 'P0001';
  end if;
  update public.necesidades
     set estado = 'entregada', vence_en = now() + public._horas_para_confirmar(), actualizada_en = now()
   where id = p_necesidad and estado = 'en_atencion' and ayudante_id = v_perfil.id;
  if not found then
    raise exception 'Esta necesidad la está atendiendo otra persona.' using errcode = 'P0001';
  end if;
  v_evento := public._registrar_evento(p_necesidad, 'entregada', v_perfil.id, v_perfil.alias, left(p_nota, 400));
  foreach v_ruta in array coalesce(p_rutas, '{}') loop
    -- Solo se aceptan fotos subidas por el mismo ayudante a la carpeta de esta necesidad.
    if v_ruta not like v_perfil.id::text || '/' || p_necesidad::text || '/%' then
      raise exception 'Ruta de evidencia no válida.' using errcode = 'P0001';
    end if;
    insert into public.evidencias (evento_id, necesidad_id, ruta) values (v_evento, p_necesidad, v_ruta);
  end loop;
  return p_necesidad;
end
$$;

create or replace function public.contacto_necesidad(p_necesidad uuid)
returns table (nombre text, telefono text, lat double precision, lng double precision, referencias text)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
begin
  return query
    select pr.nombre, pr.telefono, pr.lat, pr.lng, pr.referencias
      from public.necesidades_privado pr
      join public.necesidades n on n.id = pr.necesidad_id
     where n.id = p_necesidad
       and n.estado in ('en_atencion', 'entregada')
       and (n.ayudante_id = v_perfil.id or v_perfil.rol = 'coordinacion');
  if not found then
    raise exception 'Solo quien atiende esta necesidad puede ver el contacto.' using errcode = '42501';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Vencimientos (los ejecuta pg_cron)
-- ---------------------------------------------------------------------------
create or replace function public.aplicar_vencimientos()
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in
    update public.necesidades
       set estado = 'registrada', ayudante_id = null, vence_en = null, actualizada_en = now()
     where estado = 'en_atencion' and vence_en <= now()
    returning id
  loop
    perform public._registrar_evento(v_id, 'liberada_por_vencimiento', null, 'Sistema');
  end loop;

  for v_id in
    update public.necesidades
       set estado = 'atendida', cierre = 'cerrada_automaticamente', vence_en = null, actualizada_en = now()
     where estado = 'entregada' and vence_en <= now()
    returning id
  loop
    perform public._registrar_evento(v_id, 'cerrada_automaticamente', null, 'Sistema');
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecucion: solo la API publica, nunca los ayudantes internos
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.registrar_necesidad(public.categoria_necesidad, text, text, public.urgencia_necesidad, int, text, double precision, double precision, text, text, text) to anon, authenticated;
grant execute on function public.consultar_por_codigo(text) to anon, authenticated;
grant execute on function public.confirmar_recibida(text) to anon, authenticated;
grant execute on function public.reportar_no_recibida(text, text) to anon, authenticated;
grant execute on function public.cancelar_necesidad(text) to anon, authenticated;
grant execute on function public.asegurar_perfil(text) to authenticated;
grant execute on function public.tomar_necesidad(uuid) to authenticated;
grant execute on function public.liberar_necesidad(uuid) to authenticated;
grant execute on function public.entregar_necesidad(uuid, text, text[]) to authenticated;
grant execute on function public.contacto_necesidad(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: fotos de evidencia (lectura publica, escritura solo en la carpeta propia)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias', 'evidencias', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "ayudantes suben evidencias en su carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidencias' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- ---------------------------------------------------------------------------
-- Cron: vencimientos cada 10 minutos
-- ---------------------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('sevilla-renace-vencimientos', '*/10 * * * *', $$select public.aplicar_vencimientos()$$);
