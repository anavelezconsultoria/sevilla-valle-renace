-- Soporte de la coordinacion: ayudas que alguien esta llevando ahora, con el
-- celular privado de quien ayuda, para escribirle ("¿como vas? ¿necesitas
-- apoyo?"). Solo coordinacion; la mas cerca de vencerse primero.

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
           n.vence_en, p.alias, pp.celular
      from public.necesidades n
      join public.perfiles p on p.id = n.ayudante_id
      left join public.perfiles_privado pp on pp.id = p.id
     where n.estado = 'en_atencion'
     order by n.vence_en nulls last;
end
$$;

revoke execute on function public.atenciones_en_curso() from public, anon;
grant execute on function public.atenciones_en_curso() to authenticated;
