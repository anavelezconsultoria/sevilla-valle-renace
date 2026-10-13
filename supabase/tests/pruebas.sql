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
  select * into r from public.registrar_necesidad('agua', 'Agua para la semana', 'Se rompio el tanque con el temblor', 'alta', 4, 'Sector prueba', 4.2667, -75.9333, 'Rosa', '315 123 4567', '5793', 'Casa azul');
  perform set_config('prueba.id', r.necesidad_id::text, true);
  perform set_config('prueba.codigo', r.codigo, true);
  if r.codigo !~ '^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$' then raise exception 'FALLO: codigo con formato invalido %', r.codigo; end if;
  raise notice 'OK  anonimo registra una necesidad (con clave) y el celular recibe su llave interna';
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

do $$ begin
  perform public.registrar_necesidad('agua', 'Agua', 'Se rompio el tanque con el temblor', 'alta', 1, 'Sector', 4.26, -75.93, 'Rosa', '3151234567', '1234');
  raise exception 'FALLO: se acepto una clave obvia';
exception when sqlstate 'P0001' then raise notice 'OK  se rechaza una clave obvia (1234)';
end $$;

do $$ begin
  perform public.registrar_necesidad('agua', 'Agua', 'Se rompio el tanque con el temblor', 'alta', 1, 'Sector', 4.26, -75.93, 'Rosa', '3151234567', '4567');
  raise exception 'FALLO: se acepto como clave el final del celular';
exception when sqlstate 'P0001' then raise notice 'OK  se rechaza como clave el final del celular, que quien ayuda ve';
end $$;

do $$ begin
  if not exists (select 1 from public.mis_necesidades('315 123 4567', '5793') m where m = current_setting('prueba.id')::uuid) then
    raise exception 'FALLO: celular + clave no encontraron la necesidad';
  end if;
  if exists (select 1 from public.mis_necesidades('3151234567', '9999')) then
    raise exception 'FALLO: una clave equivocada devolvio necesidades';
  end if;
  raise notice 'OK  celular + clave encuentran la necesidad; una clave equivocada no ve nada';
end $$;

-- Fuerza bruta: 5 fallos bloquean el celular 15 minutos, incluso para la clave correcta.
do $$ declare r record; begin
  select * into r from public.registrar_necesidad('ropa', 'Cobijas', 'Dormimos en el patio por las replicas', 'media', 2, 'Sector', 4.26, -75.93, 'Eva', '3205550000', '7319');
  for i in 1..5 loop
    if exists (select 1 from public.mis_necesidades('3205550000', lpad(i::text, 4, '8'))) then raise exception 'FALLO: clave falsa aceptada'; end if;
  end loop;
  perform * from public.mis_necesidades('3205550000', '7319');
  raise exception 'FALLO: no se bloqueo tras 5 intentos fallidos';
exception when sqlstate 'P0003' then raise notice 'OK  5 intentos fallidos bloquean el celular 15 minutos';
end $$;

-- -----------------------------------------------------------------------------
-- 2. Ayudante A toma la necesidad
-- -----------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}', true);

do $$ declare c record; begin
  perform public.asegurar_perfil('Ayudante A', '3001112222');
  perform public.tomar_necesidad(current_setting('prueba.id')::uuid);
  select * into c from public.contacto_necesidad(current_setting('prueba.id')::uuid);
  if c.telefono <> '3151234567' then raise exception 'FALLO: contacto incorrecto %', c.telefono; end if;
  raise notice 'OK  ayudante A toma la necesidad y ve el contacto normalizado';
end $$;

-- -----------------------------------------------------------------------------
-- 3. Ayudante B no puede interferir
-- -----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000b"}', true);
select public.asegurar_perfil('Ayudante B', '3003334444');

do $$ begin
  perform * from public.perfiles_privado;
  raise exception 'FALLO: un ayudante leyo celulares de otros ayudantes';
exception when insufficient_privilege then raise notice 'OK  el celular de quien ayuda es privado';
end $$;

do $$ begin
  perform public.asegurar_perfil('Ayudante B', '12345');
  raise exception 'FALLO: se acepto un celular invalido';
