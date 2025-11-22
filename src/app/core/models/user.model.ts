// src/app/core/models/user.model.ts

/**
 * Modelo principal de Usuario
 */
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  contrasena: string;
  telefono: string;
  ciudad: string;
  foto?: string; // URL de la foto o DataURL (foto aprobada)
  foto_pendiente?: string; // Foto pendiente de revisión por admin
  estado_foto?: 'aprobada' | 'pendiente' | 'rechazada'; // Estado de la foto
  fechaRegistro: Date;
  calificacion: number; // De 0 a 5
  biografia?: string;
  trueques_realizados: number;
  trueques_pendientes: number;
  recompensas: number; // Puntos acumulados
  insignias: string[]; // IDs de las insignias obtenidas
  verificado: boolean;
  ultima_actualizacion_foto?: Date;
  ultima_actualizacion_perfil: Date;
  rol?: 'user' | 'admin'; // Rol del usuario (opcional para compatibilidad con usuarios existentes)
}

/**
 * DTO para actualizar el perfil del usuario
 */
export interface ActualizarPerfilDTO {
  nombre: string;
  telefono: string;
  ciudad: string;
  biografia?: string;
}

/**
 * Respuesta al actualizar perfil
 */
export interface RespuestaActualizacion {
  exito: boolean;
  mensaje: string;
  usuario?: Usuario;
}

/**
 * DTO para actualizar foto de perfil
 */
export interface ActualizarFotoDTO {
  foto: string; // DataURL o URL de la foto
}

/**
 * Respuesta al actualizar foto
 */
export interface RespuestaFoto {
  exito: boolean;
  mensaje: string;
  foto_url?: string;
}

/**
 * Datos de registro de nuevo usuario
 */
export interface RegistroUsuarioDTO {
  nombre: string;
  email: string;
  contrasena: string;
  confirmarContrasena: string;
  telefono: string;
  ciudad: string;
}

/**
 * Datos de login
 */
export interface LoginDTO {
  email: string;
  contrasena: string;
}

/**
 * Respuesta genérica de operaciones
 */
export interface RespuestaGenerica {
  exito: boolean;
  mensaje: string;
  data?: any;
}

/**
 * Modelo de Insignia
 */
export interface Insignia {
  id: string;
  nombre: string;
  emoji: string;
  descripcion: string;
  requisito?: string;
}

/**
 * Estadísticas del usuario
 */
export interface EstadisticasUsuario {
  trueques_totales: number;
  trueques_exitosos: number;
  trueques_cancelados: number;
  calificacion_promedio: number;
  total_recompensas: number;
  nivel: 'Básico' | 'Estándar' | 'Premium';
  insignias_obtenidas: number;
  dias_activo: number;
}

/**
 * Perfil público del usuario (sin datos sensibles)
 */
export interface PerfilPublico {
  id: string;
  nombre: string;
  foto?: string;
  ciudad: string;
  calificacion: number;
  trueques_realizados: number;
  insignias: string[];
  verificado: boolean;
  miembro_desde: Date;
}

/**
 * Configuración de privacidad del usuario
 */
export interface ConfiguracionPrivacidad {
  mostrar_email: boolean;
  mostrar_telefono: boolean;
  mostrar_ciudad: boolean;
  permitir_mensajes_directos: boolean;
  notificaciones_push: boolean;
  notificaciones_email: boolean;
}

/**
 * Historial de cambios del usuario
 */
export interface HistorialCambio {
  id: string;
  usuario_id: string;
  tipo: 'perfil' | 'foto' | 'configuracion';
  campo_modificado?: string;
  fecha: Date;
  ip?: string;
}