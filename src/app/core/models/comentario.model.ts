/**
 * Modelo de Comentario y Calificación
 */
export interface Comentario {
  id: string;
  usuarioId: string; // ID del usuario que comenta
  usuarioCalificadoId: string; // ID del usuario que recibe el comentario
  nombre: string; // Nombre del usuario que comenta
  foto?: string; // Foto del usuario que comenta
  calificacion: number; // De 1 a 5 estrellas
  comentario: string; // Texto del comentario
  fecha: Date; // Fecha del comentario
  articuloRelacionadoId?: string; // Artículo relacionado (opcional)
  articuloNombre?: string; // Nombre del artículo relacionado
}

/**
 * DTO para crear un nuevo comentario
 */
export interface CrearComentarioDTO {
  usuarioCalificadoId: string;
  calificacion: number;
  comentario: string;
  articuloRelacionadoId?: string;
}

/**
 * Estadísticas de calificaciones de un usuario
 */
export interface EstadisticasCalificacion {
  totalComentarios: number;
  promedioCalificacion: number;
  estrellas5: number;
  estrellas4: number;
  estrellas3: number;
  estrellas2: number;
  estrellas1: number;
}