exception when sqlstate 'P0001' then raise notice 'OK  se rechaza un celular invalido de quien ayuda';
end $$;

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
-- 5. El solicitante confirma con su celular y su clave
-- -----------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$ begin
  perform public.confirmar_recibida('ZZZZ-ZZZZ');
  raise exception 'FALLO: un codigo falso confirmo';
exception when sqlstate 'P0002' then raise notice 'OK  un codigo falso no sirve';
end $$;

do $$ begin
  if public.confirmar_con_clave(current_setting('prueba.id')::uuid, '3151234567', '8642') is not null then
    raise exception 'FALLO: una clave equivocada confirmo';
  end if;
  if (select estado from public.necesidades where id = current_setting('prueba.id')::uuid) <> 'entregada' then
    raise exception 'FALLO: la clave equivocada cambio el estado';
  end if;
  raise notice 'OK  quien conoce el celular pero no la clave NO puede confirmar';
end $$;

do $$ begin
  perform public.registrar_necesidad('aseo', 'Jabon', 'Necesitamos jabon para lavar la ropa', 'baja', 2, 'Sector', 4.26, -75.93, 'Teo', '3017776655', '3952');
  if public.confirmar_con_clave(current_setting('prueba.id')::uuid, '3017776655', '3952') is not null then
    raise exception 'FALLO: la clave de otra persona sirvio para esta necesidad';
  end if;
  raise notice 'OK  el celular y la clave de otra solicitud no sirven para esta';
end $$;

select public.confirmar_con_clave(current_setting('prueba.id')::uuid, '315 123 4567', '5793');

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
  select * into r from public.registrar_necesidad('ropa', 'Cobijas para la noche', 'Dormimos en el patio por las replicas', 'media', 3, 'Sector prueba', 4.27, -75.93, 'Luis', '3009998877', '8264');
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
    perform public.registrar_necesidad('aseo', 'Kit de aseo ' || i, 'Necesitamos jabon y panales para el bebe', 'baja', 2, 'Sector', 4.26, -75.93, 'Ana', '3110000000', '2468');
  end loop;
  perform public.registrar_necesidad('aseo', 'Kit de aseo 4', 'Necesitamos jabon y panales para el bebe', 'baja', 2, 'Sector', 4.26, -75.93, 'Ana', '3110000000', '2468');
  raise exception 'FALLO: se permitio una cuarta necesidad activa con el mismo celular';
exception when sqlstate 'P0001' then raise notice 'OK  un celular no puede tener mas de 3 necesidades activas';
end $$;

do $$ begin
  perform public.registrar_necesidad('aseo', 'X', 'corta', 'baja', 0, 'S', 4.26, -75.93, 'A', '123', '5793');
  raise exception 'FALLO: se aceptaron datos invalidos';
exception when check_violation then raise notice 'OK  la base rechaza datos invalidos aunque el cliente no valide';
end $$;

-- Un celular, una clave; y prioridad 0.
do $$ declare r record; begin
  select * into r from public.registrar_necesidad('alimentos', 'Leche para bebe', 'Bebe de 3 meses sin leche de formula', 'alta', 3, 'Sector', 4.26, -75.93, 'Luz', '3157001122', '5793', '', true);
  if r.necesidad_id is null then raise exception 'FALLO: no se registro la primera solicitud'; end if;
  if not (select prioridad_cero from public.necesidades where id = r.necesidad_id) then raise exception 'FALLO: no quedo como prioridad 0'; end if;
  select * into r from public.registrar_necesidad('ropa', 'Cobijas', 'Necesitamos cobijas para la noche', 'media', 3, 'Sector', 4.26, -75.93, 'Luz', '3157001122', '8642');
  if r.necesidad_id is not null or r.codigo <> 'clave_no_coincide' then raise exception 'FALLO: se acepto otra clave para el mismo celular'; end if;
  select * into r from public.registrar_necesidad('ropa', 'Cobijas', 'Necesitamos cobijas para la noche', 'media', 3, 'Sector', 4.26, -75.93, 'Luz', '3157001122', '5793');
  if r.necesidad_id is null then raise exception 'FALLO: la misma clave no sirvio para la segunda solicitud'; end if;
  if (select prioridad_cero from public.necesidades where id = r.necesidad_id) then raise exception 'FALLO: prioridad 0 por defecto'; end if;
  raise notice 'OK  prioridad 0 se guarda; un celular usa una sola clave para todas sus solicitudes';
