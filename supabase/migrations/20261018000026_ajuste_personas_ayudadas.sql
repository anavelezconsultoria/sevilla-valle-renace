-- =============================================================================
-- Ajuste de "personas ayudadas": ayudas que la coordinacion entrego por fuera
-- de la plataforma (antes de registrarlas, o en jornadas). Se SUMA a lo que la
-- plataforma cuenta sola, asi las nuevas ayudas se siguen sumando.
-- Una sola fila; la lee cualquiera, la cambia la coordinacion.
-- =============================================================================

create table if not exists public.ajustes_cifras (
  id int primary key default 1 check (id = 1),
  personas_ayudadas_extra int not null default 0 check (personas_ayudadas_extra between 0 and 100000),
  nota text not null default '' check (char_length(nota) <= 200),
  actualizado_en timestamptz not null default now()
);

insert into public.ajustes_cifras (id) values (1) on conflict do nothing;

alter table public.ajustes_cifras enable row level security;
revoke all on public.ajustes_cifras from anon, authenticated;
grant select on public.ajustes_cifras to anon, authenticated;
drop policy if exists "lectura publica de ajustes" on public.ajustes_cifras;
create policy "lectura publica de ajustes" on public.ajustes_cifras for select to anon, authenticated using (true);

/** La coordinacion fija cuantas personas se ayudaron por fuera de la plataforma. */
create or replace function public.fijar_personas_ayudadas_extra(p_extra int, p_nota text default '')
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  perform public._exigir_coordinacion();
  update public.ajustes_cifras
     set personas_ayudadas_extra = greatest(coalesce(p_extra, 0), 0),
         nota = left(coalesce(p_nota, ''), 200),
         actualizado_en = now()
   where id = 1;
end
$$;

revoke execute on function public.fijar_personas_ayudadas_extra(int, text) from public, anon;
grant execute on function public.fijar_personas_ayudadas_extra(int, text) to authenticated;
