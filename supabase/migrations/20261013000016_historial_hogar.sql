-- =============================================================================
-- Repartir mejor la ayuda sin exponer a las familias.
--
-- 1. Revision: si un celular pide otra vez la misma categoria teniendo una sin
--    cerrar, la recibio hace menos de 15 dias, o recibio 2+ ayudas en 7 dias,
--    la solicitud entra 'en_revision' (no se publica) hasta que la coordinacion
--    la aprueba o la rechaza. No se bloquea: una emergencia puede cambiar.
-- 2. Senal publica neutra, sin nombres: primera_solicitud y la categoria de la
--    ayuda mas reciente que recibio ese hogar en los ultimos 7 dias.
-- 3. Historial privado por celular para la coordinacion (solicitudes, hogares
--    parecidos por nombre + sector, y su actividad como ayudante).
-- 4. Reconocimiento publico: alias de quienes ayudan y cuantas entregas llevan.
-- Requiere 0015 (valores de enum) ya aplicada en otra transaccion.
-- =============================================================================

alter table public.necesidades add column if not exists primera_solicitud boolean not null default false;
alter table public.necesidades add column if not exists ayuda_reciente_categoria public.categoria_necesidad;
alter table public.necesidades_privado add column if not exists motivo_revision text check (char_length(motivo_revision) <= 200);

create index if not exists necesidades_revision_idx on public.necesidades (registrada_en) where estado = 'en_revision';
create index if not exists eventos_actor_tipo_idx on public.eventos_necesidad (actor_id, tipo) where actor_id is not null;

create or replace function public._ventana_ayuda_reciente() returns interval language sql immutable as $$ select interval '7 days' $$;
create or replace function public._ventana_misma_categoria() returns interval language sql immutable as $$ select interval '15 days' $$;

/** Ayudas que ya llegaron a un celular: necesidades con entrega registrada. */
create or replace function public._ayudas_recibidas(p_telefono text)
returns table (necesidad_id uuid, categoria public.categoria_necesidad, entregada_en timestamptz)
language sql stable
set search_path = ''
as $$
  select n.id, n.categoria, max(e.ocurrido_en)
    from public.necesidades_privado pr
    join public.necesidades n on n.id = pr.necesidad_id
    join public.eventos_necesidad e on e.necesidad_id = n.id and e.tipo = 'entregada'
   where pr.telefono = p_telefono
     and n.estado in ('entregada', 'atendida')
   group by n.id, n.categoria
$$;

create or replace function public._nombre_categoria(p_categoria public.categoria_necesidad)
returns text language sql immutable
set search_path = ''
as $$
  select case p_categoria
    when 'alimentos' then 'alimentos' when 'agua' then 'agua' when 'techo' then 'techo o albergue'
    when 'salud' then 'salud' when 'medicamentos' then 'medicamentos' when 'ropa' then 'ropa o cobijas'
    when 'aseo' then 'aseo' when 'materiales' then 'materiales' when 'transporte' then 'transporte'
    when 'mascotas' then 'ayuda para mascotas' else 'otra ayuda' end
$$;

/** Por que una solicitud nueva debe revisarse, o NULL si se publica directo. */
create or replace function public._motivo_revision(p_telefono text, p_categoria public.categoria_necesidad)
returns text language plpgsql stable
set search_path = ''
as $$
declare
  v_dias int;
  v_recientes int;
begin
  if exists (
    select 1 from public.necesidades_privado pr
      join public.necesidades n on n.id = pr.necesidad_id
     where pr.telefono = p_telefono and n.categoria = p_categoria
       and n.estado in ('registrada', 'en_revision', 'en_atencion', 'entregada')
  ) then
    return 'Ya tiene otra solicitud de ' || public._nombre_categoria(p_categoria) || ' sin cerrar.';
  end if;

  select extract(day from now() - max(a.entregada_en))::int into v_dias
    from public._ayudas_recibidas(p_telefono) a
   where a.categoria = p_categoria and a.entregada_en > now() - public._ventana_misma_categoria();
  if v_dias is not null then
    return 'Recibió ' || public._nombre_categoria(p_categoria) || ' hace '
      || case when v_dias = 0 then 'menos de un día' when v_dias = 1 then '1 día' else v_dias || ' días' end || '.';
  end if;

  select count(*) into v_recientes
    from public._ayudas_recibidas(p_telefono) a
   where a.entregada_en > now() - public._ventana_ayuda_reciente();
  if v_recientes >= 2 then
    return 'Recibió ' || v_recientes || ' ayudas en los últimos 7 días.';
  end if;
  return null;
