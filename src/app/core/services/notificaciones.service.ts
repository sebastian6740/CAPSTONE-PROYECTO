import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Firestore, collection, collectionData, addDoc, doc, updateDoc, deleteDoc, query, where, Timestamp, serverTimestamp, writeBatch, getDocs } from '@angular/fire/firestore';
import { Notificacion } from '../models/notificacion.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class NotificacionesService {
  private notificaciones$ = new BehaviorSubject<Notificacion[]>([]);
  private notificacionesNoLeidas$ = new BehaviorSubject<number>(0);
  private listener: any;
  private authSubscription: any;
  private listenerIniciado = false;

  constructor(
    private firestore: Firestore,
    private authService: AuthService,
    private ngZone: NgZone
  ) {
    // Esperar a que el usuario esté autenticado antes de iniciar listener
    this.authSubscription = this.authService.getUsuarioActual().subscribe(usuario => {
      if (usuario && !this.listenerIniciado) {
        console.log('🔔 Usuario autenticado, iniciando listener de notificaciones...');
        this.iniciarListener();
        this.listenerIniciado = true;
      } else if (!usuario && this.listenerIniciado) {
        console.log('⚠️ Usuario no autenticado, deteniendo listener...');
        this.detenerListener();
        this.listenerIniciado = false;
      }
    });
  }

  // Detener listener existente
  private detenerListener() {
    if (this.listener) {
      this.listener.unsubscribe();
      this.listener = null;
      console.log('🔕 Listener de notificaciones detenido');
    }
  }

  // Iniciar listener en tiempo real de notificaciones del usuario actual
  private iniciarListener() {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual || !usuarioActual.id) {
      console.warn('⚠️ No hay usuario autenticado para cargar notificaciones');
      return;
    }

    console.log('🔔 Iniciando listener de notificaciones...');
    console.log('👤 Usuario actual ID:', usuarioActual.id);

    const notificacionesCollection = collection(this.firestore, 'notificaciones');
    const notificacionesQuery = query(
      notificacionesCollection,
      where('usuarioId', '==', usuarioActual.id)
    );

    this.listener = collectionData(notificacionesQuery, { idField: 'id' }).subscribe({
      next: (notificaciones: any[]) => {
        console.log(`✅ ${notificaciones.length} notificaciones cargadas`);

        // Convertir Timestamp a Date y ordenar por fecha (más recientes primero)
        const notificacionesFormateadas = notificaciones
          .map(notif => ({
            ...notif,
            fecha: notif.fecha instanceof Timestamp ? notif.fecha.toDate() : new Date(notif.fecha)
          }))
          .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

        this.ngZone.run(() => {
          this.notificaciones$.next(notificacionesFormateadas);
          this.actualizarContadorNoLeidas(notificacionesFormateadas);
        });
      },
      error: (error) => {
        console.error('❌ Error al cargar notificaciones:', error);
        // Intentar reconectar si es un error de red
        if (error.code === 'unavailable') {
          console.log('🔄 Reconectando en 3 segundos...');
          setTimeout(() => {
            if (this.listenerIniciado) {
              this.detenerListener();
              this.listenerIniciado = false;
              this.iniciarListener();
              this.listenerIniciado = true;
            }
          }, 3000);
        }
      }
    });
  }

  private actualizarContadorNoLeidas(notificaciones: Notificacion[]) {
    const noLeidas = notificaciones.filter(n => !n.leida).length;
    this.notificacionesNoLeidas$.next(noLeidas);
  }

  // Obtener notificaciones del usuario actual
  obtenerNotificaciones(): Observable<Notificacion[]> {
    return this.notificaciones$.asObservable();
  }

  // Obtener cantidad de notificaciones no leídas
  obtenerNotificacionesNoLeidas(): Observable<number> {
    return this.notificacionesNoLeidas$.asObservable();
  }

  // Crear notificación de artículo rechazado
  async notificarArticuloRechazado(usuarioId: string, articuloNombre: string, articuloId: string, motivo: string) {
    console.log(`🔔 Creando notificación de rechazo para usuario ${usuarioId}...`);
    console.log(`📋 Datos de notificación:`, { usuarioId, articuloNombre, articuloId, motivo });

    const notificacionesCollection = collection(this.firestore, 'notificaciones');
    const docRef = await addDoc(notificacionesCollection, {
      usuarioId,
      tipo: 'articulo_rechazado',
      titulo: 'Artículo rechazado',
      mensaje: `Tu artículo "${articuloNombre}" fue rechazado por el administrador.`,
      leida: false,
      fecha: serverTimestamp(),
      articuloRelacionado: {
        id: articuloId,
        nombre: articuloNombre,
        motivo: motivo
      }
    });

    console.log(`✅ Notificación de rechazo creada con ID: ${docRef.id}`);
  }

  // Crear notificación de artículo aprobado
  async notificarArticuloAprobado(usuarioId: string, articuloNombre: string, articuloId: string) {
    console.log(`🔔 Creando notificación de aprobación para usuario ${usuarioId}...`);
    console.log(`📋 Datos de notificación:`, { usuarioId, articuloNombre, articuloId });

    const notificacionesCollection = collection(this.firestore, 'notificaciones');
    const docRef = await addDoc(notificacionesCollection, {
      usuarioId,
      tipo: 'articulo_aprobado',
      titulo: 'Artículo aprobado',
      mensaje: `¡Felicidades! Tu artículo "${articuloNombre}" ha sido aprobado y ya está visible para todos.`,
      leida: false,
      fecha: serverTimestamp(),
      articuloRelacionado: {
        id: articuloId,
        nombre: articuloNombre
      },
      accion: {
        tipo: 'navegar',
        ruta: `/detalle-articulo/${articuloId}`
      }
    });

    console.log(`✅ Notificación de aprobación creada con ID: ${docRef.id}`);
  }

  // Marcar notificación como leída
  async marcarComoLeida(notificacionId: string) {
    const docRef = doc(this.firestore, 'notificaciones', notificacionId);
    await updateDoc(docRef, {
      leida: true
    });
  }

  // Marcar todas como leídas
  async marcarTodasComoLeidas() {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) return;

    const notificacionesCollection = collection(this.firestore, 'notificaciones');
    const notificacionesQuery = query(
      notificacionesCollection,
      where('usuarioId', '==', usuarioActual.id),
      where('leida', '==', false)
    );

    const snapshot = await getDocs(notificacionesQuery);
    const batch = writeBatch(this.firestore);

    snapshot.docs.forEach(docSnapshot => {
      batch.update(docSnapshot.ref, { leida: true });
    });

    await batch.commit();
    console.log(`✅ ${snapshot.docs.length} notificaciones marcadas como leídas`);
  }

  // Eliminar notificación
  async eliminarNotificacion(notificacionId: string) {
    const docRef = doc(this.firestore, 'notificaciones', notificacionId);
    await deleteDoc(docRef);
  }

  // Eliminar todas las notificaciones leídas
  async eliminarTodasLeidas() {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) return;

    const notificacionesCollection = collection(this.firestore, 'notificaciones');
    const notificacionesQuery = query(
      notificacionesCollection,
      where('usuarioId', '==', usuarioActual.id),
      where('leida', '==', true)
    );

    const snapshot = await getDocs(notificacionesQuery);
    const batch = writeBatch(this.firestore);

    snapshot.docs.forEach(docSnapshot => {
      batch.delete(docSnapshot.ref);
    });

    await batch.commit();
    console.log(`✅ ${snapshot.docs.length} notificaciones eliminadas`);
  }

  // Crear notificación de foto aprobada
  async notificarFotoAprobada(usuarioId: string) {
    console.log(`🔔 Creando notificación de foto aprobada para usuario ${usuarioId}...`);

    const notificacionesCollection = collection(this.firestore, 'notificaciones');
    const docRef = await addDoc(notificacionesCollection, {
      usuarioId,
      tipo: 'foto_aprobada',
      titulo: 'Foto aprobada',
      mensaje: '¡Tu foto de perfil ha sido aprobada! Ya está visible para todos los usuarios.',
      leida: false,
      fecha: serverTimestamp(),
      accion: {
        tipo: 'navegar',
        ruta: '/perfil'
      }
    });

    console.log(`✅ Notificación de foto aprobada creada con ID: ${docRef.id}`);
  }

  // Crear notificación de foto rechazada
  async notificarFotoRechazada(usuarioId: string, motivo: string) {
    console.log(`🔔 Creando notificación de foto rechazada para usuario ${usuarioId}...`);
    console.log(`📋 Motivo:`, motivo);

    const notificacionesCollection = collection(this.firestore, 'notificaciones');
    const docRef = await addDoc(notificacionesCollection, {
      usuarioId,
      tipo: 'foto_rechazada',
      titulo: 'Foto rechazada',
      mensaje: motivo
        ? `Tu foto de perfil fue rechazada. Motivo: ${motivo}`
        : 'Tu foto de perfil fue rechazada por el administrador. Por favor, sube una nueva foto.',
      leida: false,
      fecha: serverTimestamp(),
      fotoRelacionada: {
        motivo: motivo
      },
      accion: {
        tipo: 'navegar',
        ruta: '/perfil'
      }
    });

    console.log(`✅ Notificación de foto rechazada creada con ID: ${docRef.id}`);
  }

  // Cleanup al destruir el servicio
  ngOnDestroy() {
    console.log('🔕 Limpiando servicio de notificaciones...');

    if (this.listener) {
      this.listener.unsubscribe();
      this.listener = null;
    }

    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
      this.authSubscription = null;
    }

    this.listenerIniciado = false;
    this.notificaciones$.complete();
    this.notificacionesNoLeidas$.complete();
  }
}
