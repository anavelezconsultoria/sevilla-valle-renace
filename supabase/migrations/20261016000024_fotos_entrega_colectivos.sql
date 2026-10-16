-- Las fotos de entrega fallaban para TODOS desde 0021: la politica de Storage
-- consultaba public.colectivos, que no se puede leer desde la API (sin
-- permisos), y la consulta entera daba error. Ahora la regla vive en una
-- funcion SECURITY DEFINER, como _puede_adjuntar para las fotos de solicitud.

create or replace function public._puede_subir_evidencia(p_ruta text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (storage.foldername(p_ruta))[1] = auth.uid()::text
      or exists (
        select 1 from public.colectivos c
         where c.perfil_id::text = (storage.foldername(p_ruta))[1]
           and c.administrador_id = auth.uid()
      )
$$;

drop policy if exists "ayudantes suben evidencias en su carpeta" on storage.objects;
create policy "ayudantes suben evidencias en su carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'evidencias' and public._puede_subir_evidencia(name));

revoke execute on function public._puede_subir_evidencia(text) from public, anon;
grant execute on function public._puede_subir_evidencia(text) to authenticated;