end $$;

-- Solo la coordinacion asigna claves nuevas.
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}', true);
do $$ begin
  perform public.restablecer_clave_solicitante('3157001122', '7319');
  raise exception 'FALLO: un ayudante comun cambio una clave';
exception when insufficient_privilege then raise notice 'OK  un ayudante comun NO puede cambiar claves';
end $$;

reset role;
update public.perfiles set rol = 'coordinacion' where id = '00000000-0000-0000-0000-00000000000a';
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}', true);
do $$ begin
  if public.restablecer_clave_solicitante('315 700 1122', '7319') <> 2 then raise exception 'FALLO: no cambio las 2 solicitudes'; end if;
  raise notice 'OK  la coordinacion asigna una clave nueva a todas las solicitudes del celular';
end $$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  if (select count(*) from public.mis_necesidades('3157001122', '7319')) <> 2 then raise exception 'FALLO: la clave nueva no abre las solicitudes'; end if;
  if exists (select 1 from public.mis_necesidades('3157001122', '5793')) then raise exception 'FALLO: la clave vieja sigue sirviendo'; end if;
  raise notice 'OK  la clave nueva funciona y la vieja ya no';
end $$;

-- Ayudante con celular + clave: desde otro navegador se une al mismo perfil.
reset role;
insert into auth.users (id, email, aud, role)
values ('00000000-0000-0000-0000-00000000000c', 'c@prueba.local', 'authenticated', 'authenticated'),
       ('00000000-0000-0000-0000-00000000000d', 'd@prueba.local', 'authenticated', 'authenticated');
do $$ declare r record; begin
  select * into r from public.registrar_necesidad('ropa', 'Cobijas para la noche', 'Necesitamos cobijas para 3 personas', 'media', 3, 'Sector', 4.26, -75.93, 'Paz', '3185550003', '5793');
  perform set_config('prueba.id4', r.necesidad_id::text, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000c"}', true);
do $$ begin
  if public.asegurar_perfil('Marta', '3186660001', '4826') is null then raise exception 'FALLO: no creo el perfil'; end if;
  perform public.tomar_necesidad(current_setting('prueba.id4')::uuid);
  if not public.tengo_clave_ayudante() then raise exception 'FALLO: no guardo la clave'; end if;
  raise notice 'OK  quien ayuda entra con celular y clave';
end $$;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000d"}', true);
do $$ begin
  if public.asegurar_perfil('Marta', '3186660001', '9137') is not null then raise exception 'FALLO: entro con otra clave'; end if;
  raise notice 'OK  con el celular pero sin la clave NO se entra al perfil de otra persona';
end $$;

do $$ begin
  if public.asegurar_perfil('Marta celular nuevo', '318 666 0001', '4826') is null then raise exception 'FALLO: no entro con la clave correcta'; end if;
  if (select ayudante_id from public.necesidades where id = current_setting('prueba.id4')::uuid) <> '00000000-0000-0000-0000-00000000000d' then
    raise exception 'FALLO: la necesidad no paso al perfil nuevo';
  end if;
  if exists (select 1 from public.perfiles where id = '00000000-0000-0000-0000-00000000000c') then raise exception 'FALLO: quedo el perfil viejo'; end if;
  raise notice 'OK  con celular y clave correctos, el navegador nuevo ve todo lo del mismo ayudante';
end $$;

reset role;
insert into auth.users (id, email, aud, role) values ('00000000-0000-0000-0000-00000000000e', 'e@prueba.local', 'authenticated', 'authenticated');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000e"}', true);
do $$ declare v public.perfiles; begin
  v := public.asegurar_perfil('', '3186660001', '4826');
  if v.alias <> 'Marta celular nuevo' then raise exception 'FALLO: no conservo el nombre (%)', v.alias; end if;
  raise notice 'OK  "Ya ayude antes": solo celular y clave, conserva el nombre';
end $$;

do $$ begin
  perform public.asegurar_perfil('', '3199990009', '4826');
  raise exception 'FALLO: entro sin nombre un celular nuevo';
exception when sqlstate 'P0001' then raise notice 'OK  un celular sin perfil necesita "Es mi primera vez"';
end $$;

reset role;

-- Una clave por celular: quien pidio ayuda entra a ayudar con la misma clave.
reset role;
insert into auth.users (id, email, aud, role) values ('00000000-0000-0000-0000-00000000000f', 'f@prueba.local', 'authenticated', 'authenticated');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000f"}', true);
do $$ begin
  -- 3157001122 pidio ayuda; su clave de solicitudes es 7319 (cambiada por coordinacion arriba).
  if public.asegurar_perfil('Luz', '3157001122', '8642') is not null then raise exception 'FALLO: entro a ayudar con otra clave'; end if;
  begin
    perform public.asegurar_perfil('', '3157001122', '7319');
    raise exception 'FALLO: entro sin nombre siendo su primera vez ayudando';
  exception when sqlstate 'P0001' then null;
  end;
  if public.asegurar_perfil('Luz', '3157001122', '7319') is null then raise exception 'FALLO: no entro con la clave de sus solicitudes'; end if;
  raise notice 'OK  quien pidio ayuda entra a ayudar con la misma clave (y no con otra)';
end $$;
reset role;

-- La coordinacion tambien asigna clave nueva a quien SOLO ayuda (sin solicitudes).
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}', true);
do $$ begin
  -- 3186660001 (Marta) solo ayuda: no tiene solicitudes.
  if public.restablecer_clave_solicitante('3186660001', '5274') < 1 then raise exception 'FALLO: no cambio la clave del ayudante'; end if;
  begin
    perform public.restablecer_clave_solicitante('3199990009', '5274');
    raise exception 'FALLO: acepto un celular que no esta registrado';
  exception when sqlstate 'P0002' then null;
  end;
  raise notice 'OK  la coordinacion asigna clave nueva a quien solo ayuda';