end
$$;

/** Categoria de la ayuda mas reciente que recibio el hogar en 7 dias (senal publica). */
create or replace function public._ayuda_reciente(p_telefono text)
returns public.categoria_necesidad language sql stable
set search_path = ''
as $$
  select a.categoria from public._ayudas_recibidas(p_telefono) a
   where a.entregada_en > now() - public._ventana_ayuda_reciente()
   order by a.entregada_en desc
   limit 1
$$;

-- Registro: misma funcion de 0009 + revision, senal publica y 'en_revision' en los conteos.
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
  p_clave text,
  p_referencias text default '',
  p_prioridad_cero boolean default false
) returns table (necesidad_id uuid, codigo text)
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_telefono text := public._normalizar_telefono(p_telefono);
  v_codigo text;
  v_id uuid;
  v_aprox record;
  v_acceso public.accesos_solicitante;
  v_motivo text;
  v_primera boolean;
begin
  perform public._validar_clave(p_clave);
  if right(v_telefono, 4) = p_clave then
    raise exception 'La clave no puede ser el final de tu celular. Elige otra.' using errcode = 'P0001';
  end if;

  -- Si el celular ya tiene clave, debe ser la misma. Un fallo NO lanza excepcion
  -- (desharia el conteo de intentos): devuelve una fila con necesidad_id nulo.
  if exists (select 1 from public.necesidades_privado pr where pr.telefono = v_telefono and pr.clave_hash is not null) then
    select * into v_acceso from public.accesos_solicitante where telefono = v_telefono;
    if v_acceso.bloqueado_hasta is not null and v_acceso.bloqueado_hasta > now() then
      raise exception 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.' using errcode = 'P0003';
    end if;
    if not exists (
      select 1 from public.necesidades_privado pr
       where pr.telefono = v_telefono and pr.clave_hash = extensions.crypt(p_clave, pr.clave_hash)
    ) then
      insert into public.accesos_solicitante (telefono, fallidos) values (v_telefono, 1)
      on conflict (telefono) do update
        set fallidos = case when public.accesos_solicitante.fallidos >= 5 then 1 else public.accesos_solicitante.fallidos + 1 end,
            bloqueado_hasta = case when public.accesos_solicitante.fallidos + 1 = 5 then now() + interval '15 minutes' end;
      return query select null::uuid, 'clave_no_coincide'::text;
      return;
    end if;
    delete from public.accesos_solicitante where telefono = v_telefono;
  end if;

  -- La misma solicitud otra vez en pocos minutos: es un toque repetido, no una necesidad nueva.
  if exists (
    select 1 from public.necesidades_privado pr
      join public.necesidades n on n.id = pr.necesidad_id
     where pr.telefono = v_telefono
       and n.estado in ('registrada', 'en_revision', 'en_atencion', 'entregada')
       and lower(btrim(n.titulo)) = lower(btrim(p_titulo))
       and lower(btrim(n.descripcion)) = lower(btrim(p_descripcion))
       and n.registrada_en > now() - public._ventana_duplicados()
  ) then
    raise exception 'Esta necesidad ya quedó registrada hace unos minutos. Mírala en "Mis solicitudes".' using errcode = 'P0001';
  end if;

  if (select count(*) from public.necesidades_privado pr
        join public.necesidades n on n.id = pr.necesidad_id
       where pr.telefono = v_telefono
         and n.estado in ('registrada', 'en_revision', 'en_atencion', 'entregada')) >= 3 then
    raise exception 'Este celular ya tiene 3 necesidades activas.' using errcode = 'P0001';
  end if;

  v_motivo := public._motivo_revision(v_telefono, p_categoria);
  v_primera := not exists (
    select 1 from public.necesidades_privado pr
      join public.necesidades n on n.id = pr.necesidad_id
     where pr.telefono = v_telefono and n.estado <> 'cancelada'
  );

  select * into v_aprox from public._desplazar(p_lat, p_lng);

  insert into public.necesidades (
    categoria, titulo, descripcion, urgencia, personas_hogar, sector, lat_aprox, lng_aprox,
    prioridad_cero, estado, primera_solicitud, ayuda_reciente_categoria
  )
  values (
    p_categoria, btrim(p_titulo), btrim(p_descripcion), p_urgencia, p_personas_hogar, btrim(p_sector), v_aprox.lat, v_aprox.lng,
    coalesce(p_prioridad_cero, false),
    case when v_motivo is null then 'registrada' else 'en_revision' end::public.estado_necesidad,
    v_primera,
    public._ayuda_reciente(v_telefono)
  )
  returning id into v_id;

  loop
    v_codigo := public._generar_codigo();
    begin
      insert into public.necesidades_privado (necesidad_id, nombre, telefono, lat, lng, referencias, codigo_hash, clave_hash, motivo_revision)
      values (v_id, btrim(p_nombre), v_telefono, p_lat, p_lng, coalesce(btrim(p_referencias), ''),
              public._hash_codigo(v_codigo), extensions.crypt(p_clave, extensions.gen_salt('bf', 8)), v_motivo);
      exit;
    exception when unique_violation then
      -- otro codigo
    end;
  end loop;

  perform public._registrar_evento(v_id, 'registrada', null, 'Solicitante');
  if v_motivo is not null then
    -- El motivo NO va en el evento: los eventos son publicos.
    perform public._registrar_evento(v_id, 'en_revision', null, 'Sevilla Renace');
  end if;
  return query select v_id, v_codigo;
