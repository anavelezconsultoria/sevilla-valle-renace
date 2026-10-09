# Sevilla Renace — Especificación v1

Plataforma pública para que cualquier persona de Sevilla (Valle del Cauca) registre una necesidad, otra persona la atienda y quede constancia de que la ayuda llegó.

Una sola página centraliza todo: el mapa, el tablero de necesidades, el seguimiento de quien atiende y el registro de ayudas entregadas.

## 1. Principios

1. **Abierta e intuitiva.** Registrar una necesidad no exige cuenta. El formulario cabe en una pantalla de celular y funciona con poca señal.
2. **La dignidad va primero.** Ningún dato que identifique a una familia es público: ni nombre, ni teléfono, ni ubicación exacta. Las fotos de evidencia no muestran rostros.
3. **Cada ayuda deja rastro.** Todo cambio de estado queda en un historial inmutable: quién, cuándo y con qué nota o evidencia.
4. **Nada se queda colgado.** Toda necesidad avanza sola si las personas no actúan: se libera si nadie la entrega y se cierra si nadie confirma.
5. **Pocas piezas.** Frontend estático y un solo servicio de backend (Supabase). Costo $0 en la fase inicial.

## 2. Actores

| Actor | Necesita cuenta | Qué hace |
|---|---|---|
| Visitante | No | Ve el mapa, el tablero, las cifras y las ayudas entregadas |
| Solicitante | No | Registra una necesidad y recibe un **código de seguimiento**. Con ese código consulta el estado y confirma que recibió la ayuda |
| Ayudante | Sí (enlace al correo) | Toma una necesidad, la entrega, sube evidencia opcional y ve su tablero de seguimiento |
| Coordinación | Sí, con rol | Oculta contenido inapropiado y fusiona duplicados. Rol mínimo en v1 |

## 3. Ciclo de vida de una necesidad

```
                 tomar (ayudante)              entregar (ayudante)
  REGISTRADA ─────────────────────▶ EN_ATENCION ─────────────────────▶ ENTREGADA
     │   ▲                              │                                 │
     │   └──── liberar / vence 48 h ────┘                                 │ confirmar (solicitante)
     │                                                                    │ o vencen 48 h
     │ cancelar (solicitante)                                             ▼
     ▼                                                                ATENDIDA
  CANCELADA                                                (confirmada | cerrada_automaticamente)
```

| Transición | Quién | Regla |
|---|---|---|
| registrar → `registrada` | Cualquiera | Se genera el código de seguimiento; solo se muestra una vez |
| `registrada` → `en_atencion` | Ayudante | Una necesidad tiene a lo sumo un ayudante activo; la toma es atómica |
| `en_atencion` → `registrada` | Ayudante o sistema | El ayudante la libera, o pasan 48 h sin entregarla |
| `en_atencion` → `entregada` | El ayudante asignado | Evidencia opcional: hasta 3 fotos sin rostros y una nota |
| `entregada` → `atendida` | Solicitante (código) o sistema | El solicitante confirma, o pasan 48 h sin respuesta y se cierra como `cerrada_automaticamente` |
| `entregada` → `en_atencion` | Solicitante (código) | "No la recibí": vuelve al ayudante con una nota |
| `registrada` → `cancelada` | Solicitante (código) | Ya no la necesita |

Las transiciones viven en funciones de la base (`security definer`), no en el cliente. El cliente no puede escribir `estado` directamente.

## 4. Datos

### Públicos (cualquiera los lee)

- Categoría, descripción, urgencia, personas en el hogar, sector (vereda o barrio).
- **Ubicación aproximada**: el punto exacto desplazado al azar entre 150 y 300 m.
- Estado, fechas de cada transición y alias del ayudante.
- Fotos de evidencia de necesidades `atendida`.

### Privados (solo el ayudante asignado y coordinación)

- Nombre y teléfono de contacto, ubicación exacta, referencias para llegar.

### Nunca se guarda

- El código de seguimiento en claro: solo su hash.
- Documento de identidad. No hace falta en v1 y es el dato que más riesgo legal trae.
- Metadatos EXIF de las fotos: el cliente los elimina, incluida la ubicación GPS, antes de subirlas.

## 5. Modelo

- `necesidades`: datos públicos, estado y ubicación aproximada.
- `necesidades_privado`: contacto y ubicación exacta (1:1, con RLS restrictiva).
- `eventos_necesidad`: historial inmutable de transiciones (solo `insert`).
- `evidencias`: rutas de las fotos en Storage, ligadas a un evento.
- `perfiles`: alias público del ayudante, teléfono opcional y rol.
- Vista `cifras_publicas`: totales por estado, categoría y sector.

## 6. Pantallas

1. **Mapa** (inicio): mapa de Sevilla con las necesidades activas por categoría, tarjeta de cifras, buscador por sector y lista lateral. Botones principales: **Necesito ayuda** y **Quiero ayudar**.
2. **Tablero de necesidades**: tarjetas filtrables por categoría, urgencia, sector y estado, con mapa opcional.
3. **Registrar necesidad**: un paso con categoría, descripción, personas, sector, punto en el mapa (o "usar mi ubicación") y contacto. Al final, el código de seguimiento con un botón para guardarlo o compartirlo por WhatsApp.
4. **Seguimiento por código**: estado y línea de tiempo. Botones: confirmar recibido, no la recibí, cancelar.
5. **Detalle de necesidad**: línea de tiempo pública y botón **Atender esta necesidad**.
6. **Mis atenciones** (ayudante): lo que tomé, lo que entregué y lo que está por vencer.
7. **Ayudas entregadas**: el registro público de atenciones con evidencias. Es la memoria del proceso.

## 7. Abierto para decidir

- [ ] Catálogo oficial de veredas y barrios de Sevilla. Por ahora es texto libre más el punto en el mapa.
- [ ] ¿Las fotos de evidencia son públicas o solo para coordinación? Propuesta: públicas, sin rostros, con botón para reportar.
- [ ] Perfil de persona beneficiaria para controlar entregas repetidas (v2).
- [ ] Dominio: `sevillarenace.anavelezconsultora.com` o dominio propio.

## 8. Pruebas

| Capa | Qué se prueba |
|---|---|
| Base de datos | Cada transición válida pasa y cada transición inválida falla. El rol anónimo no lee `necesidades_privado`. Los vencimientos de 48 h cierran y liberan |
| Unidad | Desplazamiento de coordenadas, limpieza de EXIF y reducción de imágenes, mapeo de estados a etiquetas |
| E2E (Playwright) | Registrar, tomar, entregar, confirmar con el código y ver la ayuda en el registro, en escritorio y celular |
| Privacidad | Ninguna respuesta pública contiene teléfono, nombre ni coordenadas exactas |
