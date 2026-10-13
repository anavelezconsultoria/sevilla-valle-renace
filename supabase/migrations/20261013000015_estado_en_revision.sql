-- Valores nuevos para la revision de solicitudes repetidas. Va sola, antes de
-- 0016: Postgres no deja usar un valor de enum en la misma transaccion en que
-- se agrega (mismo patron que 0007 con 'plazo_extendido').

alter type public.estado_necesidad add value if not exists 'en_revision';
alter type public.tipo_evento add value if not exists 'en_revision';
alter type public.tipo_evento add value if not exists 'revision_aprobada';
alter type public.tipo_evento add value if not exists 'revision_rechazada';