end $$;

reset role;
insert into auth.users (id, email, aud, role) values ('00000000-0000-0000-0000-000000000010', 'g@prueba.local', 'authenticated', 'authenticated');
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-000000000010"}', true);
do $$ begin
  if public.asegurar_perfil('', '3186660001', '4826') is not null then raise exception 'FALLO: la clave vieja del ayudante sigue sirviendo'; end if;
  if public.asegurar_perfil('', '3186660001', '5274') is null then raise exception 'FALLO: la clave nueva no abre el perfil del ayudante'; end if;
  raise notice 'OK  el ayudante entra con la clave nueva y la vieja ya no sirve';
end $$;
reset role;

-- Adjuntos: solo a una necesidad recien registrada, con limite; el video es privado.
do $$ declare r record; begin
  select * into r from public.registrar_necesidad('techo', 'Tejas para el techo', 'Se cayo el techo del cuarto', 'alta', 3, 'Sector', 4.26, -75.93, 'Rita', '3155550004', '5793');
  perform set_config('prueba.id5', r.necesidad_id::text, true);
  perform set_config('prueba.codigo5', r.codigo, true);
  if not public._puede_adjuntar('solicitudes', r.necesidad_id || '/a.jpg') then raise exception 'FALLO: no deja subir a una necesidad nueva'; end if;
  if public._puede_adjuntar('solicitudes', '00000000-0000-0000-0000-000000000000/a.jpg') then raise exception 'FALLO: deja subir a una necesidad que no existe'; end if;
  if public._puede_adjuntar('solicitudes', r.necesidad_id || '/x/../a.jpg') then raise exception 'FALLO: acepta rutas raras'; end if;
  raise notice 'OK  se sube a una necesidad recien registrada y no a carpetas inventadas';
end $$;

