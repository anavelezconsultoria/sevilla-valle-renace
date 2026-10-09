import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Paso {
  readonly titulo: string;
  readonly texto: string;
}

@Component({
  selector: 'sr-como-funciona-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container pagina">
      <header class="encabezado">
        <p class="eyebrow">Cómo funciona</p>
        <h1>Una necesidad, una persona que ayuda, una ayuda que llega</h1>
      </header>
      <div class="columnas">
        @for (ruta of rutas; track ruta.titulo) {
          <section class="card ruta">
            <h2>{{ ruta.titulo }}</h2>
            <ol>
              @for (p of ruta.pasos; track p.titulo; let i = $index) {
                <li><span class="num">{{ i + 1 }}</span><div><h3>{{ p.titulo }}</h3><p class="muted">{{ p.texto }}</p></div></li>
              }
            </ol>
            <a [routerLink]="ruta.enlace" [class]="'btn ' + ruta.clase">{{ ruta.cta }}</a>
          </section>
        }
      </div>
      <section class="card privacidad">
        <h2>Tus datos están protegidos</h2>
        <p class="muted">En el mapa público nunca aparece tu nombre, tu teléfono ni tu casa: solo un punto aproximado a unos 200 metros. Tu contacto lo ve únicamente la persona que tome tu solicitud. Las fotos de entrega no muestran rostros y se les quita la ubicación antes de subirlas.</p>
      </section>
    </div>
  `,
  styles: `
    .pagina { padding-block: var(--space-6); display: grid; gap: var(--space-5); }
    .encabezado h1 { font-size: var(--text-2xl); max-width: 760px; margin-top: 6px; }
    .columnas { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
    .ruta { padding: var(--space-5); display: grid; gap: var(--space-4); align-content: start; }
    h2 { font-family: var(--font-body); font-weight: 700; font-size: var(--text-lg); }
    ol { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-4); }
    li { display: grid; grid-template-columns: 32px 1fr; gap: var(--space-3); }
    .num { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--color-primario); color: #fff; font-weight: 700; }
    h3 { font-size: var(--text-md); margin-bottom: 2px; }
    .ruta .btn { justify-self: start; }
    .privacidad { padding: var(--space-5); display: grid; gap: var(--space-2); background: var(--color-arena); border-color: var(--color-linea-fuerte); }
    @media (max-width: 860px) { .columnas { grid-template-columns: 1fr; } }
  `,
})
export class ComoFuncionaPage {
  protected readonly rutas: readonly { titulo: string; pasos: readonly Paso[]; enlace: string; cta: string; clase: string }[] = [
    {
      titulo: 'Si necesitas ayuda',
      enlace: '/pedir-ayuda',
      cta: 'Pedir ayuda',
      clase: 'btn-accion',
      pasos: [
        { titulo: 'Registra tu necesidad', texto: 'Sin crear cuenta. Toma menos de dos minutos.' },
        { titulo: 'Guarda tu código', texto: 'Con él sigues tu solicitud. Puedes guardarlo en WhatsApp.' },
        { titulo: 'Alguien la toma', texto: 'Te contactará para coordinar la entrega.' },
        { titulo: 'Confirma que llegó', texto: 'Con tu código. Si no respondes en 48 horas, se cierra como atendida.' },
      ],
    },
    {
      titulo: 'Si quieres ayudar',
      enlace: '/necesidades',
      cta: 'Ver necesidades',
      clase: 'btn-primary',
      pasos: [
        { titulo: 'Elige una necesidad', texto: 'En el mapa o en el tablero, empezando por las más urgentes.' },
        { titulo: 'Tómala', texto: 'Solo pedimos un nombre público y tu correo. Verás el contacto de la familia.' },
        { titulo: 'Entrégala en 48 horas', texto: 'Si no puedes, libérala para que otra persona la tome.' },
        { titulo: 'Registra la entrega', texto: 'Una nota y, si quieres, una foto sin rostros de lo que llevaste.' },
      ],
    },
  ];
}
