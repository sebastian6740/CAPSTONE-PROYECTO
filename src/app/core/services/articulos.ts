import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Firestore, collection, collectionData, addDoc, doc, deleteDoc, updateDoc, serverTimestamp, query, Timestamp, getDoc } from '@angular/fire/firestore';
import { Storage, ref, uploadString, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { AuthService } from './auth.service';
import { NotificacionesService } from './notificaciones.service';

export interface Articulo {
  id?: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  fotos: string[]; // URLs de Firebase Storage
  fechaPublicacion?: Date | Timestamp;
  usuarioId?: string;
  disponible?: boolean; // true = disponible (verde), false = permutado (rojo)
  aprobado?: boolean; // true = aprobado por admin, false = pendiente de aprobación
  fechaAprobacion?: Date | Timestamp;
  aprobadoPor?: string; // ID del admin que aprobó
}

@Injectable({
  providedIn: 'root'
})
export class ArticulosService {

  private articulosSubject = new BehaviorSubject<Articulo[]>([]);
  public articulos$: Observable<Articulo[]> = this.articulosSubject.asObservable();

  constructor(
    private firestore: Firestore,
    private storage: Storage,
    private authService: AuthService,
    private ngZone: NgZone,
    private notificacionesService: NotificacionesService
  ) {
    this.cargarArticulos();
  }

  // Cargar artículos desde Firestore con listener en tiempo real
  cargarArticulos() {
    try {
      console.log('📦 Iniciando carga de artículos desde Firestore...');
      const articulosCollection = collection(this.firestore, 'articulos');

      // Sin orderBy para evitar necesidad de índice compuesto - ordenaremos en memoria
      const articulosQuery = query(articulosCollection);

      // Listener en tiempo real
      collectionData(articulosQuery, { idField: 'id' }).subscribe({
        next: (articulos: any[]) => {
          console.log(`✅ ${articulos.length} artículos cargados`);

          // Convertir Timestamp a Date y ordenar por fecha (más recientes primero)
          const articulosFormateados = articulos
            .map(art => ({
              ...art,
              fechaPublicacion: art.fechaPublicacion instanceof Timestamp
                ? art.fechaPublicacion.toDate()
                : new Date(art.fechaPublicacion || Date.now())
            }))
            .sort((a, b) => {
              const fechaA = a.fechaPublicacion?.getTime() || 0;
              const fechaB = b.fechaPublicacion?.getTime() || 0;
              return fechaB - fechaA; // Más recientes primero
            });

          this.ngZone.run(() => {
            this.articulosSubject.next(articulosFormateados);
          });
        },
        error: (error) => {
          console.error('❌ Error al cargar artículos:', error);
          // Intentar reconectar en caso de error de red
          if (error.code === 'unavailable') {
            console.log('🔄 Reconectando en 3 segundos...');
            setTimeout(() => this.cargarArticulos(), 3000);
          }
        }
      });
    } catch (error) {
      console.error('❌ Error al configurar listener de artículos:', error);
    }
  }

  // Obtener todos los artículos
  getArticulos(): Articulo[] {
    return this.articulosSubject.value;
  }

  // Subir imagen a Firebase Storage
  private async subirImagenAStorage(articuloId: string, imagenBase64: string, index: number): Promise<string> {
    try {
      console.log(`📤 Subiendo imagen ${index} para artículo ${articuloId}...`);

      // Crear referencia en Storage
      const imagenRef = ref(this.storage, `articulos/${articuloId}/foto-${index}.jpg`);

      // Subir imagen (base64)
      await uploadString(imagenRef, imagenBase64, 'data_url');

      // Obtener URL de descarga
      const downloadURL = await getDownloadURL(imagenRef);
      console.log(`✅ Imagen ${index} subida correctamente`);

      return downloadURL;
    } catch (error) {
      console.error(`❌ Error al subir imagen ${index}:`, error);
      throw error;
    }
  }

  // Agregar nuevo artículo
  async agregarArticulo(articulo: Articulo) {
    try {
      console.log('📝 Agregando nuevo artículo...');
      const usuarioActual = this.authService.getUsuarioActualSync();

      if (!usuarioActual) {
        throw new Error('No hay usuario autenticado');
      }

      // Crear documento en Firestore primero (sin fotos)
      const articulosCollection = collection(this.firestore, 'articulos');
      const docRef = await addDoc(articulosCollection, {
        nombre: articulo.nombre,
        descripcion: articulo.descripcion,
        categoria: articulo.categoria,
        fotos: [], // Temporalmente vacío
        fechaPublicacion: serverTimestamp(),
        usuarioId: usuarioActual.id,
        disponible: true,
        aprobado: false // Por defecto requiere aprobación de admin
      });

      console.log(`✅ Artículo creado con ID: ${docRef.id}`);

      // Subir fotos a Storage y obtener URLs
      const fotosURLs: string[] = [];
      if (articulo.fotos && articulo.fotos.length > 0) {
        console.log(`📸 Subiendo ${articulo.fotos.length} fotos...`);

        for (let i = 0; i < articulo.fotos.length; i++) {
          const fotoURL = await this.subirImagenAStorage(docRef.id, articulo.fotos[i], i);
          fotosURLs.push(fotoURL);
        }
      }

      // Actualizar documento con URLs de fotos
      await updateDoc(doc(this.firestore, 'articulos', docRef.id), {
        fotos: fotosURLs
      });

      console.log('✅ Artículo completado con fotos');

      // Retornar artículo completo
      return {
        id: docRef.id,
        nombre: articulo.nombre,
        descripcion: articulo.descripcion,
        categoria: articulo.categoria,
        fotos: fotosURLs,
        fechaPublicacion: new Date(),
        usuarioId: usuarioActual.id,
        disponible: true
      };
    } catch (error) {
      console.error('❌ Error al agregar artículo:', error);
      throw error;
    }
  }

  // Obtener artículos por categoría
  getArticulosPorCategoria(categoria: string): Articulo[] {
    return this.articulosSubject.value.filter(art => art.categoria === categoria);
  }

  // Eliminar imágenes de Storage
  private async eliminarImagenesDeStorage(articuloId: string, fotos: string[]) {
    try {
      console.log(`🗑️ Eliminando ${fotos.length} imágenes de Storage...`);

      for (let i = 0; i < fotos.length; i++) {
        try {
          const imagenRef = ref(this.storage, `articulos/${articuloId}/foto-${i}.jpg`);
          await deleteObject(imagenRef);
          console.log(`✅ Imagen ${i} eliminada`);
        } catch (error: any) {
          // Si la imagen no existe, continuar
          if (error.code !== 'storage/object-not-found') {
            console.error(`⚠️ Error al eliminar imagen ${i}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error al eliminar imágenes:', error);
    }
  }

  // Eliminar artículo (solo propietario o admin)
  async eliminarArticulo(id: string) {
    try {
      console.log(`🗑️ Eliminando artículo ${id}...`);
      const articulo = this.articulosSubject.value.find(art => art.id === id);

      if (!articulo) {
        throw new Error('Artículo no encontrado');
      }

      // Verificar permisos
      if (!this.authService.esAdminOPropietario(articulo.usuarioId || '')) {
        throw new Error('No tienes permisos para eliminar este artículo');
      }

      // Eliminar imágenes de Storage
      if (articulo.fotos && articulo.fotos.length > 0) {
        await this.eliminarImagenesDeStorage(id, articulo.fotos);
      }

      // Eliminar documento de Firestore
      const docRef = doc(this.firestore, 'articulos', id);
      await deleteDoc(docRef);

      console.log('✅ Artículo eliminado correctamente');
    } catch (error) {
      console.error('❌ Error al eliminar artículo:', error);
      throw error;
    }
  }

  // Eliminar artículo como admin (sin validación de propietario)
  async eliminarArticuloComoAdmin(id: string) {
    try {
      console.log(`🗑️ Admin eliminando artículo ${id}...`);

      if (!this.authService.esAdmin()) {
        throw new Error('Acceso denegado: Solo administradores');
      }

      const articulo = this.articulosSubject.value.find(art => art.id === id);

      // Eliminar imágenes de Storage
      if (articulo && articulo.fotos && articulo.fotos.length > 0) {
        await this.eliminarImagenesDeStorage(id, articulo.fotos);
      }

      // Eliminar documento de Firestore
      const docRef = doc(this.firestore, 'articulos', id);
      await deleteDoc(docRef);

      console.log(`✅ Artículo ${id} eliminado por admin`);
    } catch (error) {
      console.error('❌ Error al eliminar artículo como admin:', error);
      throw error;
    }
  }

  // Obtener artículos de un usuario específico
  getArticulosPorUsuario(usuarioId: string): Articulo[] {
    return this.articulosSubject.value.filter(art => art.usuarioId === usuarioId);
  }

  // Cambiar estado de disponibilidad de un artículo
  async cambiarDisponibilidad(id: string, disponible: boolean) {
    try {
      console.log(`🔄 Cambiando disponibilidad de artículo ${id} a ${disponible}...`);

      const articulo = this.articulosSubject.value.find(art => art.id === id);

      if (!articulo) {
        throw new Error('Artículo no encontrado');
      }

      // Verificar que el usuario es el propietario
      const usuarioActual = this.authService.getUsuarioActualSync();

      if (articulo.usuarioId !== usuarioActual?.id) {
        throw new Error('No tienes permisos para modificar este artículo');
      }

      // Actualizar en Firestore
      const docRef = doc(this.firestore, 'articulos', id);
      await updateDoc(docRef, {
        disponible
      });

      console.log(`✅ Artículo ${id} marcado como ${disponible ? 'disponible' : 'permutado'}`);
    } catch (error) {
      console.error('❌ Error al cambiar disponibilidad:', error);
      throw error;
    }
  }

  // Aprobar artículo (solo admin)
  async aprobarArticulo(id: string) {
    try {
      console.log(`✅ Admin aprobando artículo ${id}...`);

      if (!this.authService.esAdmin()) {
        throw new Error('Acceso denegado: Solo administradores');
      }

      const usuarioActual = this.authService.getUsuarioActualSync();
      if (!usuarioActual) {
        throw new Error('No hay usuario autenticado');
      }

      // Obtener datos del artículo antes de aprobar
      const docRef = doc(this.firestore, 'articulos', id);
      const articuloDoc = await getDoc(docRef);

      if (!articuloDoc.exists()) {
        throw new Error('Artículo no encontrado');
      }

      const articulo = articuloDoc.data() as Articulo;

      // Actualizar en Firestore
      await updateDoc(docRef, {
        aprobado: true,
        fechaAprobacion: serverTimestamp(),
        aprobadoPor: usuarioActual.id
      });

      // Enviar notificación al usuario
      if (articulo.usuarioId) {
        await this.notificacionesService.notificarArticuloAprobado(
          articulo.usuarioId,
          articulo.nombre,
          id
        );
      }

      console.log(`✅ Artículo ${id} aprobado por admin y notificación enviada`);
    } catch (error) {
      console.error('❌ Error al aprobar artículo:', error);
      throw error;
    }
  }

  // Rechazar artículo (solo admin) - lo elimina y notifica al usuario
  async rechazarArticulo(id: string, motivo: string) {
    try {
      console.log(`❌ Admin rechazando artículo ${id}...`);

      if (!this.authService.esAdmin()) {
        throw new Error('Acceso denegado: Solo administradores');
      }

      // Obtener datos del artículo antes de eliminar
      const docRef = doc(this.firestore, 'articulos', id);
      const articuloDoc = await getDoc(docRef);

      if (!articuloDoc.exists()) {
        throw new Error('Artículo no encontrado');
      }

      const articulo = articuloDoc.data() as Articulo;

      // Enviar notificación al usuario antes de eliminar
      if (articulo.usuarioId) {
        await this.notificacionesService.notificarArticuloRechazado(
          articulo.usuarioId,
          articulo.nombre,
          id,
          motivo
        );
      }

      // Eliminar el artículo completamente
      await this.eliminarArticuloComoAdmin(id);

      console.log(`✅ Artículo ${id} rechazado, eliminado y notificación enviada`);
    } catch (error) {
      console.error('❌ Error al rechazar artículo:', error);
      throw error;
    }
  }

  // Obtener artículos pendientes de aprobación (solo admin)
  getArticulosPendientes(): Articulo[] {
    if (!this.authService.esAdmin()) {
      return [];
    }
    return this.articulosSubject.value.filter(art => art.aprobado === false);
  }

  // Obtener artículos aprobados (visible para todos)
  getArticulosAprobados(): Articulo[] {
    return this.articulosSubject.value.filter(art => art.aprobado === true);
  }
}
