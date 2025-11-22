import { Injectable } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { BehaviorSubject, Observable } from 'rxjs';
import { AuthService } from './auth.service';

export interface Articulo {
  id?: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  fotos: string[];
  fechaPublicacion?: Date;
  usuarioId?: string;
  disponible?: boolean; // true = disponible (verde), false = permutado (rojo)
}

@Injectable({
  providedIn: 'root'
})
export class ArticulosService {

  private articulosSubject = new BehaviorSubject<Articulo[]>([]);
  public articulos$: Observable<Articulo[]> = this.articulosSubject.asObservable();

  constructor(private authService: AuthService) {
    this.cargarArticulos();
  }

  // Cargar artículos desde storage
  async cargarArticulos() {
    try {
      const { value } = await Preferences.get({ key: 'articulos_publicados' });
      if (value) {
        const articulos = JSON.parse(value);
        this.articulosSubject.next(articulos);
      }
    } catch (error) {
      console.error('Error al cargar artículos:', error);
    }
  }

  // Obtener todos los artículos
  getArticulos(): Articulo[] {
    return this.articulosSubject.value;
  }

  // Agregar nuevo artículo
  async agregarArticulo(articulo: Articulo) {
    try {
      const articulos = this.articulosSubject.value;
      const usuarioActual = this.authService.getUsuarioActualSync();

      // Generar ID único y asignar usuario
      const nuevoArticulo = {
        ...articulo,
        id: Date.now().toString(),
        fechaPublicacion: new Date(),
        usuarioId: usuarioActual?.id || 'unknown',
        disponible: true // Por defecto todos los artículos están disponibles
      };

      articulos.push(nuevoArticulo);

      // Guardar en storage
      await Preferences.set({
        key: 'articulos_publicados',
        value: JSON.stringify(articulos)
      });

      this.articulosSubject.next(articulos);
      return nuevoArticulo;
    } catch (error) {
      console.error('Error al agregar artículo:', error);
      throw error;
    }
  }

  // Obtener artículos por categoría
  getArticulosPorCategoria(categoria: string): Articulo[] {
    return this.articulosSubject.value.filter(art => art.categoria === categoria);
  }

  // Eliminar artículo (solo propietario o admin)
  async eliminarArticulo(id: string) {
    try {
      const articulo = this.articulosSubject.value.find(art => art.id === id);

      if (!articulo) {
        throw new Error('Artículo no encontrado');
      }

      // Verificar permisos
      if (!this.authService.esAdminOPropietario(articulo.usuarioId || '')) {
        throw new Error('No tienes permisos para eliminar este artículo');
      }

      const articulos = this.articulosSubject.value.filter(art => art.id !== id);

      await Preferences.set({
        key: 'articulos_publicados',
        value: JSON.stringify(articulos)
      });

      this.articulosSubject.next(articulos);
    } catch (error) {
      console.error('Error al eliminar artículo:', error);
      throw error;
    }
  }

  // Eliminar artículo como admin (sin validación de propietario)
  async eliminarArticuloComoAdmin(id: string) {
    try {
      if (!this.authService.esAdmin()) {
        throw new Error('Acceso denegado: Solo administradores');
      }

      const articulos = this.articulosSubject.value.filter(art => art.id !== id);

      await Preferences.set({
        key: 'articulos_publicados',
        value: JSON.stringify(articulos)
      });

      this.articulosSubject.next(articulos);
      console.log(`✅ Artículo ${id} eliminado por admin`);
    } catch (error) {
      console.error('Error al eliminar artículo como admin:', error);
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
      const articulos = this.articulosSubject.value;
      const index = articulos.findIndex(art => art.id === id);

      if (index === -1) {
        throw new Error('Artículo no encontrado');
      }

      // Verificar que el usuario es el propietario
      const articulo = articulos[index];
      const usuarioActual = this.authService.getUsuarioActualSync();

      if (articulo.usuarioId !== usuarioActual?.id) {
        throw new Error('No tienes permisos para modificar este artículo');
      }

      // Actualizar disponibilidad
      articulos[index] = {
        ...articulos[index],
        disponible
      };

      // Guardar en storage
      await Preferences.set({
        key: 'articulos_publicados',
        value: JSON.stringify(articulos)
      });

      this.articulosSubject.next(articulos);
      console.log(`✅ Artículo ${id} marcado como ${disponible ? 'disponible' : 'permutado'}`);
    } catch (error) {
      console.error('Error al cambiar disponibilidad:', error);
      throw error;
    }
  }
}
