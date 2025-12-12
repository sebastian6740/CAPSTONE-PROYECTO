import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Firestore, collection, collectionData, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, where, Timestamp, getDocs, writeBatch } from '@angular/fire/firestore';
import { Storage, ref, uploadString, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { Mensaje, Conversacion, ConversacionConDetalles } from '../models/mensaje.model';
import { AuthService } from './auth.service';
import { Usuario } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class MensajesService {
  private conversaciones: Conversacion[] = [];
  private mensajes: Mensaje[] = [];
  private usuariosCache: Usuario[] = [];

  private conversaciones$ = new BehaviorSubject<Conversacion[]>([]);
  private mensajesNoLeidos$ = new BehaviorSubject<number>(0);

  // Listeners de Firestore
  private conversacionesListener: any;
  private mensajesListeners: Map<string, any> = new Map();
  private mensajesBehaviorSubjects: Map<string, BehaviorSubject<Mensaje[]>> = new Map();

  constructor(
    private firestore: Firestore,
    private storage: Storage,
    private authService: AuthService,
    private ngZone: NgZone
  ) {
    // Registrar este servicio en AuthService para que pueda reiniciar listeners
    this.authService.setMensajesService(this);
    this.inicializar();
  }

  private async inicializar() {
    // Iniciar listener inmediatamente, no esperar a cargar usuarios
    this.iniciarListenerConversaciones();

    // Cargar usuarios en paralelo (no bloqueante)
    this.cargarUsuarios();
  }

  // Cargar usuarios en cache
  private async cargarUsuarios() {
    try {
      this.usuariosCache = await this.authService.obtenerTodosUsuarios();
      console.log(`✅ ${this.usuariosCache.length} usuarios cargados en cache`);
    } catch (error) {
      console.error('❌ Error al cargar usuarios en cache:', error);
    }
  }

  // Listener en tiempo real de conversaciones del usuario actual
  private iniciarListenerConversaciones() {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) {
      console.warn('⚠️ No hay usuario autenticado para cargar conversaciones');
      return;
    }

    console.log('💬 Iniciando listener de conversaciones...');

    const conversacionesCollection = collection(this.firestore, 'conversaciones');
    // Sin orderBy para evitar necesidad de índice compuesto - ordenaremos en memoria
    const conversacionesQuery = query(
      conversacionesCollection,
      where('participantes', 'array-contains', usuarioActual.id)
    );

    this.conversacionesListener = collectionData(conversacionesQuery, { idField: 'id' }).subscribe({
      next: (conversaciones: any[]) => {
        console.log(`✅ ${conversaciones.length} conversaciones cargadas desde Firestore`);

        // Convertir Timestamp a Date, asegurar mensajesNoLeidos y ordenar
        this.conversaciones = conversaciones
          .map(conv => {
            // Asegurar que mensajesNoLeidos existe y tiene valores por defecto
            const mensajesNoLeidos = conv.mensajesNoLeidos || {};

            // Si no tiene el campo para los participantes, inicializarlo
            conv.participantes.forEach((userId: string) => {
              if (mensajesNoLeidos[userId] === undefined) {
                mensajesNoLeidos[userId] = 0;
              }
            });

            console.log(`📬 Conversación ${conv.id} - mensajesNoLeidos:`, mensajesNoLeidos);

            return {
              ...conv,
              ultimaActualizacion: conv.ultimaActualizacion instanceof Timestamp
                ? conv.ultimaActualizacion.toDate()
                : new Date(conv.ultimaActualizacion || Date.now()),
              mensajesNoLeidos: mensajesNoLeidos
            };
          })
          .sort((a, b) => {
            const timeA = a.ultimaActualizacion?.getTime() || 0;
            const timeB = b.ultimaActualizacion?.getTime() || 0;
            return timeB - timeA; // Más recientes primero
          });

        console.log(`📊 Total conversaciones procesadas: ${this.conversaciones.length}`);
        console.log(`📋 Detalles de conversaciones:`, this.conversaciones.map(c => ({
          id: c.id,
          participantes: c.participantes,
          mensajesNoLeidos: c.mensajesNoLeidos
        })));

        this.ngZone.run(() => {
          this.actualizarObservables();
        });
      },
      error: (error) => {
        console.error('❌ Error al cargar conversaciones:', error);
        // Intentar reconectar en caso de error de red
        if (error.code === 'unavailable') {
          console.log('🔄 Reconectando en 3 segundos...');
          setTimeout(() => this.iniciarListenerConversaciones(), 3000);
        }
      }
    });
  }

  private actualizarObservables() {
    this.conversaciones$.next(this.conversaciones);
    this.actualizarContadorNoLeidos();
  }

  private actualizarContadorNoLeidos() {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) {
      this.mensajesNoLeidos$.next(0);
      return;
    }

    let total = 0;
    this.conversaciones.forEach(conv => {
      const noLeidos = conv.mensajesNoLeidos?.[usuarioActual.id] || 0;
      total += noLeidos;
    });

    this.mensajesNoLeidos$.next(total);
  }

  // Obtener todas las conversaciones del usuario actual
  obtenerConversaciones(): Observable<Conversacion[]> {
    return this.conversaciones$.asObservable();
  }

  // Obtener conversaciones con detalles completos (incluyendo info del otro usuario)
  obtenerConversacionesConDetalles(): ConversacionConDetalles[] {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) return [];

    return this.conversaciones
      .filter(conv => conv.participantes.includes(usuarioActual.id))
      .map(conv => {
        const otroUsuarioId = conv.participantes.find((id: string) => id !== usuarioActual.id) || '';
        const otroUsuario = this.obtenerUsuarioPorId(otroUsuarioId);

        const ultimoMensajeObj = this.mensajes
          .filter((m: Mensaje) => m.conversacionId === conv.id)
          .sort((a: Mensaje, b: Mensaje) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        return {
          ...conv,
          otroUsuario: {
            usuarioId: otroUsuario?.id || '',
            nombre: otroUsuario?.nombre || 'Usuario desconocido',
            foto: otroUsuario?.foto
          },
          ultimoMensajeObj
        };
      })
      .sort((a: ConversacionConDetalles, b: ConversacionConDetalles) => new Date(b.ultimaActualizacion).getTime() - new Date(a.ultimaActualizacion).getTime());
  }

  // Iniciar listener de mensajes para una conversación específica
  iniciarListenerMensajes(conversacionId: string): Observable<Mensaje[]> {
    console.log(`💬 Iniciando listener de mensajes para conversación ${conversacionId}...`);

    // Si ya existe un listener activo, reutilizarlo
    if (this.mensajesListeners.has(conversacionId) && this.mensajesBehaviorSubjects.has(conversacionId)) {
      console.log(`✅ Reutilizando listener existente para conversación ${conversacionId}`);
      const behaviorSubject = this.mensajesBehaviorSubjects.get(conversacionId)!;

      // Verificar si el BehaviorSubject aún está activo
      if (!behaviorSubject.closed) {
        return behaviorSubject.asObservable();
      } else {
        console.log(`⚠️ BehaviorSubject cerrado, creando nuevo listener...`);
        this.detenerListenerMensajes(conversacionId);
      }
    }

    // Crear nuevo BehaviorSubject para esta conversación
    const mensajes$ = new BehaviorSubject<Mensaje[]>([]);
    this.mensajesBehaviorSubjects.set(conversacionId, mensajes$);

    const mensajesCollection = collection(this.firestore, 'mensajes');
    // Sin orderBy para evitar necesidad de índice compuesto - ordenaremos en memoria
    const mensajesQuery = query(
      mensajesCollection,
      where('conversacionId', '==', conversacionId)
    );

    const listener = collectionData(mensajesQuery, { idField: 'id' }).subscribe({
      next: (mensajes: any[]) => {
        console.log(`💬 Firestore listener activado - Mensajes recibidos: ${mensajes.length} para conversación ${conversacionId}`);

        // Convertir Timestamp a Date, ordenar por timestamp (más antiguos primero)
        const mensajesFormateados = mensajes
          .map(msg => ({
            ...msg,
            timestamp: msg.timestamp instanceof Timestamp ? msg.timestamp.toDate() : new Date(msg.timestamp || Date.now())
          }))
          .sort((a, b) => {
            const timeA = a.timestamp?.getTime() || 0;
            const timeB = b.timestamp?.getTime() || 0;
            return timeA - timeB; // Más antiguos primero (orden cronológico)
          });

        // Actualizar cache local de mensajes
        this.mensajes = this.mensajes.filter(m => m.conversacionId !== conversacionId);
        this.mensajes.push(...mensajesFormateados);

        // Actualizar el BehaviorSubject específico de esta conversación
        this.ngZone.run(() => {
          console.log(`🔄 Actualizando BehaviorSubject con ${mensajesFormateados.length} mensajes`);
          mensajes$.next([...mensajesFormateados]); // Usar spread para crear nuevo array
        });
      },
      error: (error) => {
        console.error(`❌ Error al cargar mensajes de conversación ${conversacionId}:`, error);
        // Intentar reconectar en caso de error de red
        if (error.code === 'unavailable') {
          console.log('🔄 Reconectando en 3 segundos...');
          setTimeout(() => {
            // Reiniciar listener
            this.detenerListenerMensajes(conversacionId);
            this.iniciarListenerMensajes(conversacionId);
          }, 3000);
        }
      }
    });

    this.mensajesListeners.set(conversacionId, listener);
    console.log(`✅ Listener creado y BehaviorSubject inicializado para conversación ${conversacionId}`);
    return mensajes$.asObservable();
  }

  // Detener listener de mensajes
  detenerListenerMensajes(conversacionId: string) {
    const listener = this.mensajesListeners.get(conversacionId);
    if (listener) {
      listener.unsubscribe();
      this.mensajesListeners.delete(conversacionId);
      console.log(`🛑 Listener de mensajes detenido para conversación ${conversacionId}`);
    }

    // Limpiar BehaviorSubject
    const behaviorSubject = this.mensajesBehaviorSubjects.get(conversacionId);
    if (behaviorSubject) {
      behaviorSubject.complete();
      this.mensajesBehaviorSubjects.delete(conversacionId);
      console.log(`🗑️ BehaviorSubject eliminado para conversación ${conversacionId}`);
    }
  }

  // Obtener mensajes de una conversación específica (desde cache)
  obtenerMensajesDeConversacion(conversacionId: string): Mensaje[] {
    return this.mensajes
      .filter(m => m.conversacionId === conversacionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Obtener o crear conversación entre dos usuarios
  async obtenerOCrearConversacion(otroUsuarioId: string, articuloRelacionado?: { id: string, nombre: string, foto?: string }): Promise<Conversacion> {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) {
      throw new Error('No hay usuario autenticado');
    }

    console.log(`🔍 Buscando conversación entre ${usuarioActual.id} y ${otroUsuarioId}...`);

    // Buscar si ya existe una conversación entre estos usuarios
    let conversacion = this.conversaciones.find(c =>
      c.participantes.includes(usuarioActual.id) && c.participantes.includes(otroUsuarioId)
    );

    if (!conversacion) {
      console.log('📝 Creando nueva conversación...');

      // Crear nueva conversación en Firestore
      const conversacionesCollection = collection(this.firestore, 'conversaciones');
      const nuevaConversacion = {
        participantes: [usuarioActual.id, otroUsuarioId],
        ultimaActualizacion: serverTimestamp(),
        articuloRelacionado: articuloRelacionado || null,
        mensajesNoLeidos: {
          [usuarioActual.id]: 0,
          [otroUsuarioId]: 0
        }
      };

      const docRef = await addDoc(conversacionesCollection, nuevaConversacion);
      console.log(`✅ Conversación creada con ID: ${docRef.id}`);

      conversacion = {
        id: docRef.id,
        ...nuevaConversacion,
        ultimaActualizacion: new Date()
      } as Conversacion;

      // Agregar a cache local temporalmente (el listener la actualizará)
      this.conversaciones.push(conversacion);
      this.actualizarObservables();
    }

    return conversacion;
  }

  // Enviar un mensaje
  async enviarMensaje(conversacionId: string, contenido: string): Promise<Mensaje> {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) {
      throw new Error('No hay usuario autenticado');
    }

    console.log(`📤 Usuario ${usuarioActual.id} (${usuarioActual.nombre}) enviando mensaje...`);

    const conversacion = this.conversaciones.find(c => c.id === conversacionId);
    if (!conversacion) {
      console.error(`❌ Conversación ${conversacionId} no encontrada en cache`);
      console.log(`📋 Total conversaciones en cache: ${this.conversaciones.length}`);
      console.log(`📋 IDs disponibles:`, this.conversaciones.map(c => c.id));
      throw new Error('Conversación no encontrada');
    }

    const receptorId = conversacion.participantes.find(id => id !== usuarioActual.id) || '';

    console.log(`📤 Enviando mensaje en conversación ${conversacionId}...`);
    console.log(`👤 Emisor: ${usuarioActual.id} (${usuarioActual.nombre})`);
    console.log(`👥 Receptor: ${receptorId}`);
    console.log(`👥 Participantes de la conversación:`, conversacion.participantes);
    console.log(`📝 Contenido: "${contenido}"`);

    try {
      // Crear mensaje en Firestore
      const mensajesCollection = collection(this.firestore, 'mensajes');
      const nuevoMensaje = {
        conversacionId,
        emisorId: usuarioActual.id,
        receptorId,
        tipo: 'texto' as const,
        contenido,
        timestamp: serverTimestamp(),
        leido: false
      };

      const docRef = await addDoc(mensajesCollection, nuevoMensaje);
      console.log(`✅ Mensaje guardado en Firestore con ID: ${docRef.id}`);

      // Actualizar conversación en Firestore
      const conversacionDoc = doc(this.firestore, 'conversaciones', conversacionId);

      // Asegurar que mensajesNoLeidos existe para ambos participantes
      const mensajesNoLeidosActual = conversacion.mensajesNoLeidos || {};
      const nuevosNoLeidos = {
        [usuarioActual.id]: mensajesNoLeidosActual[usuarioActual.id] || 0,
        [receptorId]: (mensajesNoLeidosActual[receptorId] || 0) + 1
      };

      console.log(`📊 Actualizando contador de no leídos:`, {
        antes: conversacion.mensajesNoLeidos,
        despues: nuevosNoLeidos,
        receptorId,
        incremento: '+1'
      });

      await updateDoc(conversacionDoc, {
        ultimoMensaje: contenido,
        ultimaActualizacion: serverTimestamp(),
        mensajesNoLeidos: nuevosNoLeidos
      });

      console.log(`✅ Conversación actualizada en Firestore con ${nuevosNoLeidos[receptorId]} mensajes no leídos para receptor`);

      // Retornar mensaje (el listener lo actualizará en tiempo real)
      return {
        id: docRef.id,
        ...nuevoMensaje,
        timestamp: new Date()
      } as Mensaje;
    } catch (error) {
      console.error('❌ Error al enviar mensaje a Firestore:', error);
      throw error;
    }
  }

  // Subir foto a Firebase Storage
  private async subirFotoAStorage(
    conversacionId: string,
    fotoBase64: string,
    metadata: { nombre: string; tamanio: number; ancho?: number; alto?: number }
  ): Promise<string> {
    // Validar tamaño máximo 5MB
    const MAX_SIZE = 5 * 1024 * 1024;
    if (metadata.tamanio > MAX_SIZE) {
      throw new Error('La foto no puede superar 5MB');
    }

    const timestamp = Date.now();
    const mensajeId = `msg_${timestamp}`;

    // Crear referencia en Storage
    const storageRef = ref(
      this.storage,
      `mensajes/${conversacionId}/${mensajeId}_${timestamp}.jpg`
    );

    console.log(`📤 Subiendo foto a Storage: mensajes/${conversacionId}/${mensajeId}_${timestamp}.jpg`);

    // Subir con metadata
    await uploadString(storageRef, fotoBase64, 'data_url', {
      contentType: 'image/jpeg',
      customMetadata: {
        conversacionId,
        uploadedBy: this.authService.getUsuarioActualSync()?.id || '',
        uploadedAt: new Date().toISOString()
      }
    });

    // Obtener URL de descarga
    const downloadURL = await getDownloadURL(storageRef);
    console.log(`✅ Foto subida correctamente: ${downloadURL}`);
    return downloadURL;
  }

  // Enviar mensaje con foto
  async enviarFotoMensaje(
    conversacionId: string,
    fotoBase64: string,
    caption: string = '',
    metadata: { nombre: string; tamanio: number; ancho?: number; alto?: number }
  ): Promise<Mensaje> {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) {
      throw new Error('No hay usuario autenticado');
    }

    const conversacion = this.conversaciones.find(c => c.id === conversacionId);
    if (!conversacion) {
      throw new Error('Conversación no encontrada');
    }

    const receptorId = conversacion.participantes.find(id => id !== usuarioActual.id) || '';

    console.log(`📸 Enviando mensaje con foto en conversación ${conversacionId}...`);

    // Primero, crear mensaje con estado 'subiendo'
    const mensajesCollection = collection(this.firestore, 'mensajes');
    const docRef = await addDoc(mensajesCollection, {
      conversacionId,
      emisorId: usuarioActual.id,
      receptorId,
      tipo: 'foto',
      contenido: caption,
      timestamp: serverTimestamp(),
      leido: false,
      estado: 'subiendo'
    });

    try {
      // Subir foto a Storage
      const fotoUrl = await this.subirFotoAStorage(conversacionId, fotoBase64, metadata);

      // Actualizar mensaje con URL y estado completado
      await updateDoc(doc(this.firestore, 'mensajes', docRef.id), {
        fotoUrl,
        fotoMetadata: metadata,
        estado: 'completado'
      });

      // Actualizar conversación
      const conversacionDoc = doc(this.firestore, 'conversaciones', conversacionId);
      const mensajesNoLeidosActual = conversacion.mensajesNoLeidos || {};
      const nuevosNoLeidos = {
        [usuarioActual.id]: mensajesNoLeidosActual[usuarioActual.id] || 0,
        [receptorId]: (mensajesNoLeidosActual[receptorId] || 0) + 1
      };

      await updateDoc(conversacionDoc, {
        ultimoMensaje: caption || '📷 Foto',
        ultimaActualizacion: serverTimestamp(),
        mensajesNoLeidos: nuevosNoLeidos
      });

      console.log(`✅ Mensaje con foto enviado correctamente`);

      return {
        id: docRef.id,
        conversacionId,
        emisorId: usuarioActual.id,
        receptorId,
        tipo: 'foto',
        contenido: caption,
        fotoUrl,
        fotoMetadata: metadata,
        timestamp: new Date(),
        leido: false,
        estado: 'completado'
      } as Mensaje;

    } catch (error) {
      // Marcar mensaje como error
      await updateDoc(doc(this.firestore, 'mensajes', docRef.id), {
        estado: 'error',
        errorMensaje: error instanceof Error ? error.message : 'Error al subir foto'
      });
      console.error('❌ Error al enviar foto:', error);
      throw error;
    }
  }

  // Marcar mensajes como leídos
  async marcarComoLeido(conversacionId: string) {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) return;

    console.log(`👁️ Marcando mensajes como leídos en conversación ${conversacionId}...`);

    const conversacion = this.conversaciones.find(c => c.id === conversacionId);
    if (!conversacion) return;

    // Actualizar cache local inmediatamente para que el UI se actualice de inmediato
    if (conversacion.mensajesNoLeidos && conversacion.mensajesNoLeidos[usuarioActual.id] > 0) {
      console.log(`📊 Actualizando contador local: ${conversacion.mensajesNoLeidos[usuarioActual.id]} → 0`);
      conversacion.mensajesNoLeidos[usuarioActual.id] = 0;

      // Forzar actualización de observables para que el UI se actualice
      this.ngZone.run(() => {
        this.actualizarObservables();
      });
    }

    try {
      // Usar batch para actualizar múltiples documentos
      const batch = writeBatch(this.firestore);

      // Obtener mensajes no leídos
      const mensajesCollection = collection(this.firestore, 'mensajes');
      const mensajesQuery = query(
        mensajesCollection,
        where('conversacionId', '==', conversacionId),
        where('receptorId', '==', usuarioActual.id),
        where('leido', '==', false)
      );

      const snapshot = await getDocs(mensajesQuery);
      snapshot.docs.forEach(docSnapshot => {
        batch.update(docSnapshot.ref, { leido: true });
      });

      await batch.commit();

      // Actualizar contador de no leídos en conversación en Firestore
      const conversacionDoc = doc(this.firestore, 'conversaciones', conversacionId);
      await updateDoc(conversacionDoc, {
        [`mensajesNoLeidos.${usuarioActual.id}`]: 0
      });

      console.log(`✅ ${snapshot.docs.length} mensajes marcados como leídos`);
    } catch (error) {
      console.error('❌ Error al marcar mensajes como leídos:', error);
    }
  }

  // Obtener conversación por ID
  obtenerConversacionPorId(id: string): Conversacion | undefined {
    return this.conversaciones.find(c => c.id === id);
  }

  // Obtener cantidad de mensajes no leídos
  obtenerMensajesNoLeidos(): Observable<number> {
    return this.mensajesNoLeidos$.asObservable();
  }

  // Eliminar conversación
  async eliminarConversacion(conversacionId: string) {
    try {
      console.log(`🗑️ Eliminando conversación ${conversacionId}...`);

      // Eliminar todos los mensajes de la conversación
      const mensajesCollection = collection(this.firestore, 'mensajes');
      const mensajesQuery = query(mensajesCollection, where('conversacionId', '==', conversacionId));
      const snapshot = await getDocs(mensajesQuery);

      const batch = writeBatch(this.firestore);
      snapshot.docs.forEach(docSnapshot => {
        batch.delete(docSnapshot.ref);
      });
      await batch.commit();

      console.log(`✅ ${snapshot.docs.length} mensajes eliminados`);

      // Eliminar conversación
      const conversacionDoc = doc(this.firestore, 'conversaciones', conversacionId);
      await deleteDoc(conversacionDoc);

      console.log('✅ Conversación eliminada correctamente');

      // Detener listener de mensajes si existe
      this.detenerListenerMensajes(conversacionId);
    } catch (error) {
      console.error('❌ Error al eliminar conversación:', error);
      throw error;
    }
  }

  // Helper para obtener usuario por ID (usa cache)
  private obtenerUsuarioPorId(usuarioId: string): Usuario | undefined {
    return this.usuariosCache.find((u: Usuario) => u.id === usuarioId);
  }

  // Reiniciar todos los listeners (útil al cambiar de usuario)
  reiniciarListeners() {
    console.log('🔄 Reiniciando todos los listeners...');

    // Detener listener de conversaciones
    if (this.conversacionesListener) {
      this.conversacionesListener.unsubscribe();
      this.conversacionesListener = null;
    }

    // Detener todos los listeners de mensajes
    this.mensajesListeners.forEach(listener => listener.unsubscribe());
    this.mensajesListeners.clear();

    // Completar y limpiar todos los BehaviorSubjects
    this.mensajesBehaviorSubjects.forEach(subject => subject.complete());
    this.mensajesBehaviorSubjects.clear();

    // Limpiar cache
    this.conversaciones = [];
    this.mensajes = [];

    // Actualizar observables
    this.conversaciones$.next([]);
    this.mensajesNoLeidos$.next(0);

    // Reiniciar listener de conversaciones
    this.iniciarListenerConversaciones();

    console.log('✅ Listeners reiniciados correctamente');
  }

  // Cleanup al destruir el servicio
  ngOnDestroy() {
    if (this.conversacionesListener) {
      this.conversacionesListener.unsubscribe();
    }
    this.mensajesListeners.forEach(listener => listener.unsubscribe());
    this.mensajesListeners.clear();

    // Limpiar BehaviorSubjects
    this.mensajesBehaviorSubjects.forEach(subject => subject.complete());
    this.mensajesBehaviorSubjects.clear();
  }
}