reset role;
insert into storage.objects (bucket_id, name) values
  ('solicitudes', current_setting('prueba.id5') || '/1.jpg'),
  ('solicitudes', current_setting('prueba.id5') || '/2.jpg'),
  ('solicitudes', current_setting('prueba.id5') || '/3.jpg'),
  ('solicitudes-video', current_setting('prueba.id5') || '/v.mp4');
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$ begin
  if public._puede_adjuntar('solicitudes', current_setting('prueba.id5') || '/4.jpg') then raise exception 'FALLO: deja subir una cuarta foto'; end if;
  if public.registrar_adjuntos(current_setting('prueba.codigo5'),
       array[current_setting('prueba.id5') || '/1.jpg', current_setting('prueba.id5') || '/2.jpg', current_setting('prueba.id5') || '/no-existe.jpg'],
       current_setting('prueba.id5') || '/v.mp4') <> 3 then
    raise exception 'FALLO: no registro 2 fotos y el video';
  end if;
  if (select count(*) from public.adjuntos_solicitud where necesidad_id = current_setting('prueba.id5')::uuid) <> 2 then
    raise exception 'FALLO: el publico ve algo distinto a las 2 fotos';
  end if;
  raise notice 'OK  maximo 3 fotos; el publico ve las fotos pero no el video';
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000b"}', true);
do $$ begin
  if public.video_solicitud(current_setting('prueba.id5')::uuid) is not null then raise exception 'FALLO: un ayudante que no la atiende ve el video'; end if;
  perform public.tomar_necesidad(current_setting('prueba.id5')::uuid);
  if public.video_solicitud(current_setting('prueba.id5')::uuid) is null then raise exception 'FALLO: quien la atiende no ve el video'; end if;
  raise notice 'OK  el video solo lo ve quien atiende la necesidad';
end $$;
reset role;

-- Toques repetidos: la misma solicitud en minutos no se duplica.
do $$ begin
  perform public.registrar_necesidad('aseo', 'Pañales talla 3', 'Bebe de 8 meses necesita pañales', 'media', 3, 'Sector', 4.26, -75.93, 'Eva', '3175550002', '5793');
  perform public.registrar_necesidad('aseo', 'Pañales talla 3 ', 'bebe de 8 meses necesita pañales', 'media', 3, 'Sector', 4.26, -75.93, 'Eva', '3175550002', '5793');
  raise exception 'FALLO: se registro dos veces la misma solicitud';
exception when sqlstate 'P0001' then raise notice 'OK  un toque repetido no crea una solicitud duplicada';
end $$;

-- "Necesito mas tiempo": una vez por toma, solo quien atiende.
do $$ declare r record; begin
  select * into r from public.registrar_necesidad('agua', 'Agua potable', 'Necesitamos agua para tomar esta semana', 'media', 2, 'Sector', 4.26, -75.93, 'Teo', '3165550001', '5793');
  perform set_config('prueba.id3', r.necesidad_id::text, true);
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000a"}', true);
do $$ declare v_antes timestamptz; v_despues timestamptz; begin
  perform public.tomar_necesidad(current_setting('prueba.id3')::uuid);
  select vence_en into v_antes from public.necesidades where id = current_setting('prueba.id3')::uuid;
  perform public.extender_plazo(current_setting('prueba.id3')::uuid);
  select vence_en into v_despues from public.necesidades where id = current_setting('prueba.id3')::uuid;
  if v_despues - v_antes <> interval '24 hours' then raise exception 'FALLO: no sumo 24 horas'; end if;
  if not exists (select 1 from public.eventos_necesidad where necesidad_id = current_setting('prueba.id3')::uuid and tipo = 'plazo_extendido' and actor_alias = 'Ayudante A') then
    raise exception 'FALLO: no quedo en el historial';
  end if;
  raise notice 'OK  quien atiende pide 24 horas mas y queda en el historial';
end $$;

do $$ begin
  perform public.extender_plazo(current_setting('prueba.id3')::uuid);
  raise exception 'FALLO: se extendio dos veces en la misma toma';
exception when sqlstate 'P0001' then raise notice 'OK  solo se puede pedir mas tiempo una vez por toma';
end $$;

select set_config('request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-0000-0000-00000000000b"}', true);
do $$ begin
  perform public.extender_plazo(current_setting('prueba.id3')::uuid);
  raise exception 'FALLO: otra persona extendio el plazo';
exception when sqlstate 'P0001' then raise notice 'OK  nadie mas puede extender el plazo de una necesidad ajena';
end $$;

reset role;
do $$ begin
  -- Solo las filas de esta prueba: now() es la hora de inicio de la transaccion.
  if exists (select 1 from public.necesidades_privado pr join public.necesidades n on n.id = pr.necesidad_id
              where n.registrada_en = now()
                and (pr.clave_hash is null or pr.clave_hash !~ '^\$2[aby]\$' or pr.clave_hash like '%5793%')) then
    raise exception 'FALLO: hay claves sin hash bcrypt';
  end if;
  raise notice 'OK  las claves solo se guardan como hash bcrypt';
end $$;

rollback;
