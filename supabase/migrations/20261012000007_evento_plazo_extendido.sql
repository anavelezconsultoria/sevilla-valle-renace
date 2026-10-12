-- Nuevo evento del historial: quien atiende pidio 24 horas mas para entregar.
-- Va solo en su migracion: un valor nuevo de un enum no se puede usar en la
-- misma transaccion en que se crea.
alter type public.tipo_evento add value if not exists 'plazo_extendido';
