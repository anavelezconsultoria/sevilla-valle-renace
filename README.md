# Sevilla Renace

Plataforma comunitaria de Sevilla, Valle del Cauca. Cualquier persona registra una necesidad, otra la atiende, y queda constancia de que la ayuda llegó.

Está pensada para las familias afectadas por el terremoto y para personas en situación de vulnerabilidad. Une en una sola página el mapa de necesidades, el tablero para quienes ayudan, el seguimiento de cada caso y el registro público de ayudas entregadas.

> Estado: **modo demostración**. Los datos son ficticios y se guardan solo en el navegador. El backend real (Supabase) está especificado y en construcción.

## Cómo funciona

1. **Pedir ayuda** sin crear cuenta. Al registrar la necesidad se recibe un código de seguimiento.
2. **Atender**: quien ayuda se identifica con un alias y su correo y toma la necesidad. Solo entonces ve el contacto y la ubicación exacta.
3. **Entregar**: se registra la entrega con una nota y, si se quiere, hasta 3 fotos sin rostros.
4. **Confirmar**: quien pidió la ayuda la confirma con su código. Si no responde en 48 horas, se cierra como atendida.
5. Si quien tomó la necesidad no la entrega en 48 horas, vuelve a la lista para otra persona.

## Privacidad por diseño

- El nombre, el teléfono y la ubicación exacta nunca son públicos.
- El punto que se muestra en el mapa está desplazado entre 150 y 300 metros.
- Las fotos se reducen en el celular y se les quitan los metadatos, incluida la ubicación GPS, antes de subirlas.
- El código de seguimiento se muestra una sola vez; el backend solo guarda su hash.

## Stack

- Angular 22 (sin zone.js, Signal Forms, componentes standalone y rutas con carga diferida).
- Leaflet con teselas de OpenStreetMap.
- Arquitectura por puertos: las pantallas dependen de interfaces (`core/ports`). Hoy las implementa `DemoBackend`; el adaptador de Supabase se conecta sin tocar la UI.
- Pruebas con Vitest y E2E con Playwright.

Requiere **Node 22.22 o superior** (o Node 24).

```bash
npm install
npx ng serve --port 4600 --host 127.0.0.1
npx ng test --watch=false
npx ng build
```

## Estructura

```
src/app/
  core/domain/        Modelo, catálogos, ciclo de vida y privacidad (TypeScript puro)
  core/ports/         Contratos que usan las pantallas
  core/application/   Casos de uso puros (filtrar y ordenar)
  infrastructure/     Implementaciones de los puertos (demo; Supabase después)
  shared/             Mapa, componentes de UI y utilidades
  features/           Una carpeta por pantalla
  layout/             Header, navegación móvil, aviso de demo y footer
docs/ESPECIFICACION.md  Especificación funcional y técnica
```

---

Desarrollado por [Ana Vélez](https://anavelezconsultora.com) · Consultoría · Software · Tecnología
