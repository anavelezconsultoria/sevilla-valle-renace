-- =============================================================================
-- Endurecer la revision (caso Fundadores y Reinaldo, 2026-10-20):
-- 1. Si el celular ya tiene CUALQUIER solicitud sin cerrar (no solo de la
--    misma categoria), la nueva entra a revision. Antes podia pedir ropa y
--    mercado a la vez y ambas se publicaban.
-- 2. Si la descripcion es igual a la de otra solicitud de los ultimos 15 dias,
--    de cualquier celular, entra a revision. Antes las copias solo se
--    frenaban si eran del mismo celular y de los ultimos 30 minutos.
-- Revision no es bloqueo: la coordinacion aprueba si es una necesidad real.
-- =============================================================================

/** Por que una solicitud nueva debe revisarse, o NULL si se publica directo. */
create or replace function public._motivo_revision(p_telefono text, p_categoria public.categoria_necesidad)
returns text language plpgsql stable
set search_path = ''
as $$
declare
  v_dias int;
  v_recientes int;
  v_abierta public.categoria_necesidad;
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

  select n.categoria into v_abierta
    from public.necesidades_privado pr
    join public.necesidades n on n.id = pr.necesidad_id
   where pr.telefono = p_telefono
     and n.estado in ('registrada', 'en_revision', 'en_atencion', 'entregada')
   order by n.registrada_en desc
   limit 1;
  if v_abierta is not null then
    return 'Ya tiene otra solicitud sin cerrar (' || public._nombre_categoria(v_abierta) || ').';
  end if;
  return null;
end
$$;

/** Descripcion comparable: minusculas, sin signos ni espacios repetidos. */
create or replace function public._texto_comparable(p_texto text)
returns text language sql immutable
set search_path = ''
as $$
  select btrim(regexp_replace(lower(coalesce(p_texto, '')), '[^a-z0-9áéíóúüñ]+', ' ', 'g'))
$$;

/** Hace cuantos dias otra solicitud tuvo la misma descripcion, o NULL. */
create or replace function public._dias_misma_descripcion(p_necesidad uuid)
returns int language sql stable
set search_path = ''
as $$
  select extract(day from now() - max(otra.registrada_en))::int
    from public.necesidades nueva
    join public.necesidades otra
      on otra.id <> nueva.id
     and otra.estado <> 'cancelada'
     and otra.registrada_en > now() - public._ventana_misma_categoria()
     and public._texto_comparable(otra.descripcion) = public._texto_comparable(nueva.descripcion)
   where nueva.id = p_necesidad
$$;

/** Revision al guardar los datos privados: mismo punto con otro celular, o descripcion copiada. */
create or replace function public._revisar_mismo_punto()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_dias int;
  v_categoria public.categoria_necesidad;
begin
  if new.motivo_revision is not null then
    return new;
  end if;
  select categoria into v_categoria from public.necesidades where id = new.necesidad_id and estado = 'registrada';
  if v_categoria is null then
    return new;
  end if;

  v_dias := public._dias_mismo_punto(new.telefono, new.lat, new.lng, v_categoria);
  if v_dias is not null then
    new.motivo_revision := 'Otro celular pidió ' || public._nombre_categoria(v_categoria) || ' desde casi el mismo punto hace '
      || case when v_dias = 0 then 'menos de un día' when v_dias = 1 then '1 día' else v_dias || ' días' end || '.';
  else
    v_dias := public._dias_misma_descripcion(new.necesidad_id);
    if v_dias is null then
      return new;
    end if;
    new.motivo_revision := 'Hay otra solicitud con la misma descripción de hace '
      || case when v_dias = 0 then 'menos de un día' when v_dias = 1 then '1 día' else v_dias || ' días' end || '.';
  end if;

  update public.necesidades set estado = 'en_revision', actualizada_en = now() where id = new.necesidad_id;
  return new;
end
$$;

/** El evento de revision va despues del de registro, para que la linea de tiempo quede en orden. */
create or replace function public._evento_revision_mismo_punto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.necesidades_privado pr
      join public.necesidades n on n.id = pr.necesidad_id
     where pr.necesidad_id = new.necesidad_id and n.estado = 'en_revision'
       and (pr.motivo_revision like 'Otro celular pidió%' or pr.motivo_revision like 'Hay otra solicitud con la misma descripción%')
  ) then
    perform public._registrar_evento(new.necesidad_id, 'en_revision', null, 'Sevilla Renace');
  end if;
  return new;
end
$$;

revoke execute on function public._motivo_revision(text, public.categoria_necesidad) from public, anon, authenticated;
revoke execute on function public._texto_comparable(text) from public, anon, authenticated;
revoke execute on function public._dias_misma_descripcion(uuid) from public, anon, authenticated;
revoke execute on function public._revisar_mismo_punto() from public, anon, authenticated;
revoke execute on function public._evento_revision_mismo_punto() from public, anon, authenticated;
