-- =============================================================================
-- Pruebas de seguridad y ciclo de vida. Corren en una transaccion con ROLLBACK:
-- no dejan datos. Cada bloque que espera un error falla si el error NO ocurre.
-- =============================================================================
begin;

-- Dos ayudantes de prueba
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000000a', 'a@prueba.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000b', 'b@prueba.local', 'authenticated', 'authenticated');

-- -----------------------------------------------------------------------------
-- 1. Visitante anonimo
-- -----------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare r record;
begin
  select * into r from public.registrar_necesidad('agua', 'Agua para la semana', 'Se rompio el tanque con el temblor', 'alta', 4, 'Sector prueba', 4.2667, -75.9333, 'Rosa', '315 123 4567', 'Casa azul');
  perform set_config('prueba.id', r.necesidad_id::text, true);
  perform set_config('prueba.codigo', r.codigo, true);
  if r.codigo !~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$' then raise exception 'FALLO: codigo con formato invalido %', r.codigo; end if;
  raise notice 'OK  anonimo registra una necesidad y recibe codigo';
end $$;

do $$ begin
  perform * from public.necesidades_privado;
  raise exception 'FALLO: anonimo leyo datos privados';
exception when insufficient_privilege then raise notice 'OK  anonimo NO puede leer datos privados';
end $$;

do $$ begin
  update public.necesidades set estado = 'atendida' where true;
  raise exception 'FALLO: anonimo modifico estados directamente';
exception when insufficient_privilege then raise notice 'OK  anonimo NO puede cambiar estados directamente';
end $$;

do $$ begin
  insert into public.eventos_necesidad (necesidad_id, tipo, actor_alias) values (current_setting('prueba.id')::uuid, 'confirmada', 'falso');
  raise exception 'FALLO: anonimo escribio el historial';
exception when insufficient_privilege then raise notice 'OK  anonimo NO puede escribir el historial';
end $$;

do $$ begin
  perform public.tomar_necesidad(current_setting('prueba.id')::uuid);
  raise exception 'FALLO: anonimo tomo una necesidad';
exception when insufficient_privilege then raise notice 'OK  anonimo NO puede tomar necesidades';
end $$;

do $$ begin
  if public.consultar_por_codigo(lower(replace(current_setting('prueba.codigo'), '-', ' '))) is distinct from current_setting('prueba.id')::uuid then
    raise exception 'FALLO: consulta por codigo no encontro la necesidad';
  end if;
  raise notice 'OK  consulta por codigo tolera minusculas y espacios';
end $$;

do $$ begin
  perform public.confirmar_recibida(current_setting('prueba.codigo'));
  raise exception 'FALLO: se confirmo una necesidad que no fue entregada';
exception when sqlstate 'P0001' then raise notice 'OK  no se puede confirmar antes de la entrega';
end $$;

-- -----------------------------------------------------------------------------
-- 2. Ayudante A toma la necesidad
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}', true);

do $$ declare c record; begin
  perform public.asegurar_perfil('Ayudante A');
  perform public.tomar_necesidad(current_setting('prueba.id')::uuid);
  select * into c from public.contacto_necesidad(current_setting('prueba.id')::uuid);
  if c.telefono <> '3151234567' then raise exception 'FALLO: contacto incorrecto %', c.telefono; end if;
  raise notice 'OK  ayudante A toma la necesidad y ve el contacto normalizado';
end $$;

-- -----------------------------------------------------------------------------
-- 3. Ayudante B no puede interferir
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000b"}', true);
select public.asegurar_perfil('Ayudante B');

do $$ begin
  perform public.tomar_necesidad(current_setting('prueba.id')::uuid);
  raise exception 'FALLO: B tomo una necesidad ya tomada';
exception when sqlstate 'P0001' then raise notice 'OK  B NO puede tomar lo que A ya tomo';
end $$;

do $$ begin
  perform * from public.contacto_necesidad(current_setting('prueba.id')::uuid);
  raise exception 'FALLO: B vio el contacto';
exception when insufficient_privilege then raise notice 'OK  B NO ve el contacto de una necesidad ajena';
end $$;

do $$ begin
  perform public.entregar_necesidad(current_setting('prueba.id')::uuid, 'Entregado por B', '{}');
  raise exception 'FALLO: B entrego una necesidad ajena';
exception when sqlstate 'P0001' then raise notice 'OK  B NO puede entregar una necesidad ajena';
end $$;

-- -----------------------------------------------------------------------------
-- 4. A entrega
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}', true);

do $$ begin
  perform public.entregar_necesidad(current_setting('prueba.id')::uuid, 'Dos bolsas de agua', array['00000000-0000-0000-0000-00000000000b/x/foto.jpg']);
  raise exception 'FALLO: se acepto una foto de otra carpeta';
exception when sqlstate 'P0001' then raise notice 'OK  se rechazan rutas de evidencia ajenas';
end $$;

select public.entregar_necesidad(
  current_setting('prueba.id')::uuid,
  'Dos bolsas de agua',
  array['00000000-0000-0000-0000-00000000000a/' || current_setting('prueba.id') || '/foto.jpg']
);

