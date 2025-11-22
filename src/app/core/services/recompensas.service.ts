import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, serverTimestamp, query, where, orderBy, Timestamp, getDocs } from '@angular/fire/firestore';
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

  // Cache local de transacciones y vouchers
  private transaccionesCache: TransaccionPuntos[] = [];
  private vouchersCanjeadosCache: VoucherCanjeado[] = [];

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

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private ngZone: NgZone
  ) {
    this.inicializarPuntos();
  }

  // ============================================
  // INICIALIZACIÓN
  // ============================================

  private inicializarPuntos(): void {
    const usuario = this.authService.getUsuarioActualSync();
    if (usuario) {
      this.puntosActualizados.next(usuario.recompensas || 0);
      this.cargarDatosDeFirestore();
    }
  }

  // Cargar transacciones y vouchers desde Firestore
  private async cargarDatosDeFirestore() {
    const usuario = this.authService.getUsuarioActualSync();
    if (!usuario) return;

    console.log('🎁 Cargando datos de recompensas desde Firestore...');

    try {
      // Cargar transacciones
      const transaccionesCollection = collection(this.firestore, 'transacciones');
      const transaccionesQuery = query(
        transaccionesCollection,
        where('usuarioId', '==', usuario.id),
        orderBy('fecha', 'desc')
      );

      const transaccionesSnapshot = await getDocs(transaccionesQuery);
      this.transaccionesCache = transaccionesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        fecha: doc.data()['fecha'] instanceof Timestamp ? doc.data()['fecha'].toDate() : doc.data()['fecha']
      } as TransaccionPuntos));

      console.log(`✅ ${this.transaccionesCache.length} transacciones cargadas`);

      // Cargar vouchers canjeados
      const vouchersCollection = collection(this.firestore, 'vouchers_canjeados');
      const vouchersQuery = query(
        vouchersCollection,
        where('usuarioId', '==', usuario.id),
        orderBy('fechaCanje', 'desc')
      );

      const vouchersSnapshot = await getDocs(vouchersQuery);
      this.vouchersCanjeadosCache = vouchersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          fechaCanje: data['fechaCanje'] instanceof Timestamp ? data['fechaCanje'].toDate() : data['fechaCanje'],
          fechaExpiracion: data['fechaExpiracion'] instanceof Timestamp ? data['fechaExpiracion'].toDate() : data['fechaExpiracion'],
          fechaUso: data['fechaUso'] instanceof Timestamp ? data['fechaUso'].toDate() : data['fechaUso']
        } as VoucherCanjeado;
      });

      console.log(`✅ ${this.vouchersCanjeadosCache.length} vouchers canjeados cargados`);
    } catch (error) {
      console.error('❌ Error al cargar datos de recompensas:', error);
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
  async agregarPuntos(cantidad: number, motivo: string, articuloId?: string): Promise<void> {
    const usuario = this.authService.getUsuarioActualSync();
    if (!usuario) return;

    const saldoAnterior = usuario.recompensas || 0;
    const saldoNuevo = saldoAnterior + cantidad;

    console.log(`🎁 Agregando ${cantidad} puntos: ${motivo}`);

    // Actualizar puntos en el usuario
    await this.authService.agregarRecompensa(cantidad);

    // Registrar transacción en Firestore
    const transaccion: any = {
      usuarioId: usuario.id,
      tipo: 'ganado',
      cantidad,
      motivo,
      articuloRelacionado: articuloId || null,
      fecha: serverTimestamp(),
      saldoAnterior,
      saldoNuevo
    };

    await this.guardarTransaccionFirestore(transaccion);

    // Notificar cambio
    this.puntosActualizados.next(saldoNuevo);
  }

  /**
   * Gasta puntos del usuario y registra la transacción
   */
  async gastarPuntos(cantidad: number, motivo: string, voucherId?: string): Promise<boolean> {
    const usuario = this.authService.getUsuarioActualSync();
    if (!usuario) return false;

    const saldoAnterior = usuario.recompensas || 0;

    // Validar que tenga suficientes puntos
    if (saldoAnterior < cantidad) {
      return false;
    }

    const saldoNuevo = saldoAnterior - cantidad;

    console.log(`💸 Gastando ${cantidad} puntos: ${motivo}`);

    // Actualizar puntos en el usuario
    await this.authService.agregarRecompensa(-cantidad);

    // Registrar transacción en Firestore
    const transaccion: any = {
      usuarioId: usuario.id,
      tipo: 'gastado',
      cantidad,
      motivo,
      voucherRelacionado: voucherId || null,
      fecha: serverTimestamp(),
      saldoAnterior,
      saldoNuevo
    };

    await this.guardarTransaccionFirestore(transaccion);

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
    const transacciones = this.transaccionesCache;
    const yaRecibioBonus = transacciones.some(
      (t: TransaccionPuntos) => t.usuarioId === usuarioId && t.motivo.includes('Bono de bienvenida')
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
  async canjearVoucher(voucherId: string): Promise<{ exito: boolean; mensaje: string; voucher?: VoucherCanjeado }> {
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

    console.log(`🎫 Canjeando voucher: ${voucher.nombre}`);

    // Gastar puntos
    const exito = await this.gastarPuntos(
      voucher.puntosNecesarios,
      `Voucher: ${voucher.nombre}`,
      voucher.id
    );

    if (!exito) {
      return { exito: false, mensaje: 'Error al procesar el canje' };
    }

    // Crear voucher canjeado
    const fechaExpiracion = voucher.duracionDias
      ? new Date(Date.now() + voucher.duracionDias * 24 * 60 * 60 * 1000)
      : undefined;

    const voucherCanjeado: any = {
      voucherId: voucher.id,
      voucher: { ...voucher },
      usuarioId: usuario.id,
      fechaCanje: serverTimestamp(),
      fechaExpiracion: fechaExpiracion || null,
      usado: false,
      codigo: this.generarCodigoVoucher()
    };

    const docRef = await this.guardarVoucherCanjeadoFirestore(voucherCanjeado);

    // Actualizar stock si aplica (esto debería manejarse a nivel de Firestore o admin)
    if (voucher.stock !== undefined) {
      voucher.stock--;
    }

    const voucherCanjeadoCompleto: VoucherCanjeado = {
      ...voucherCanjeado,
      id: docRef.id,
      fechaCanje: new Date(),
      fechaExpiracion
    };

    // Actualizar cache local
    this.vouchersCanjeadosCache.push(voucherCanjeadoCompleto);

    console.log('✅ Voucher canjeado exitosamente');

    return {
      exito: true,
      mensaje: '¡Voucher canjeado exitosamente!',
      voucher: voucherCanjeadoCompleto
    };
  }

  /**
   * Obtiene los vouchers canjeados por el usuario actual
   */
  obtenerVouchersCanjeados(): VoucherCanjeado[] {
    return this.vouchersCanjeadosCache;
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
  async usarVoucher(voucherId: string, articuloId?: string): Promise<boolean> {
    const voucher = this.vouchersCanjeadosCache.find(v => v.id === voucherId);

    if (!voucher || voucher.usado) {
      return false;
    }

    console.log(`✔️ Marcando voucher ${voucherId} como usado`);

    try {
      // Actualizar en Firestore
      const voucherDoc = doc(this.firestore, 'vouchers_canjeados', voucherId);
      const updateData: any = {
        usado: true,
        fechaUso: serverTimestamp()
      };

      if (articuloId) {
        updateData.articuloAplicado = articuloId;
      }

      await updateDoc(voucherDoc, updateData);

      // Actualizar cache local
      voucher.usado = true;
      voucher.fechaUso = new Date();
      if (articuloId) {
        voucher.articuloAplicado = articuloId;
      }

      console.log('✅ Voucher marcado como usado');
      return true;
    } catch (error) {
      console.error('❌ Error al marcar voucher como usado:', error);
      return false;
    }
  }

  // ============================================
  // HISTORIAL Y ESTADÍSTICAS
  // ============================================

  /**
   * Obtiene todas las transacciones del usuario actual
   */
  obtenerHistorialPuntos(): TransaccionPuntos[] {
    return this.transaccionesCache;
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
  // ALMACENAMIENTO FIRESTORE
  // ============================================

  private async guardarTransaccionFirestore(transaccion: any): Promise<any> {
    try {
      const transaccionesCollection = collection(this.firestore, 'transacciones');
      const docRef = await addDoc(transaccionesCollection, transaccion);

      // Actualizar cache local
      this.transaccionesCache.unshift({
        ...transaccion,
        id: docRef.id,
        fecha: new Date()
      });

      return docRef;
    } catch (error) {
      console.error('❌ Error al guardar transacción:', error);
      throw error;
    }
  }

  private async guardarVoucherCanjeadoFirestore(voucher: any): Promise<any> {
    try {
      const vouchersCollection = collection(this.firestore, 'vouchers_canjeados');
      const docRef = await addDoc(vouchersCollection, voucher);
      return docRef;
    } catch (error) {
      console.error('❌ Error al guardar voucher canjeado:', error);
      throw error;
    }
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
