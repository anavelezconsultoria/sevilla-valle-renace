-- Tiempo real: el mapa y los tableros se actualizan solos cuando cambia una
-- necesidad o se agrega un evento. Realtime respeta RLS: solo emite lo publico.
alter publication supabase_realtime add table public.necesidades, public.eventos_necesidad;