end
$$;

-- Quien la pidio puede cancelarla tambien mientras esta en revision.
create or replace function public._cancelar(p_necesidad uuid)
returns uuid language plpgsql volatile
set search_path = ''
as $$
begin
  update public.necesidades
     set estado = 'cancelada', actualizada_en = now()
   where id = p_necesidad and estado in ('registrada', 'en_revision');
  if not found then
    raise exception 'Esta acción ya no está disponible para esta necesidad.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(p_necesidad, 'cancelada', null, 'Solicitante');
  return p_necesidad;
end
$$;

-- Las fotos se suben justo despues de registrar, aunque quede en revision.
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
     where id = v_necesidad and estado in ('registrada', 'en_revision') and registrada_en > now() - interval '1 hour'
  ) then
    return false;
  end if;
  return (select count(*) from storage.objects o
           where o.bucket_id = p_bucket and public._necesidad_de_ruta(o.name) = v_necesidad) < public._limite_adjuntos(v_tipo);
end
$$;

-- ---------------------------------------------------------------------------
-- Coordinacion
-- ---------------------------------------------------------------------------
create or replace function public._exigir_coordinacion()
returns public.perfiles language plpgsql stable
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._perfil_actual();
begin
  if v_perfil.rol <> 'coordinacion' then
    raise exception 'Solo la coordinación puede ver esto.' using errcode = '42501';
  end if;
  return v_perfil;
end
$$;

