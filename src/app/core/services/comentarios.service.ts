import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, Timestamp } from '@angular/fire/firestore';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Comentario, CrearComentarioDTO, EstadisticasCalificacion } from '../models/comentario.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ComentariosService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  private comentarios$ = new BehaviorSubject<Comentario[]>([]);

  constructor() {}

  /**
   * Crear un nuevo comentario y calificación
   */
  async crearComentario(dto: CrearComentarioDTO): Promise<void> {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) {
      throw new Error('Usuario no autenticado');
    }

    // Validar calificación
    if (dto.calificacion < 1 || dto.calificacion > 5) {
      throw new Error('La calificación debe estar entre 1 y 5');
    }

    // Validar comentario
    if (!dto.comentario || dto.comentario.trim().length < 10) {
      throw new Error('El comentario debe tener al menos 10 caracteres');
    }

    if (dto.comentario.length > 500) {
      throw new Error('El comentario no puede tener más de 500 caracteres');
    }

    // Verificar que no se califique a sí mismo
    if (dto.usuarioCalificadoId === usuarioActual.id) {
      throw new Error('No puedes calificarte a ti mismo');
    }

    const comentariosRef = collection(this.firestore, 'comentarios');

    const nuevoComentario = {
      usuarioId: usuarioActual.id,
      usuarioCalificadoId: dto.usuarioCalificadoId,
      nombre: usuarioActual.nombre,
      foto: usuarioActual.foto || '',
      calificacion: dto.calificacion,
      comentario: dto.comentario.trim(),
      fecha: serverTimestamp(),
      articuloRelacionadoId: dto.articuloRelacionadoId || '',
      articuloNombre: ''
    };

    await addDoc(comentariosRef, nuevoComentario);

    // Actualizar calificación promedio del usuario
    await this.actualizarCalificacionUsuario(dto.usuarioCalificadoId);
  }

  /**
   * Obtener comentarios de un usuario específico
   */
  obtenerComentariosUsuario(usuarioId: string): Observable<Comentario[]> {
    const comentariosRef = collection(this.firestore, 'comentarios');
    const q = query(
      comentariosRef,
      where('usuarioCalificadoId', '==', usuarioId),
      orderBy('fecha', 'desc')
    );

    return from(getDocs(q)).pipe(
      map(snapshot => {
        const comentarios: Comentario[] = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          comentarios.push({
            id: doc.id,
            usuarioId: data['usuarioId'],
            usuarioCalificadoId: data['usuarioCalificadoId'],
            nombre: data['nombre'],
            foto: data['foto'] || '',
            calificacion: data['calificacion'],
            comentario: data['comentario'],
            fecha: data['fecha'] instanceof Timestamp
              ? data['fecha'].toDate()
              : new Date(data['fecha']),
            articuloRelacionadoId: data['articuloRelacionadoId'],
            articuloNombre: data['articuloNombre']
          });
        });
        return comentarios;
      })
    );
  }

  /**
   * Obtener estadísticas de calificación de un usuario
   */
  async obtenerEstadisticasCalificacion(usuarioId: string): Promise<EstadisticasCalificacion> {
    const comentariosRef = collection(this.firestore, 'comentarios');
    const q = query(
      comentariosRef,
      where('usuarioCalificadoId', '==', usuarioId)
    );

    const snapshot = await getDocs(q);

    const estadisticas: EstadisticasCalificacion = {
      totalComentarios: snapshot.size,
      promedioCalificacion: 0,
      estrellas5: 0,
      estrellas4: 0,
      estrellas3: 0,
      estrellas2: 0,
      estrellas1: 0
    };

    if (snapshot.empty) {
      return estadisticas;
    }

    let sumaCalificaciones = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      const calificacion = data['calificacion'];
      sumaCalificaciones += calificacion;

      switch (calificacion) {
        case 5: estadisticas.estrellas5++; break;
        case 4: estadisticas.estrellas4++; break;
        case 3: estadisticas.estrellas3++; break;
        case 2: estadisticas.estrellas2++; break;
        case 1: estadisticas.estrellas1++; break;
      }
    });

    estadisticas.promedioCalificacion = sumaCalificaciones / snapshot.size;

    return estadisticas;
  }

  /**
   * Actualizar calificación promedio del usuario en su perfil
   */
  private async actualizarCalificacionUsuario(usuarioId: string): Promise<void> {
    try {
      const estadisticas = await this.obtenerEstadisticasCalificacion(usuarioId);

      // Actualizar el campo de calificación en el documento del usuario
      // Esto se hará a través del AuthService
      await this.authService.actualizarCalificacionUsuario(
        usuarioId,
        estadisticas.promedioCalificacion
      );
    } catch (error) {
      console.error('Error al actualizar calificación del usuario:', error);
    }
  }

  /**
   * Verificar si el usuario actual ya calificó a otro usuario
   */
  async yaCalificado(usuarioCalificadoId: string): Promise<boolean> {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) return false;

    const comentariosRef = collection(this.firestore, 'comentarios');
    const q = query(
      comentariosRef,
      where('usuarioId', '==', usuarioActual.id),
      where('usuarioCalificadoId', '==', usuarioCalificadoId)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }
}
