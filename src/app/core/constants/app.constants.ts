

export const APP_CONSTANTS = {
  // Imágenes por defecto
  FOTO_PERFIL_DEFAULT: 'assets/img/user-default.png',
  LOGO_APP: 'assets/img/trueques.png',
  
  // Límites
  DIAS_LIMITE_CAMBIO_FOTO: 30,
  MAX_CARACTERES_BIOGRAFIA: 200,
  MIN_CARACTERES_NOMBRE: 3,
  
  // Calificaciones
  CALIFICACION_MINIMA: 0,
  CALIFICACION_MAXIMA: 5,
  CALIFICACION_INICIAL: 5,
  
  // Niveles de usuario
  NIVEL_BASICO: 0,
  NIVEL_ESTANDAR: 3,
  NIVEL_PREMIUM: 4.5,

  // Recompensas y Sistema de Puntos
  PUNTOS_PRIMER_TRUEQUE: 200,
  PUNTOS_TRUEQUE_NORMAL: 50,
  PUNTOS_VERIFICAR_CUENTA: 100,
  PUNTOS_REFERIR_AMIGO: 150,
  PUNTOS_BONO_CADA_10_TRUEQUES: 500,
  PUNTOS_BONO_REGISTRO: 100,

  // Mensajes
  MENSAJES: {
    PERFIL_ACTUALIZADO: '✅ Perfil actualizado correctamente',
    FOTO_ACTUALIZADA: '✅ Foto actualizada correctamente',
    ERROR_GENERICO: '❌ Ha ocurrido un error. Intenta nuevamente.',
    ERROR_AUTENTICACION: '❌ Debes iniciar sesión para continuar',
    REPORTE_ENVIADO: '✅ Reporte enviado. Te contactaremos pronto.',
    SESION_CERRADA: '✅ Sesión cerrada correctamente'
  }
};

// Tipos de insignias
export const INSIGNIAS = {
  PRIMER_TRUEQUE: {
    id: 'primer-trueque',
    nombre: 'Primer Trueque',
    emoji: '🎉',
    descripcion: 'Completaste tu primer trueque'
  },
  VERIFICADO: {
    id: 'verificado',
    nombre: 'Usuario Verificado',
    emoji: '✅',
    descripcion: 'Cuenta verificada'
  },
  COMERCIANTE: {
    id: 'comerciante',
    nombre: 'Comerciante',
    emoji: '🏆',
    descripcion: '10 trueques completados'
  },
  COLECCIONISTA: {
    id: 'coleccionista',
    nombre: 'Coleccionista',
    emoji: '🎁',
    descripcion: '25 trueques completados'
  },
  SOCIAL: {
    id: 'social',
    nombre: 'Social',
    emoji: '👥',
    descripcion: 'Alta interacción con otros usuarios'
  },
  EXPERTO: {
    id: 'experto',
    nombre: 'Experto',
    emoji: '💎',
    descripcion: '50 trueques completados'
  }
};

// Categorías de trueques
export const CATEGORIAS_TRUEQUE = [
  { id: 'electronica', nombre: 'Electrónica', icono: '📱', color: '#4A90E2' },
  { id: 'ropa', nombre: 'Ropa', icono: '👕', color: '#E94B3C' },
  { id: 'libros', nombre: 'Libros', icono: '📚', color: '#50E3C2' },
  { id: 'hogar', nombre: 'Hogar', icono: '🏠', color: '#F5A623' },
  { id: 'deportes', nombre: 'Deportes', icono: '⚽', color: '#7ED321' },
  { id: 'juguetes', nombre: 'Juguetes', icono: '🧸', color: '#BD10E0' },
  { id: 'mascotas', nombre: 'Mascotas', icono: '🐾', color: '#8B572A' },
  { id: 'otros', nombre: 'Otros', icono: '📦', color: '#9013FE' }
];

// Vouchers/Recompensas canjeables
export const VOUCHERS_CATALOGO = [
  {
    id: 'destacar-7dias',
    nombre: 'Destacar Publicación',
    descripcion: 'Tu artículo aparecerá primero en las búsquedas durante 7 días',
    emoji: '🌟',
    puntos: 100,
    duracion: 7,
    color: '#FFD700'
  },
  {
    id: 'premium-10fotos',
    nombre: 'Publicación Premium',
    descripcion: 'Publica hasta 10 fotos en un solo artículo',
    emoji: '📸',
    puntos: 50,
    color: '#4169E1'
  },
  {
    id: 'insignia-premium',
    nombre: 'Insignia Premium',
    descripcion: 'Obtén la insignia "Usuario Premium" visible en tu perfil por 30 días',
    emoji: '👑',
    puntos: 500,
    duracion: 30,
    color: '#9C27B0'
  },
  {
    id: 'estadisticas-avanzadas',
    nombre: 'Estadísticas Avanzadas',
    descripcion: 'Accede a métricas detalladas de tus trueques y perfil',
    emoji: '📊',
    puntos: 200,
    duracion: 30,
    color: '#00BCD4'
  },
  {
    id: 'envio-prioritario',
    nombre: 'Envío Prioritario',
    descripcion: 'Tus mensajes aparecerán destacados en las conversaciones',
    emoji: '⚡',
    puntos: 150,
    duracion: 15,
    color: '#FF9800'
  }
];

export default APP_CONSTANTS;