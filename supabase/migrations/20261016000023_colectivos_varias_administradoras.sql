-- =============================================================================
-- Un colectivo puede tener varias administradoras (Ana y Nana para
-- Baltimore-Maryland). La llave pasa de (perfil_id) a (perfil_id, administrador_id).
-- Ajusta las funciones que asumian una sola administradora.
-- =============================================================================

alter table public.colectivos drop constraint if exists colectivos_pkey;
alter table public.colectivos add primary key (perfil_id, administrador_id);

-- Unir perfiles: traslada sin duplicar si el perfil nuevo ya administraba el mismo colectivo.
create or replace function public._unir_perfiles(p_destino uuid, p_origenes uuid[])
returns void language plpgsql volatile
set search_path = ''
as $$
begin
  if coalesce(array_length(p_origenes, 1), 0) = 0 then return; end if;
  if exists (select 1 from public.perfiles where id = any (p_origenes) and rol = 'coordinacion') then
    update public.perfiles set rol = 'coordinacion' where id = p_destino;
  end if;
  update public.necesidades set ayudante_id = p_destino where ayudante_id = any (p_origenes);
  update public.eventos_necesidad set actor_id = p_destino where actor_id = any (p_origenes);
  insert into public.colectivos (perfil_id, administrador_id)
  select c.perfil_id, p_destino from public.colectivos c where c.administrador_id = any (p_origenes)
  on conflict do nothing;
  delete from auth.users where id = any (p_origenes);
end
$$;

/** La coordinacion suma a otra coordinadora (por su celular) como administradora de un colectivo suyo. */
create or replace function public.compartir_colectivo(p_colectivo uuid, p_celular text)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_admin public.perfiles;
  v_otra public.perfiles;
begin
  if public._a_nombre_de() is not null then
    raise exception 'Hazlo desde tu propio perfil.' using errcode = '42501';
  end if;
  v_admin := public._exigir_coordinacion();
  if not exists (select 1 from public.colectivos where perfil_id = p_colectivo and administrador_id = v_admin.id) then
    raise exception 'Solo quien administra el colectivo puede compartirlo.' using errcode = '42501';
  end if;
  select p.* into v_otra
    from public.perfiles p
    join public.perfiles_privado pp on pp.id = p.id
   where pp.celular = public._normalizar_telefono(p_celular)
   order by pp.actualizado_en desc
   limit 1;
  if v_otra.id is null then
    raise exception 'Ese celular no ha entrado a ayudar todavía.' using errcode = 'P0002';
  end if;
  if v_otra.rol <> 'coordinacion' then
    raise exception 'Solo se puede compartir con alguien de la coordinación.' using errcode = 'P0001';
  end if;
  insert into public.colectivos (perfil_id, administrador_id) values (p_colectivo, v_otra.id)
  on conflict do nothing;
  return v_otra.alias;
end
$$;

-- Soporte: un solo renglon por ayuda aunque el colectivo tenga varias administradoras.
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
           n.vence_en, p.alias,
           coalesce(pp.celular, (
             select pa.celular from public.colectivos c
               join public.perfiles_privado pa on pa.id = c.administrador_id
              where c.perfil_id = p.id
              order by c.creado_en
              limit 1
           ))
      from public.necesidades n
      join public.perfiles p on p.id = n.ayudante_id
      left join public.perfiles_privado pp on pp.id = p.id
     where n.estado = 'en_atencion'
     order by n.vence_en nulls last;
end
$$;

revoke execute on function public.compartir_colectivo(uuid, text) from public, anon;
grant execute on function public.compartir_colectivo(uuid, text) to authenticated;
