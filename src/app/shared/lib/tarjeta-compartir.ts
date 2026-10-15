import { Necesidad } from '../../core/domain/necesidad.model';
import { esGestionExterna, infoCategoria } from '../../core/domain/catalogos';
import { tiempoRelativo } from './tiempo';

/**
 * Imagenes para compartir en WhatsApp e Instagram, dibujadas en el celular (canvas).
 * NUNCA llevan nombre, celular ni ubicacion exacta: solo lo que ya es publico en la
 * pagina. Quien quiera ayudar entra al enlace, toma la necesidad y ahi recibe el contacto.
 */

const MARCA = '"Krona One", system-ui, sans-serif';
const TEXTO = '"Inter Variable", Inter, system-ui, sans-serif';
const AZUL = '#2b4cf2';
const MORADO = '#6a4fe0';
/** Color de lo que espera ayuda: el azul de accion de la marca. */
const ESPERA = '#1d37cc';
const TINTA = '#15132b';
const TENUE = '#5f5c7e';
const DOMINIO = 'sevillarenace.anavelezconsultora.com';
const BROTE = {
  tallo: 'M32 49V29',
  hojaDerecha: 'M32 33c0-9 7-15 16-15 0 9-7 15-16 15z',
  hojaIzquierda: 'M32 29c0-7-5-12-13-12 0 7 5 12 13 12z',
  base: 'M17 50h30',
};

interface Lienzo {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
}

async function prepararLienzo(ancho: number, alto: number): Promise<Lienzo> {
  await Promise.all([document.fonts.load(`40px ${MARCA}`), document.fonts.load(`700 40px ${TEXTO}`), document.fonts.load(`400 40px ${TEXTO}`)]);
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este celular no permite crear la imagen.');
  const fondo = ctx.createLinearGradient(0, 0, ancho, alto);
  fondo.addColorStop(0, '#f3efff');
  fondo.addColorStop(0.55, '#fbfaff');
  fondo.addColorStop(1, '#eaefff');
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, ancho, alto);
  return { canvas, ctx };
}

function rectRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Simbolo de Sevilla Renace (el brote) + nombre. */
function dibujarMarca(ctx: CanvasRenderingContext2D, x: number, y: number, escala: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(escala, escala);
  ctx.fillStyle = AZUL;
  rectRedondo(ctx, 0, 0, 64, 64, 16);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke(new Path2D(BROTE.tallo));
  ctx.fillStyle = '#d7bafc';
  ctx.fill(new Path2D(BROTE.hojaDerecha));
  ctx.fillStyle = '#ffffff';
  ctx.fill(new Path2D(BROTE.hojaIzquierda));
  ctx.strokeStyle = '#d7bafc';
  ctx.stroke(new Path2D(BROTE.base));
  ctx.restore();
  ctx.font = `${Math.round(30 * escala)}px ${MARCA}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TINTA;
  const medio = y + 32 * escala;
  ctx.fillText('Sevilla', x + 80 * escala, medio);
  ctx.fillStyle = AZUL;
  ctx.fillText('Renace', x + 80 * escala + ctx.measureText('Sevilla').width, medio);
  ctx.textBaseline = 'alphabetic';
}

/** Parte un texto en lineas que caben en el ancho; corta con "..." si pasa del maximo. */
function lineas(ctx: CanvasRenderingContext2D, texto: string, ancho: number, maximo: number): string[] {
  const palabras = texto.replace(/\s+/g, ' ').trim().split(' ');
  const resultado: string[] = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (ctx.measureText(prueba).width <= ancho) {
      actual = prueba;
      continue;
    }
    if (actual) resultado.push(actual);
    actual = palabra;
    if (resultado.length === maximo) break;
  }
  if (resultado.length < maximo && actual) resultado.push(actual);
  if (resultado.length === maximo && palabras.join(' ').length > resultado.join(' ').length) {
    let ultima = resultado[maximo - 1]!;
    while (ctx.measureText(`${ultima}...`).width > ancho && ultima.length > 1) ultima = ultima.slice(0, -1);
    resultado[maximo - 1] = `${ultima}...`;
  }
  return resultado;
}

function pildora(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, fondo: string, color: string): number {
  ctx.font = `700 28px ${TEXTO}`;
  const ancho = ctx.measureText(texto).width + 48;
  ctx.fillStyle = fondo;
  rectRedondo(ctx, x, y, ancho, 56, 28);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.fillText(texto, x + 24, y + 29);
  ctx.textBaseline = 'alphabetic';
  return ancho;
}

/** Icono de la categoria en un circulo de color. */
function iconoCategoria(ctx: CanvasRenderingContext2D, n: Necesidad, x: number, y: number, tamano: number): void {
  const info = infoCategoria(n.categoria);
  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.arc(x + tamano / 2, y + tamano / 2, tamano / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  const escala = (tamano * 0.56) / 24;
  ctx.translate(x + tamano * 0.22, y + tamano * 0.22);
  ctx.scale(escala, escala);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(info.icono));
  ctx.restore();
}

async function cargarImagen(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => resolver(null);
    img.src = src;
  });
}

/** Pie: llamado a la accion con el dominio y la firma de Ana Velez (solo el logo). */
async function dibujarPie(ctx: CanvasRenderingContext2D, ancho: number, y: number, llamado: string): Promise<void> {
  ctx.fillStyle = AZUL;
  rectRedondo(ctx, 60, y, ancho - 120, 190, 36);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 36px ${TEXTO}`;
  ctx.fillText(llamado, 100, y + 74);
  ctx.font = `30px ${MARCA}`;
  ctx.fillText(DOMINIO, 100, y + 140);
  const logo = await cargarImagen('ana-velez-logo.png');
  ctx.fillStyle = TENUE;
  ctx.font = `400 26px ${TEXTO}`;
  ctx.textAlign = 'right';
  if (logo) {
    const alto = 120;
    const anchoLogo = (logo.width / logo.height) * alto;
    ctx.drawImage(logo, ancho - 60 - anchoLogo, y + 210, anchoLogo, alto);
    ctx.fillText('Una iniciativa de', ancho - 76 - anchoLogo, y + 280);
  }
  ctx.textAlign = 'left';
}

function aBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolver, rechazar) =>
    canvas.toBlob((b) => (b ? resolver(b) : rechazar(new Error('No se pudo crear la imagen.'))), 'image/png'),
  );
}

/** Tarjeta de UNA necesidad (1080x1350, formato de publicacion). */
export async function tarjetaNecesidad(n: Necesidad): Promise<Blob> {
  const ANCHO = 1080;
  const { canvas, ctx } = await prepararLienzo(ANCHO, 1350);
  dibujarMarca(ctx, 60, 60, 1);

  let x = 60;
  x += pildora(ctx, 'NECESITA AYUDA', x, 170, ESPERA, '#ffffff') + 14;
  if (n.prioridadCero) pildora(ctx, 'PRIORIDAD 0 · BEBÉS O ADULTOS MAYORES', x, 170, '#f1ecff', MORADO);

  iconoCategoria(ctx, n, 60, 270, 96);
  ctx.fillStyle = MORADO;
  ctx.font = `700 30px ${TEXTO}`;
  ctx.fillText(infoCategoria(n.categoria).etiqueta.toUpperCase(), 180, 330);

  ctx.fillStyle = TINTA;
  ctx.font = `62px ${MARCA}`;
  let y = 450;
  for (const linea of lineas(ctx, n.titulo, ANCHO - 120, 3)) {
    ctx.fillText(linea, 60, y);
    y += 78;
  }

  ctx.fillStyle = TENUE;
  ctx.font = `400 34px ${TEXTO}`;
  y += 10;
  for (const linea of lineas(ctx, n.descripcion, ANCHO - 120, 4)) {
    ctx.fillText(linea, 60, y);
    y += 50;
  }

  y += 30;
  const datos = [
    `Sector: ${n.sector}`,
    `${n.personasHogar} ${n.personasHogar === 1 ? 'persona' : 'personas'} en el hogar`,
    `Registrada ${tiempoRelativo(n.registradaEn)}`,
  ];
  ctx.fillStyle = TINTA;
  ctx.font = `600 32px ${TEXTO}`;
  for (const dato of datos) {
    ctx.fillText(`•  ${dato}`, 60, y);
    y += 50;
  }
  if (esGestionExterna(n.categoria)) {
    ctx.fillStyle = TENUE;
    ctx.font = `400 28px ${TEXTO}`;
    ctx.fillText('Materiales: se gestionan con entidades externas y pueden tardar más.', 60, y + 4);
  }

  await dibujarPie(ctx, ANCHO, 1010, '¿Puedes ayudar? Entra y tómala en');
  return aBlob(canvas);
}