-- -----------------------------------------------------------------------------
-- 5. El solicitante confirma con su codigo
-- -----------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$ begin
  perform public.confirmar_recibida('ZZZZ-ZZZZ');
  raise exception 'FALLO: un codigo falso confirmo';
exception when sqlstate 'P0002' then raise notice 'OK  un codigo falso no sirve';
end $$;

select public.confirmar_recibida(current_setting('prueba.codigo'));

do $$ declare n record; tipos text; begin
  select * into n from public.necesidades where id = current_setting('prueba.id')::uuid;
  if n.estado <> 'atendida' or n.cierre <> 'confirmada' then raise exception 'FALLO: estado final %/%', n.estado, n.cierre; end if;
  select string_agg(tipo::text, ',' order by ocurrido_en, tipo) into tipos from public.eventos_necesidad where necesidad_id = n.id;
  if tipos <> 'registrada,tomada,entregada,confirmada' then raise exception 'FALLO: historial %', tipos; end if;
  if (select count(*) from public.evidencias where necesidad_id = n.id) <> 1 then raise exception 'FALLO: evidencia no registrada'; end if;
  raise notice 'OK  queda atendida, confirmada, con historial completo y evidencia';
end $$;

-- -----------------------------------------------------------------------------
-- 6. Vencimientos de 48 horas
-- -----------------------------------------------------------------------------
do $$ declare r record; begin
  select * into r from public.registrar_necesidad('ropa', 'Cobijas para la noche', 'Dormimos en el patio por las replicas', 'media', 3, 'Sector prueba', 4.27, -75.93, 'Luis', '3009998877');
  perform set_config('prueba.id2', r.necesidad_id::text, true);
  perform set_config('prueba.codigo2', r.codigo, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}', true);
select public.tomar_necesidad(current_setting('prueba.id2')::uuid);

reset role;
update public.necesidades set vence_en = now() - interval '1 minute' where id = current_setting('prueba.id2')::uuid;
select public.aplicar_vencimientos();

do $$ declare n record; begin
  select * into n from public.necesidades where id = current_setting('prueba.id2')::uuid;
  if n.estado <> 'registrada' or n.ayudante_id is not null then raise exception 'FALLO: no se libero la toma vencida (%)', n.estado; end if;
  raise notice 'OK  la toma sin entrega en 48 h vuelve a la lista';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000b"}', true);
select public.tomar_necesidad(current_setting('prueba.id2')::uuid);
select public.entregar_necesidad(current_setting('prueba.id2')::uuid, 'Tres cobijas', '{}');

reset role;
update public.necesidades set vence_en = now() - interval '1 minute' where id = current_setting('prueba.id2')::uuid;
select public.aplicar_vencimientos();

do $$ declare n record; begin
  select * into n from public.necesidades where id = current_setting('prueba.id2')::uuid;
  if n.estado <> 'atendida' or n.cierre <> 'cerrada_automaticamente' then raise exception 'FALLO: no se cerro sola (%/%)', n.estado, n.cierre; end if;
  raise notice 'OK  la entrega sin reclamo en 48 h se cierra como atendida';
end $$;

-- -----------------------------------------------------------------------------
-- 7. Privacidad de la ubicacion y freno al abuso
-- -----------------------------------------------------------------------------
do $$ declare d double precision; begin
  select 6371000 * 2 * asin(sqrt(
           sin(radians(n.lat_aprox - p.lat) / 2) ^ 2 +
           cos(radians(p.lat)) * cos(radians(n.lat_aprox)) * sin(radians(n.lng_aprox - p.lng) / 2) ^ 2))
    into d
    from public.necesidades n join public.necesidades_privado p on p.necesidad_id = n.id
   where n.id = current_setting('prueba.id')::uuid;
  if d < 149 or d > 301 then raise exception 'FALLO: desplazamiento de % m', round(d); end if;
  raise notice 'OK  la ubicacion publica esta a % m del punto real', round(d);
end $$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  for i in 1..3 loop
    perform public.registrar_necesidad('aseo', 'Kit de aseo ' || i, 'Necesitamos jabon y panales para el bebe', 'baja', 2, 'Sector', 4.26, -75.93, 'Ana', '3110000000');
  end loop;
  perform public.registrar_necesidad('aseo', 'Kit de aseo 4', 'Necesitamos jabon y panales para el bebe', 'baja', 2, 'Sector', 4.26, -75.93, 'Ana', '3110000000');
  raise exception 'FALLO: se permitio una cuarta necesidad activa con el mismo celular';
exception when sqlstate 'P0001' then raise notice 'OK  un celular no puede tener mas de 3 necesidades activas';
end $$;

do $$ begin
  perform public.registrar_necesidad('aseo', 'X', 'corta', 'baja', 0, 'S', 4.26, -75.93, 'A', '123');
  raise exception 'FALLO: se aceptaron datos invalidos';
exception when check_violation then raise notice 'OK  la base rechaza datos invalidos aunque el cliente no valide';
end $$;

rollback;
