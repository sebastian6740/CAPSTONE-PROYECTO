import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  TransaccionPuntos,
  Voucher,
  VoucherCanjeado,
  ReglasPuntos,
  EstadisticasPuntos
} from '../models/recompensas.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class RecompensasService {

  // Storage keys
  private readonly TRANSACCIONES_KEY = 'transacciones_puntos';
  private readonly VOUCHERS_CANJEADOS_KEY = 'vouchers_canjeados';

  // Reglas de puntos
  private reglasPuntos: ReglasPuntos = {
    primerTrueque: 200,
    truequeCompletado: 50,
    verificarCuenta: 100,
    referirAmigo: 150,
    cada10Trueques: 500,
    bonoRegistro: 100
  };

  // Catálogo de vouchers disponibles
  private vouchersDisponibles: Voucher[] = [
    // ========================================
    // BENEFICIOS INTERNOS DE LA APP
    // ========================================
    {
      id: 'destacar-7dias',
      nombre: 'Destacar Publicación',
      descripcion: 'Tu artículo aparecerá primero en las búsquedas durante 7 días',
      emoji: '🌟',
      puntosNecesarios: 100,
      tipo: 'destacar',
      activo: true,
      duracionDias: 7,
      color: '#FFD700'
    },
    {
      id: 'premium-10fotos',
      nombre: 'Publicación Premium',
      descripcion: 'Publica hasta 10 fotos en un solo artículo',
      emoji: '📸',
      puntosNecesarios: 50,
      tipo: 'premium',
      activo: true,
      color: '#4169E1'
    },
    {
      id: 'insignia-premium-30dias',
      nombre: 'Insignia Premium',
      descripcion: 'Obtén la insignia "Usuario Premium" visible en tu perfil por 30 días',
      emoji: '👑',
      puntosNecesarios: 500,
      tipo: 'insignia',
      activo: true,
      duracionDias: 30,
      color: '#9C27B0'
    },

    // ========================================
    // GIFT CARDS DE TIENDAS EXTERNAS
    // ========================================
    {
      id: 'amazon-5usd',
      nombre: 'Amazon Gift Card $5',
      descripcion: 'Tarjeta de regalo de Amazon por $5 USD. Código digital entregado al instante',
      emoji: '🛒',
      puntosNecesarios: 5000,
      tipo: 'beneficio',
      activo: true,
      stock: 10, // Cantidad disponible (el admin debe gestionarlo)
      color: '#FF9900'
    },
    {
      id: 'amazon-10usd',
      nombre: 'Amazon Gift Card $10',
      descripcion: 'Tarjeta de regalo de Amazon por $10 USD. Código digital entregado al instante',
      emoji: '🛒',
      puntosNecesarios: 9500,
      tipo: 'beneficio',
      activo: true,
      stock: 5,
      color: '#FF9900'
    },
    {
      id: 'aliexpress-5usd',
      nombre: 'AliExpress Cupón $5',
      descripcion: 'Cupón de descuento de $5 USD para AliExpress. Válido en compras mayores a $10',
      emoji: '🛍️',
      puntosNecesarios: 4500,
      tipo: 'beneficio',
      activo: true,
      stock: 8,
      duracionDias: 90,
      color: '#FF6A00'
    },
    {
      id: 'steam-10usd',
      nombre: 'Steam Gift Card $10',
      descripcion: 'Tarjeta de regalo de Steam por $10 USD. Para comprar juegos y contenido',
      emoji: '🎮',
      puntosNecesarios: 9500,
      tipo: 'beneficio',
      activo: true,
      stock: 3,
      color: '#1B2838'
    },
    {
      id: 'googleplay-5usd',
      nombre: 'Google Play $5',
      descripcion: 'Tarjeta de Google Play por $5 USD. Para apps, juegos, películas y más',
      emoji: '📱',
      puntosNecesarios: 5000,
      tipo: 'beneficio',
      activo: true,
      stock: 6,
      color: '#3DDC84'
    },
    {
      id: 'netflix-basico-1mes',
      nombre: 'Netflix Básico 1 Mes',
      descripcion: 'Suscripción Netflix plan básico por 1 mes. Disfruta películas y series',
      emoji: '🎬',
      puntosNecesarios: 8000,
      tipo: 'beneficio',
      activo: true,
      stock: 2,
      duracionDias: 30,
      color: '#E50914'
    },
    {
      id: 'spotify-premium-1mes',
      nombre: 'Spotify Premium 1 Mes',
      descripcion: 'Suscripción Spotify Premium por 1 mes. Música sin anuncios',
      emoji: '🎵',
      puntosNecesarios: 7000,
      tipo: 'beneficio',
      activo: true,
      stock: 4,
      duracionDias: 30,
      color: '#1DB954'
    },

    // ========================================
    // CASHBACK DIRECTO
    // ========================================
    {
      id: 'cashback-10usd',
      nombre: 'Retiro $10 USD',
      descripcion: 'Retira $10 USD a tu cuenta PayPal o transferencia bancaria. Procesado en 24-48h',
      emoji: '💵',
      puntosNecesarios: 10000,
      tipo: 'beneficio',
      activo: true,
      color: '#00C853'
    },
    {
      id: 'cashback-20usd',
      nombre: 'Retiro $20 USD',
      descripcion: 'Retira $20 USD a tu cuenta PayPal o transferencia bancaria. Procesado en 24-48h',
      emoji: '💵',
      puntosNecesarios: 19000,
      tipo: 'beneficio',
      activo: true,
      color: '#00C853'
    }
  ];

  // Observable para notificar cambios en puntos
  private puntosActualizados = new BehaviorSubject<number>(0);
  public puntosActualizados$ = this.puntosActualizados.asObservable();

  constructor(private authService: AuthService) {
    this.inicializarPuntos();
  }

  // ============================================
  // INICIALIZACIÓN
  // ============================================

  private inicializarPuntos(): void {
    const usuario = this.authService.getUsuarioActualSync();
    if (usuario) {
      this.puntosActualizados.next(usuario.recompensas || 0);
    }
  }

  // ============================================
  // GESTIÓN DE PUNTOS
  // ============================================

  /**
   * Obtiene el saldo actual de puntos del usuario
   */
  obtenerSaldoPuntos(): number {
    const usuario = this.authService.getUsuarioActualSync();
    return usuario?.recompensas || 0;
  }

  /**
   * Agrega puntos al usuario y registra la transacción
   */
  agregarPuntos(cantidad: number, motivo: string, articuloId?: string): void {
    const usuario = this.authService.getUsuarioActualSync();
    if (!usuario) return;

    const saldoAnterior = usuario.recompensas || 0;
    const saldoNuevo = saldoAnterior + cantidad;

    // Actualizar puntos en el usuario
    this.authService.agregarRecompensa(cantidad);

    // Registrar transacción
    const transaccion: TransaccionPuntos = {
      id: this.generarId(),
      usuarioId: usuario.id,
      tipo: 'ganado',
      cantidad,
      motivo,
      articuloRelacionado: articuloId,
      fecha: new Date(),
      saldoAnterior,
      saldoNuevo
    };

    this.guardarTransaccion(transaccion);

    // Notificar cambio
    this.puntosActualizados.next(saldoNuevo);
  }

  /**
   * Gasta puntos del usuario y registra la transacción
   */
  gastarPuntos(cantidad: number, motivo: string, voucherId?: string): boolean {
    const usuario = this.authService.getUsuarioActualSync();
    if (!usuario) return false;

    const saldoAnterior = usuario.recompensas || 0;

    // Validar que tenga suficientes puntos
    if (saldoAnterior < cantidad) {
      return false;
    }

    const saldoNuevo = saldoAnterior - cantidad;

    // Actualizar puntos en el usuario
    this.authService.agregarRecompensa(-cantidad);

    // Registrar transacción
    const transaccion: TransaccionPuntos = {
      id: this.generarId(),
      usuarioId: usuario.id,
      tipo: 'gastado',
      cantidad,
      motivo,
      voucherRelacionado: voucherId,
      fecha: new Date(),
      saldoAnterior,
      saldoNuevo
    };

    this.guardarTransaccion(transaccion);

    // Notificar cambio
    this.puntosActualizados.next(saldoNuevo);

    return true;
  }

  /**
   * Otorga puntos por completar un trueque
   */
  otorgarPuntosPorTrueque(articuloId: string): number {
    const usuario = this.authService.getUsuarioActualSync();
    if (!usuario) return 0;

    const esPrimerTrueque = usuario.trueques_realizados === 0;
    const puntos = esPrimerTrueque ? this.reglasPuntos.primerTrueque : this.reglasPuntos.truequeCompletado;

    let motivo = esPrimerTrueque
      ? '🎉 ¡Primer trueque completado!'
      : 'Trueque completado';

    this.agregarPuntos(puntos, motivo, articuloId);

    // Verificar bonificación cada 10 trueques
    const truequesActuales = usuario.trueques_realizados + 1;
    if (truequesActuales % 10 === 0) {
      this.agregarPuntos(
        this.reglasPuntos.cada10Trueques,
        `🏆 ¡Bonificación por ${truequesActuales} trueques!`
      );
      return puntos + this.reglasPuntos.cada10Trueques;
    }

    return puntos;
  }

  /**
   * Otorga bono de registro a nuevo usuario
   */
  otorgarBonoRegistro(usuarioId: string): void {
    const transacciones = this.obtenerTransacciones();
    const yaRecibioBonus = transacciones.some(
      t => t.usuarioId === usuarioId && t.motivo.includes('Bono de bienvenida')
    );

    if (!yaRecibioBonus) {
      this.agregarPuntos(
        this.reglasPuntos.bonoRegistro,
        '🎁 Bono de bienvenida'
      );
    }
  }

  // ============================================
  // GESTIÓN DE VOUCHERS
  // ============================================

  /**
   * Obtiene el catálogo de vouchers disponibles
   */
  obtenerVouchersDisponibles(): Voucher[] {
    return this.vouchersDisponibles.filter(v => v.activo);
  }

  /**
   * Obtiene un voucher específico por ID
   */
  obtenerVoucherPorId(id: string): Voucher | undefined {
    return this.vouchersDisponibles.find(v => v.id === id);
  }

  /**
   * Canjea un voucher con puntos
   */
  canjearVoucher(voucherId: string): { exito: boolean; mensaje: string; voucher?: VoucherCanjeado } {
    const usuario = this.authService.getUsuarioActualSync();
    if (!usuario) {
      return { exito: false, mensaje: 'No hay sesión activa' };
    }

    const voucher = this.obtenerVoucherPorId(voucherId);
    if (!voucher) {
      return { exito: false, mensaje: 'Voucher no encontrado' };
    }

    if (!voucher.activo) {
      return { exito: false, mensaje: 'Voucher no disponible' };
    }

    // Validar stock
    if (voucher.stock !== undefined && voucher.stock <= 0) {
      return { exito: false, mensaje: 'Voucher agotado' };
    }

    // Validar puntos suficientes
    const saldo = this.obtenerSaldoPuntos();
    if (saldo < voucher.puntosNecesarios) {
      return {
        exito: false,
        mensaje: `Necesitas ${voucher.puntosNecesarios - saldo} puntos más`
      };
    }

    // Gastar puntos
    const exito = this.gastarPuntos(
      voucher.puntosNecesarios,
      `Voucher: ${voucher.nombre}`,
      voucher.id
    );

    if (!exito) {
      return { exito: false, mensaje: 'Error al procesar el canje' };
    }

    // Crear voucher canjeado
    const fechaCanje = new Date();
    const fechaExpiracion = voucher.duracionDias
      ? new Date(fechaCanje.getTime() + voucher.duracionDias * 24 * 60 * 60 * 1000)
      : undefined;

    const voucherCanjeado: VoucherCanjeado = {
      id: this.generarId(),
      voucherId: voucher.id,
      voucher: { ...voucher },
      usuarioId: usuario.id,
      fechaCanje,
      fechaExpiracion,
      usado: false,
      codigo: this.generarCodigoVoucher()
    };

    this.guardarVoucherCanjeado(voucherCanjeado);

    // Actualizar stock si aplica
    if (voucher.stock !== undefined) {
      voucher.stock--;
    }

    return {
      exito: true,
      mensaje: '¡Voucher canjeado exitosamente!',
      voucher: voucherCanjeado
    };
  }

  /**
   * Obtiene los vouchers canjeados por el usuario actual
   */
  obtenerVouchersCanjeados(): VoucherCanjeado[] {
    const usuario = this.authService.getUsuarioActualSync();
    if (!usuario) return [];

    const vouchers = this.cargarVouchersCanjeados();
    return vouchers.filter(v => v.usuarioId === usuario.id);
  }

  /**
   * Obtiene los vouchers activos (no usados y no expirados)
   */
  obtenerVouchersActivos(): VoucherCanjeado[] {
    const vouchers = this.obtenerVouchersCanjeados();
    const ahora = new Date();

    return vouchers.filter(v => {
      const noUsado = !v.usado;
      const noExpirado = !v.fechaExpiracion || new Date(v.fechaExpiracion) > ahora;
      return noUsado && noExpirado;
    });
  }

  /**
   * Marca un voucher como usado
   */
  usarVoucher(voucherId: string, articuloId?: string): boolean {
    const vouchers = this.cargarVouchersCanjeados();
    const voucher = vouchers.find(v => v.id === voucherId);

    if (!voucher || voucher.usado) {
      return false;
    }

    voucher.usado = true;
    voucher.fechaUso = new Date();
    if (articuloId) {
      voucher.articuloAplicado = articuloId;
    }

    this.guardarTodosLosVouchersCanjeados(vouchers);
    return true;
  }

  // ============================================
  // HISTORIAL Y ESTADÍSTICAS
  // ============================================

  /**
   * Obtiene todas las transacciones del usuario actual
   */
  obtenerHistorialPuntos(): TransaccionPuntos[] {
    const usuario = this.authService.getUsuarioActualSync();
    if (!usuario) return [];

    const transacciones = this.obtenerTransacciones();
    return transacciones
      .filter(t => t.usuarioId === usuario.id)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  /**
   * Obtiene estadísticas de puntos del usuario
   */
  obtenerEstadisticasPuntos(): EstadisticasPuntos {
    const historial = this.obtenerHistorialPuntos();
    const vouchers = this.obtenerVouchersCanjeados();

    const puntosGanados = historial
      .filter(t => t.tipo === 'ganado' || t.tipo === 'bonificacion')
      .reduce((sum, t) => sum + t.cantidad, 0);

    const puntosGastados = historial
      .filter(t => t.tipo === 'gastado')
      .reduce((sum, t) => sum + t.cantidad, 0);

    const ultimaTransaccion = historial.length > 0
      ? new Date(historial[0].fecha)
      : undefined;

    return {
      puntosGanados,
      puntosGastados,
      puntosActuales: this.obtenerSaldoPuntos(),
      voucherCanjeados: vouchers.length,
      transacciones: historial.length,
      ultimaTransaccion
    };
  }

  // ============================================
  // ALMACENAMIENTO
  // ============================================

  private obtenerTransacciones(): TransaccionPuntos[] {
    const data = localStorage.getItem(this.TRANSACCIONES_KEY);
    return data ? JSON.parse(data) : [];
  }

  private guardarTransaccion(transaccion: TransaccionPuntos): void {
    const transacciones = this.obtenerTransacciones();
    transacciones.push(transaccion);
    localStorage.setItem(this.TRANSACCIONES_KEY, JSON.stringify(transacciones));
  }

  private cargarVouchersCanjeados(): VoucherCanjeado[] {
    const data = localStorage.getItem(this.VOUCHERS_CANJEADOS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private guardarVoucherCanjeado(voucher: VoucherCanjeado): void {
    const vouchers = this.cargarVouchersCanjeados();
    vouchers.push(voucher);
    localStorage.setItem(this.VOUCHERS_CANJEADOS_KEY, JSON.stringify(vouchers));
  }

  private guardarTodosLosVouchersCanjeados(vouchers: VoucherCanjeado[]): void {
    localStorage.setItem(this.VOUCHERS_CANJEADOS_KEY, JSON.stringify(vouchers));
  }

  // ============================================
  // UTILIDADES
  // ============================================

  private generarId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  private generarCodigoVoucher(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 8; i++) {
      codigo += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return codigo;
  }

  /**
   * Obtiene las reglas de puntos
   */
  obtenerReglasPuntos(): ReglasPuntos {
    return { ...this.reglasPuntos };
  }
}
