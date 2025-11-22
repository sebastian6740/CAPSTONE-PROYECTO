// ============================================
// MODELOS PARA SISTEMA DE PUNTOS Y RECOMPENSAS
// ============================================

/**
 * Transacción de puntos (historial)
 * Registra cada ganancia o gasto de puntos del usuario
 */
export interface TransaccionPuntos {
  id: string;
  usuarioId: string;
  tipo: 'ganado' | 'gastado' | 'expirado' | 'bonificacion';
  cantidad: number;
  motivo: string; // Ej: "Trueque completado", "Voucher canjeado", "Bono de bienvenida"
  articuloRelacionado?: string; // ID del artículo si aplica
  voucherRelacionado?: string; // ID del voucher si aplica
  fecha: Date;
  saldoAnterior: number;
  saldoNuevo: number;
}

/**
 * Voucher/Recompensa canjeable
 * Define los beneficios que los usuarios pueden obtener con puntos
 */
export interface Voucher {
  id: string;
  nombre: string;
  descripcion: string;
  emoji: string;
  puntosNecesarios: number;
  tipo: 'destacar' | 'premium' | 'beneficio' | 'insignia';
  activo: boolean;
  stock?: number; // Cantidad disponible (undefined = ilimitado)
  duracionDias?: number; // Duración del beneficio en días
  imagen?: string;
  color?: string; // Color para la tarjeta del voucher
}

/**
 * Voucher canjeado por un usuario
 * Registra los vouchers que el usuario ha obtenido
 */
export interface VoucherCanjeado {
  id: string;
  voucherId: string;
  voucher: Voucher; // Copia del voucher al momento del canje
  usuarioId: string;
  fechaCanje: Date;
  fechaExpiracion?: Date;
  usado: boolean;
  fechaUso?: Date;
  codigo?: string; // Código único del voucher
  articuloAplicado?: string; // ID del artículo donde se usó (si aplica)
}

/**
 * Configuración de reglas de puntos
 * Define cuántos puntos se otorgan por cada acción
 */
export interface ReglasPuntos {
  primerTrueque: number;
  truequeCompletado: number;
  verificarCuenta: number;
  referirAmigo: number;
  cada10Trueques: number;
  bonoRegistro: number;
}

/**
 * Estadísticas de puntos del usuario
 */
export interface EstadisticasPuntos {
  puntosGanados: number;
  puntosGastados: number;
  puntosActuales: number;
  voucherCanjeados: number;
  transacciones: number;
  ultimaTransaccion?: Date;
}
