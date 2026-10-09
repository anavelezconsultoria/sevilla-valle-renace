import { LARGOS, validarLargo } from './validaciones';
import { mensajeParaPersona } from '../../infrastructure/supabase/errores-base';

describe('Validacion de largo igual a la base', () => {
  it('mide sin espacios al inicio ni al final, como btrim en Postgres', () => {
    expect(validarLargo('a ', LARGOS.nombre)?.kind).toBe('corto');
    expect(validarLargo('  ', LARGOS.nombre)?.kind).toBe('requerido');
    expect(validarLargo('Ana', LARGOS.nombre)).toBeNull();
  });

  it('rechaza textos mas largos que el limite de la base', () => {
    expect(validarLargo('x'.repeat(81), LARGOS.titulo)?.kind).toBe('largo');
  });
});

describe('Errores de la base para la persona', () => {
  it('traduce una restriccion conocida a un mensaje claro', () => {
    const mensaje = mensajeParaPersona({
      message: 'new row for relation "necesidades_privado" violates check constraint "necesidades_privado_nombre_check"',
      code: '23514',
    });
    expect(mensaje).toBe('El nombre debe tener entre 2 y 80 letras.');
  });

  it('nunca muestra texto tecnico de restricciones desconocidas', () => {
    const mensaje = mensajeParaPersona({ message: 'violates check constraint "otra_cosa"', code: '23514' });
    expect(mensaje).not.toContain('constraint');
  });

  it('conserva los mensajes de negocio que ya vienen en espanol', () => {
    expect(mensajeParaPersona({ message: 'Otra persona ya la tomó o cambió de estado.', code: 'P0001' })).toBe(
      'Otra persona ya la tomó o cambió de estado.',
    );
  });
});
