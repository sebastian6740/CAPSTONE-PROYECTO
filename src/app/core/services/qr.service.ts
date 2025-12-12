import { Injectable } from '@angular/core';
import { Firestore, doc, setDoc, getDoc, updateDoc, writeBatch, collection, addDoc, serverTimestamp, query, where, getDocs } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { AuthService } from './auth.service';
import { NotificacionesService } from './notificaciones.service';

export interface QRPermuta {
  id: string;
  articuloId: string;
  articuloNombre: string;
  usuarioId: string;
  usuarioNombre: string;
  usuarioEmail: string;
  fechaCreacion: number;
  fechaExpiracion: number;
  estado: 'activo' | 'completado' | 'expirado';
  codigoQR: string;
}

export interface PermutaCompletada {
  id: string;
  qrId: string;
  articuloId: string;
  articuloNombre: string;
  vendedorId: string;
  vendedorNombre: string;
  compradorId: string;
  compradorNombre: string;
  fechaCompletada: Date;
  puntosOtorgados: {
    vendedor: number;
    comprador: number;
  };
  estado: 'completada';
  rolUsuario?: 'vendedor' | 'comprador';  // Contexto para UI
}

@Injectable({
  providedIn: 'root'
})
export class QRService {

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private authService: AuthService,
    private notificacionesService: NotificacionesService
  ) { }

  // Generar QR para permuta
  async generarQRPermuta(articuloId: string, articuloNombre: string): Promise<string> {
    try {
      const usuario = this.auth.currentUser;
      if (!usuario) {
        throw new Error('Usuario no autenticado');
      }

      const qrId = `QR_${articuloId}_${Date.now()}`;
      const ahora = Date.now();
      const expiracion = ahora + (24 * 60 * 60 * 1000); // Expira en 24 horas

      const datosQR: QRPermuta = {
        id: qrId,
        articuloId: articuloId,
        articuloNombre: articuloNombre,
        usuarioId: usuario.uid,
        usuarioNombre: usuario.displayName || 'Usuario',
        usuarioEmail: usuario.email || '',
        fechaCreacion: ahora,
        fechaExpiracion: expiracion,
        estado: 'activo',
        codigoQR: qrId
      };

      // Guardar en Firestore
      await setDoc(doc(this.firestore, 'qr_permutas', qrId), datosQR);

      return qrId;
    } catch (error) {
      console.error('Error generando QR:', error);
      throw new Error('No se pudo generar el QR. Intenta nuevamente.');
    }
  }

  // Verificar QR
  async verificarQR(qrCode: string): Promise<QRPermuta | null> {
    try {
      const docRef = doc(this.firestore, 'qr_permutas', qrCode);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const qrData = docSnap.data() as QRPermuta;

      // Verificar si está expirado
      const ahora = Date.now();
      if (ahora > qrData.fechaExpiracion) {
        await updateDoc(docRef, { estado: 'expirado' });
        return null;
      }

      // Verificar si ya fue completado
      if (qrData.estado !== 'activo') {
        return null;
      }

      return qrData;
    } catch (error) {
      console.error('Error verificando QR:', error);
      return null;
    }
  }

  // Completar permuta con batch writes atómicos
  async completarPermuta(qrCode: string, compradorId: string): Promise<{
    exito: boolean;
    mensaje: string;
    puntos?: { vendedor: number; comprador: number }
  }> {
    console.log(`🔄 Iniciando completar permuta: QR=${qrCode}, Comprador=${compradorId}`);

    try {
      // ============================================
      // PASO 1: VALIDACIONES
      // ============================================

      // 1.1 - Obtener y validar QR
      const qrDocRef = doc(this.firestore, 'qr_permutas', qrCode);
      const qrDoc = await getDoc(qrDocRef);

      if (!qrDoc.exists()) {
        console.error('❌ QR no encontrado');
        return { exito: false, mensaje: 'Código QR no encontrado' };
      }

      const qrData = qrDoc.data() as QRPermuta;
      console.log('📋 Datos del QR:', qrData);

      // 1.2 - Validar estado del QR
      const ahora = Date.now();

      if (ahora > qrData.fechaExpiracion) {
        console.error('❌ QR expirado');
        await updateDoc(qrDocRef, { estado: 'expirado' });
        return { exito: false, mensaje: 'El código QR ha expirado' };
      }

      if (qrData.estado !== 'activo') {
        console.error(`❌ QR ya usado o en estado: ${qrData.estado}`);
        return { exito: false, mensaje: `El QR ya fue utilizado o está ${qrData.estado}` };
      }

      // 1.3 - Validar que comprador ≠ vendedor
      const vendedorId = qrData.usuarioId;
      if (compradorId === vendedorId) {
        console.error('❌ El comprador no puede ser el mismo vendedor');
        return { exito: false, mensaje: 'No puedes completar tu propio trueque' };
      }

      // 1.4 - Obtener y validar artículo
      const articuloDocRef = doc(this.firestore, 'articulos', qrData.articuloId);
      const articuloDoc = await getDoc(articuloDocRef);

      if (!articuloDoc.exists()) {
        console.error('❌ Artículo no encontrado');
        return { exito: false, mensaje: 'Artículo no encontrado' };
      }

      const articuloData = articuloDoc.data();
      console.log('📦 Datos del artículo:', articuloData);

      if (!articuloData['disponible']) {
        console.error('❌ Artículo no disponible');
        return { exito: false, mensaje: 'Este artículo ya no está disponible' };
      }

      // 1.5 - Obtener datos de ambos usuarios
      const vendedorDocRef = doc(this.firestore, 'usuarios', vendedorId);
      const compradorDocRef = doc(this.firestore, 'usuarios', compradorId);

      const [vendedorDoc, compradorDoc] = await Promise.all([
        getDoc(vendedorDocRef),
        getDoc(compradorDocRef)
      ]);

      if (!vendedorDoc.exists() || !compradorDoc.exists()) {
        console.error('❌ Usuario no encontrado');
        return { exito: false, mensaje: 'Usuario no encontrado' };
      }

      const vendedorData = vendedorDoc.data();
      const compradorData = compradorDoc.data();

      console.log('👥 Vendedor:', vendedorData['nombre']);
      console.log('👥 Comprador:', compradorData['nombre']);

      // ============================================
      // PASO 2: CALCULAR PUNTOS
      // ============================================

      const trueques_vendedor = vendedorData['trueques_realizados'] || 0;
      const trueques_comprador = compradorData['trueques_realizados'] || 0;

      // Base: 50 puntos para cada uno
      let puntosVendedor = 50;
      let puntosComprador = 50;

      // Si es primer trueque: 200 puntos en lugar de 50
      if (trueques_vendedor === 0) {
        puntosVendedor = 200;
        console.log('🎉 ¡Primer trueque del vendedor! 200 puntos');
      }

      if (trueques_comprador === 0) {
        puntosComprador = 200;
        console.log('🎉 ¡Primer trueque del comprador! 200 puntos');
      }

      // Bonos por cada 10 trueques
      const nuevos_trueques_vendedor = trueques_vendedor + 1;
      const nuevos_trueques_comprador = trueques_comprador + 1;

      if (nuevos_trueques_vendedor % 10 === 0) {
        puntosVendedor += 500;
        console.log(`🏆 Bono de ${nuevos_trueques_vendedor} trueques para vendedor: +500 puntos`);
      }

      if (nuevos_trueques_comprador % 10 === 0) {
        puntosComprador += 500;
        console.log(`🏆 Bono de ${nuevos_trueques_comprador} trueques para comprador: +500 puntos`);
      }

      console.log(`💰 Puntos a otorgar - Vendedor: ${puntosVendedor}, Comprador: ${puntosComprador}`);

      // ============================================
      // PASO 3: BATCH WRITE ATÓMICO
      // ============================================

      const batch = writeBatch(this.firestore);

      // 3.1 - Actualizar QR
      batch.update(qrDocRef, {
        estado: 'completado',
        compradorId: compradorId,
        fechaCompletada: serverTimestamp()
      });

      // 3.2 - Actualizar artículo
      batch.update(articuloDocRef, {
        disponible: false,
        fechaPermuta: serverTimestamp(),
        permutadoCon: compradorId
      });

      // 3.3 - Actualizar vendedor (puntos + contador)
      const nuevosRecompensasVendedor = (vendedorData['recompensas'] || 0) + puntosVendedor;
      batch.update(vendedorDocRef, {
        recompensas: nuevosRecompensasVendedor,
        trueques_realizados: nuevos_trueques_vendedor
      });

      // 3.4 - Actualizar comprador (puntos + contador)
      const nuevosRecompensasComprador = (compradorData['recompensas'] || 0) + puntosComprador;
      batch.update(compradorDocRef, {
        recompensas: nuevosRecompensasComprador,
        trueques_realizados: nuevos_trueques_comprador
      });

      // 3.5 - Crear registro de permuta completada
      const permutaId = `PERMU_${Date.now()}_${qrCode}`;
      const permutaDocRef = doc(this.firestore, 'permutas_completadas', permutaId);
      batch.set(permutaDocRef, {
        qrId: qrCode,
        articuloId: qrData.articuloId,
        articuloNombre: qrData.articuloNombre,
        vendedorId: vendedorId,
        vendedorNombre: vendedorData['nombre'],
        compradorId: compradorId,
        compradorNombre: compradorData['nombre'],
        fechaCompletada: serverTimestamp(),
        puntosOtorgados: {
          vendedor: puntosVendedor,
          comprador: puntosComprador
        },
        estado: 'completada'
      });

      // 3.6 - Ejecutar batch (ATÓMICO - todo o nada)
      console.log('⚡ Ejecutando batch write...');
      await batch.commit();
      console.log('✅ Batch write completado exitosamente');

      // ============================================
      // PASO 4: NOTIFICACIONES (no bloqueante)
      // ============================================

      // Ejecutar notificaciones en paralelo sin bloquear la respuesta
      Promise.all([
        this.enviarNotificacionTrueque(
          vendedorId,
          'vendedor',
          {
            articuloNombre: qrData.articuloNombre,
            otroUsuarioNombre: compradorData['nombre'],
            puntos: puntosVendedor,
            permutaId
          }
        ),
        this.enviarNotificacionTrueque(
          compradorId,
          'comprador',
          {
            articuloNombre: qrData.articuloNombre,
            otroUsuarioNombre: vendedorData['nombre'],
            puntos: puntosComprador,
            permutaId
          }
        )
      ]).catch(error => {
        console.error('⚠️ Error enviando notificaciones (no crítico):', error);
      });

      // Crear transacciones de puntos para el historial
      this.registrarTransaccionesPuntos(
        vendedorId,
        compradorId,
        puntosVendedor,
        puntosComprador,
        qrData.articuloId,
        qrData.articuloNombre,
        trueques_vendedor,
        trueques_comprador
      ).catch(error => {
        console.error('⚠️ Error registrando transacciones (no crítico):', error);
      });

      console.log('✅ Trueque completado exitosamente');

      return {
        exito: true,
        mensaje: '¡Trueque completado exitosamente!',
        puntos: { vendedor: puntosVendedor, comprador: puntosComprador }
      };

    } catch (error: any) {
      console.error('❌ Error al completar permuta:', error);

      // Mensajes de error específicos
      if (error.code === 'unavailable') {
        return { exito: false, mensaje: 'Sin conexión a internet. Intenta de nuevo.' };
      }

      if (error.code === 'permission-denied') {
        return { exito: false, mensaje: 'Error de permisos. Contacta al soporte.' };
      }

      return {
        exito: false,
        mensaje: error.message || 'Error al completar el trueque. Intenta de nuevo.'
      };
    }
  }

  // Enviar notificación de trueque completado
  private async enviarNotificacionTrueque(
    usuarioId: string,
    rol: 'vendedor' | 'comprador',
    datos: { articuloNombre: string; otroUsuarioNombre: string; puntos: number; permutaId: string }
  ): Promise<void> {
    console.log(`🔔 Enviando notificación de trueque a ${rol}...`);

    const titulo = '¡Trueque completado!';
    const mensajeVendedor = `¡Has permutado "${datos.articuloNombre}" con ${datos.otroUsuarioNombre}! Has ganado ${datos.puntos} puntos.`;
    const mensajeComprador = `¡Has obtenido "${datos.articuloNombre}" de ${datos.otroUsuarioNombre}! Has ganado ${datos.puntos} puntos.`;

    const mensaje = rol === 'vendedor' ? mensajeVendedor : mensajeComprador;

    const notificacionesCollection = collection(this.firestore, 'notificaciones');
    await addDoc(notificacionesCollection, {
      usuarioId,
      tipo: 'trueque_completado',
      titulo,
      mensaje,
      leida: false,
      fecha: serverTimestamp(),
      truequeRelacionado: {
        permutaId: datos.permutaId,
        articuloNombre: datos.articuloNombre,
        rol,
        puntos: datos.puntos
      },
      accion: {
        tipo: 'navegar',
        ruta: '/mis-trueques'
      }
    });

    console.log(`✅ Notificación de trueque enviada a ${rol}`);
  }

  // Registrar transacciones de puntos en Firestore
  private async registrarTransaccionesPuntos(
    vendedorId: string,
    compradorId: string,
    puntosVendedor: number,
    puntosComprador: number,
    articuloId: string,
    articuloNombre: string,
    truequesAnterioresVendedor: number,
    truequesAnterioresComprador: number
  ): Promise<void> {
    console.log('📝 Registrando transacciones de puntos...');

    const transaccionesCollection = collection(this.firestore, 'transacciones');

    // Determinar motivos según el trueque
    const esPrimerTruequeVendedor = truequesAnterioresVendedor === 0;
    const esPrimerTruequeComprador = truequesAnterioresComprador === 0;

    const nuevosTruequesVendedor = truequesAnterioresVendedor + 1;
    const nuevosTruequesComprador = truequesAnterioresComprador + 1;

    let motivoVendedor = esPrimerTruequeVendedor
      ? '🎉 ¡Primer trueque completado!'
      : `Trueque completado: ${articuloNombre}`;

    let motivoComprador = esPrimerTruequeComprador
      ? '🎉 ¡Primer trueque completado!'
      : `Trueque completado: ${articuloNombre}`;

    // Agregar bonus en el motivo si aplica
    if (nuevosTruequesVendedor % 10 === 0 && !esPrimerTruequeVendedor) {
      motivoVendedor += ` 🏆 ¡Bonificación por ${nuevosTruequesVendedor} trueques!`;
    }

    if (nuevosTruequesComprador % 10 === 0 && !esPrimerTruequeComprador) {
      motivoComprador += ` 🏆 ¡Bonificación por ${nuevosTruequesComprador} trueques!`;
    }

    // Crear transacciones en paralelo
    await Promise.all([
      addDoc(transaccionesCollection, {
        usuarioId: vendedorId,
        tipo: 'ganado',
        cantidad: puntosVendedor,
        motivo: motivoVendedor,
        articuloRelacionado: articuloId,
        fecha: serverTimestamp()
      }),
      addDoc(transaccionesCollection, {
        usuarioId: compradorId,
        tipo: 'ganado',
        cantidad: puntosComprador,
        motivo: motivoComprador,
        articuloRelacionado: articuloId,
        fecha: serverTimestamp()
      })
    ]);

    console.log('✅ Transacciones de puntos registradas');
  }

  // Obtener QRs activos del usuario
  async obtenerMisQRsActivos(): Promise<QRPermuta[]> {
    try {
      const usuario = this.auth.currentUser;
      if (!usuario) return [];

      // En una app real, usarías una query más eficiente
      // Por ahora devolvemos un array vacío
      return [];
    } catch (error) {
      console.error('Error obteniendo QRs:', error);
      return [];
    }
  }

  // ============================================
  // HISTORIAL DE TRUEQUES
  // ============================================

  /**
   * Obtiene el historial completo de trueques del usuario
   * Incluye tanto los trueques donde fue vendedor como comprador
   */
  async obtenerHistorialTrueques(usuarioId: string): Promise<PermutaCompletada[]> {
    console.log(`📊 Obteniendo historial de trueques para usuario ${usuarioId}...`);

    try {
      const permutasCollection = collection(this.firestore, 'permutas_completadas');

      // Query 1: Trueques como vendedor
      const queryVendedor = query(
        permutasCollection,
        where('vendedorId', '==', usuarioId)
      );

      // Query 2: Trueques como comprador
      const queryComprador = query(
        permutasCollection,
        where('compradorId', '==', usuarioId)
      );

      // Ejecutar ambas queries en paralelo
      const [snapshotVendedor, snapshotComprador] = await Promise.all([
        getDocs(queryVendedor),
        getDocs(queryComprador)
      ]);

      console.log(`✅ Encontrados ${snapshotVendedor.size} trueques como vendedor`);
      console.log(`✅ Encontrados ${snapshotComprador.size} trueques como comprador`);

      // Convertir snapshots a objetos PermutaCompletada
      const truequesVendedor: PermutaCompletada[] = snapshotVendedor.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          qrId: data['qrId'],
          articuloId: data['articuloId'],
          articuloNombre: data['articuloNombre'],
          vendedorId: data['vendedorId'],
          vendedorNombre: data['vendedorNombre'],
          compradorId: data['compradorId'],
          compradorNombre: data['compradorNombre'],
          fechaCompletada: data['fechaCompletada']?.toDate() || new Date(),
          puntosOtorgados: data['puntosOtorgados'],
          estado: 'completada',
          rolUsuario: 'vendedor' as const
        };
      });

      const truequesComprador: PermutaCompletada[] = snapshotComprador.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          qrId: data['qrId'],
          articuloId: data['articuloId'],
          articuloNombre: data['articuloNombre'],
          vendedorId: data['vendedorId'],
          vendedorNombre: data['vendedorNombre'],
          compradorId: data['compradorId'],
          compradorNombre: data['compradorNombre'],
          fechaCompletada: data['fechaCompletada']?.toDate() || new Date(),
          puntosOtorgados: data['puntosOtorgados'],
          estado: 'completada',
          rolUsuario: 'comprador' as const
        };
      });

      // Combinar ambos arrays
      const todosTrueques = [...truequesVendedor, ...truequesComprador];

      // Ordenar por fecha (más recientes primero)
      todosTrueques.sort((a, b) =>
        b.fechaCompletada.getTime() - a.fechaCompletada.getTime()
      );

      console.log(`✅ Total de trueques: ${todosTrueques.length}`);

      return todosTrueques;

    } catch (error) {
      console.error('❌ Error al obtener historial de trueques:', error);
      return [];
    }
  }

  /**
   * Obtiene estadísticas de trueques del usuario
   */
  async obtenerEstadisticasTrueques(usuarioId: string): Promise<{
    totalTrueques: number;
    comoVendedor: number;
    comoComprador: number;
    puntosGanadosTotal: number;
    ultimoTrueque?: Date;
  }> {
    console.log(`📈 Obteniendo estadísticas de trueques para usuario ${usuarioId}...`);

    try {
      const historial = await this.obtenerHistorialTrueques(usuarioId);

      const totalTrueques = historial.length;
      const comoVendedor = historial.filter(t => t.rolUsuario === 'vendedor').length;
      const comoComprador = historial.filter(t => t.rolUsuario === 'comprador').length;

      // Calcular puntos ganados totales
      const puntosGanadosTotal = historial.reduce((total, trueque) => {
        if (trueque.rolUsuario === 'vendedor') {
          return total + (trueque.puntosOtorgados?.vendedor || 0);
        } else {
          return total + (trueque.puntosOtorgados?.comprador || 0);
        }
      }, 0);

      // Obtener fecha del último trueque
      const ultimoTrueque = historial.length > 0
        ? historial[0].fechaCompletada
        : undefined;

      const estadisticas = {
        totalTrueques,
        comoVendedor,
        comoComprador,
        puntosGanadosTotal,
        ultimoTrueque
      };

      console.log(`✅ Estadísticas calculadas:`, estadisticas);

      return estadisticas;

    } catch (error) {
      console.error('❌ Error al obtener estadísticas:', error);
      return {
        totalTrueques: 0,
        comoVendedor: 0,
        comoComprador: 0,
        puntosGanadosTotal: 0
      };
    }
  }
}
