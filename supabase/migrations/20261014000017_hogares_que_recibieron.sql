-- Lista privada para la coordinacion: hogares (por celular) que ya recibieron
-- ayuda, con cuantas, la ultima fecha y las categorias. Nunca es publica.

create or replace function public.hogares_que_recibieron()
returns table (
  telefono text, nombre text, sector text, ayudas bigint, ultima_ayuda timestamptz, categorias text[]
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public._exigir_coordinacion();
  return query
    select pr.telefono,
           (array_agg(pr.nombre order by n.registrada_en desc))[1],
           (array_agg(n.sector order by n.registrada_en desc))[1],
           count(*),
           max(e.entregada_en),
           array_agg(distinct n.categoria::text)
      from public.necesidades_privado pr
      join public.necesidades n on n.id = pr.necesidad_id
      join lateral (
        select max(ev.ocurrido_en) as entregada_en
          from public.eventos_necesidad ev
         where ev.necesidad_id = n.id and ev.tipo = 'entregada'
      ) e on e.entregada_en is not null
     where n.estado in ('entregada', 'atendida')
     group by pr.telefono
     order by max(e.entregada_en) desc;
end
$$;

revoke execute on function public.hogares_que_recibieron() from public, anon;
grant execute on function public.hogares_que_recibieron() to authenticated;