/** "Hoy necesitan": lista del dia (1080x1920, formato de estado e historia). */
export async function tarjetaListaHoy(necesidades: readonly Necesidad[], total: number): Promise<Blob> {
  const ANCHO = 1080;
  const { canvas, ctx } = await prepararLienzo(ANCHO, 1920);
  dibujarMarca(ctx, 60, 150, 1);

  ctx.fillStyle = TINTA;
  ctx.font = `66px ${MARCA}`;
  ctx.fillText('Hoy en Sevilla', 60, 340);
  ctx.fillStyle = ESPERA;
  ctx.fillText('necesitan', 60, 420);
  ctx.fillStyle = TENUE;
  ctx.font = `400 34px ${TEXTO}`;
  ctx.fillText(`${total} ${total === 1 ? 'necesidad espera' : 'necesidades esperan'} ayuda. Elige una y llévala.`, 60, 486);

  let y = 540;
  const ALTO = 150;
  for (const n of necesidades) {
    ctx.fillStyle = '#ffffff';
    rectRedondo(ctx, 60, y, ANCHO - 120, ALTO - 18, 28);
    ctx.fill();
    iconoCategoria(ctx, n, 86, y + 22, 88);
    ctx.fillStyle = TINTA;
    ctx.font = `700 36px ${TEXTO}`;
    ctx.fillText(lineas(ctx, n.titulo, ANCHO - 360, 1)[0] ?? '', 200, y + 62);
    ctx.fillStyle = TENUE;
    ctx.font = `400 28px ${TEXTO}`;
    const detalle = `${n.sector} · ${n.personasHogar} ${n.personasHogar === 1 ? 'persona' : 'personas'}`;
    ctx.fillText(lineas(ctx, detalle, ANCHO - 360, 1)[0] ?? '', 200, y + 104);
    if (n.prioridadCero) {
      ctx.fillStyle = ESPERA;
      ctx.font = `800 24px ${TEXTO}`;
      ctx.textAlign = 'right';
      ctx.fillText('PRIORIDAD 0', ANCHO - 90, y + 62);
      ctx.textAlign = 'left';
    }
    y += ALTO;
  }
  const restantes = total - necesidades.length;
  if (restantes > 0) {
    ctx.fillStyle = MORADO;
    ctx.font = `700 32px ${TEXTO}`;
    ctx.fillText(`y ${restantes} más en la página`, 60, y + 30);
  }

  await dibujarPie(ctx, ANCHO, 1500, 'Entra, elige una y tómala en');
  return aBlob(canvas);
}

export interface Compartible {
  readonly imagen: Blob;
  readonly archivo: string;
  readonly texto: string;
}

/**
 * Comparte la imagen con el menu del celular (WhatsApp, Instagram...). Si el
 * navegador no lo permite, descarga la imagen y abre WhatsApp con el texto.
 */
export async function compartirImagen({ imagen, archivo, texto }: Compartible): Promise<void> {
  const file = new File([imagen], archivo, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: texto });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(imagen);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = archivo;
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
}