/** Solicitudes que esperan la revision de la coordinacion, la mas antigua primero. */
create or replace function public.solicitudes_en_revision()
returns table (
  necesidad_id uuid, titulo text, categoria public.categoria_necesidad, sector text,
  registrada_en timestamptz, nombre text, telefono text, motivo text
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public._exigir_coordinacion();
  return query
    select n.id, n.titulo, n.categoria, n.sector, n.registrada_en, pr.nombre, pr.telefono, coalesce(pr.motivo_revision, '')
      from public.necesidades n
      join public.necesidades_privado pr on pr.necesidad_id = n.id
     where n.estado = 'en_revision'
     order by n.registrada_en;
end
$$;

/** Aprobar la publica (vuelve a 'registrada'); rechazar la cancela. */
create or replace function public.revisar_necesidad(p_necesidad uuid, p_aprobar boolean)
returns uuid language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_perfil public.perfiles := public._exigir_coordinacion();
begin
  update public.necesidades
     set estado = case when p_aprobar then 'registrada' else 'cancelada' end::public.estado_necesidad,
         actualizada_en = now()
   where id = p_necesidad and estado = 'en_revision';
  if not found then
    raise exception 'Esta solicitud ya no está en revisión.' using errcode = 'P0001';
  end if;
  perform public._registrar_evento(
    p_necesidad,
    case when p_aprobar then 'revision_aprobada' else 'revision_rechazada' end::public.tipo_evento,
    v_perfil.id, 'Coordinación'
  );
  return p_necesidad;
end
$$;

/**
 * Historial privado de un celular: sus solicitudes, otros celulares con el mismo
 * nombre en el mismo sector (posible mismo hogar) y su actividad como ayudante.
 */
create or replace function public.historial_celular(p_telefono text)
returns jsonb language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_telefono text := public._normalizar_telefono(p_telefono);
begin
  perform public._exigir_coordinacion();
  return jsonb_build_object(
    'solicitudes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', n.id, 'titulo', n.titulo, 'categoria', n.categoria, 'estado', n.estado, 'cierre', n.cierre,
               'nombre', pr.nombre, 'sector', n.sector, 'registrada_en', n.registrada_en,
               'entregada_en', (select max(e.ocurrido_en) from public.eventos_necesidad e where e.necesidad_id = n.id and e.tipo = 'entregada'),
               'ayudante', (select p.alias from public.perfiles p where p.id = n.ayudante_id),
               'motivo_revision', pr.motivo_revision
             ) order by n.registrada_en desc)
        from public.necesidades_privado pr
        join public.necesidades n on n.id = pr.necesidad_id
       where pr.telefono = v_telefono
    ), '[]'::jsonb),
    'parecidas', coalesce((
      select jsonb_agg(jsonb_build_object('telefono', x.telefono, 'nombre', x.nombre, 'sector', x.sector, 'solicitudes', x.total))
        from (
          select pr2.telefono, min(pr2.nombre) as nombre, min(n2.sector) as sector, count(*) as total
            from public.necesidades_privado pr2
            join public.necesidades n2 on n2.id = pr2.necesidad_id
           where pr2.telefono <> v_telefono
             and exists (
               select 1 from public.necesidades_privado pr
                 join public.necesidades n on n.id = pr.necesidad_id
                where pr.telefono = v_telefono
                  and lower(btrim(pr.nombre)) = lower(btrim(pr2.nombre))
                  and lower(btrim(n.sector)) = lower(btrim(n2.sector))
             )
           group by pr2.telefono
        ) x
    ), '[]'::jsonb),
    'ayudante', (
      select jsonb_build_object(
               'alias', p.alias,
               'tomadas', (select count(*) from public.eventos_necesidad e where e.actor_id = p.id and e.tipo = 'tomada'),
               'entregas', (select count(*) from public.eventos_necesidad e where e.actor_id = p.id and e.tipo = 'entregada'),
               'liberadas', (select count(*) from public.eventos_necesidad e where e.actor_id = p.id and e.tipo = 'liberada'),
               -- Vencidas: el sistema las libera; se atribuyen a quien la tomo por ultima vez antes.
               'vencidas', (
                 select count(*) from public.eventos_necesidad v
                  where v.tipo = 'liberada_por_vencimiento'
                    and (select t.actor_id from public.eventos_necesidad t
                          where t.necesidad_id = v.necesidad_id and t.tipo = 'tomada' and t.ocurrido_en <= v.ocurrido_en
                          order by t.ocurrido_en desc limit 1) = p.id
               )
             )
        from public.perfiles_privado pp
        join public.perfiles p on p.id = pp.id
       where pp.celular = v_telefono
       order by pp.actualizado_en desc
       limit 1
    )
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Reconocimiento publico: solo alias (ya publico) y conteos.
-- ---------------------------------------------------------------------------
create or replace function public.vecinos_que_ayudan()
returns table (alias text, entregas bigint, ultima_entrega timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select p.alias, count(distinct e.necesidad_id), max(e.ocurrido_en)
    from public.eventos_necesidad e
    join public.necesidades n on n.id = e.necesidad_id and n.estado in ('entregada', 'atendida')
    join public.perfiles p on p.id = e.actor_id
   where e.tipo = 'entregada'
   group by p.id, p.alias
   order by count(distinct e.necesidad_id) desc, max(e.ocurrido_en) desc
$$;

-- Permisos: los internos no se exponen; coordinacion solo autenticados; reconocimiento publico.
revoke execute on function public._ventana_ayuda_reciente() from public, anon, authenticated;
revoke execute on function public._ventana_misma_categoria() from public, anon, authenticated;
revoke execute on function public._ayudas_recibidas(text) from public, anon, authenticated;
revoke execute on function public._nombre_categoria(public.categoria_necesidad) from public, anon, authenticated;
revoke execute on function public._motivo_revision(text, public.categoria_necesidad) from public, anon, authenticated;
revoke execute on function public._ayuda_reciente(text) from public, anon, authenticated;
revoke execute on function public._exigir_coordinacion() from public, anon, authenticated;
revoke execute on function public.solicitudes_en_revision() from public, anon;
revoke execute on function public.revisar_necesidad(uuid, boolean) from public, anon;
revoke execute on function public.historial_celular(text) from public, anon;
revoke execute on function public.vecinos_que_ayudan() from public;
grant execute on function public.solicitudes_en_revision() to authenticated;
grant execute on function public.revisar_necesidad(uuid, boolean) to authenticated;
grant execute on function public.historial_celular(text) to authenticated;
grant execute on function public.vecinos_que_ayudan() to anon, authenticated;
