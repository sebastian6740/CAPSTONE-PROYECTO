import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Usuario, RespuestaActualizacion, RespuestaFoto } from '../models/user.model';
import { v4 as uuid } from 'uuid';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private usuarioActual$ = new BehaviorSubject<Usuario | null>(null);
  private usuarios: Usuario[] = [];
  private readonly DIAS_LIMITE_FOTO = 30;

  constructor() {
    this.cargarUsuarios();
    this.inicializarAdminDefault();
    this.cargarSesionActual();
  }

  private cargarUsuarios() {
    const usuariosGuardados = localStorage.getItem('usuarios');
    if (usuariosGuardados) {
      this.usuarios = JSON.parse(usuariosGuardados);
    }
  }

  private cargarSesionActual() {
    const usuarioSesion = localStorage.getItem('usuarioActual');
    if (usuarioSesion) {
      const usuario = JSON.parse(usuarioSesion);
      this.usuarioActual$.next(usuario);
    }
  }

  private guardarUsuarios() {
    localStorage.setItem('usuarios', JSON.stringify(this.usuarios));
  }

  private guardarSesionActual(usuario: Usuario | null) {
    if (usuario) {
      localStorage.setItem('usuarioActual', JSON.stringify(usuario));
    } else {
      localStorage.removeItem('usuarioActual');
    }
  }

  /**
   * Inicializar usuario admin por defecto si no existe
   */
  private inicializarAdminDefault() {
    const adminExiste = this.usuarios.some(u => u.rol === 'admin');

    if (!adminExiste) {
      const adminDefault: Usuario = {
        id: 'admin-default-id',
        nombre: 'Administrador',
        email: 'admin@trueques.com',
        contrasena: 'admin123',
        telefono: '+56912345678',
        ciudad: 'Santiago',
        foto: undefined,
        fechaRegistro: new Date(),
        calificacion: 5,
        biografia: 'Cuenta de administrador del sistema',
        trueques_realizados: 0,
        trueques_pendientes: 0,
        recompensas: 0,
        insignias: ['admin'],
        verificado: true,
        ultima_actualizacion_foto: undefined,
        ultima_actualizacion_perfil: new Date(),
        rol: 'admin'
      };

      this.usuarios.push(adminDefault);
      this.guardarUsuarios();
      console.log('✅ Usuario admin creado: admin@trueques.com / admin123');
    }
  }

  registrar(datosRegistro: any): Observable<{exito: boolean, mensaje: string}> {
    return new Observable(observer => {
      setTimeout(() => {
        const emailExiste = this.usuarios.some(u => u.email === datosRegistro.email);
        if (emailExiste) {
          observer.next({
            exito: false,
            mensaje: 'El email ya está registrado'
          });
          observer.complete();
          return;
        }

        if (datosRegistro.contrasena !== datosRegistro.confirmarContrasena) {
          observer.next({
            exito: false,
            mensaje: 'Las contraseñas no coinciden'
          });
          observer.complete();
          return;
        }

        const nuevoUsuario: Usuario = {
          id: uuid(),
          nombre: datosRegistro.nombre,
          email: datosRegistro.email,
          contrasena: datosRegistro.contrasena,
          telefono: datosRegistro.telefono,
          ciudad: datosRegistro.ciudad,
          foto: undefined,
          fechaRegistro: new Date(),
          calificacion: 5,
          biografia: '',
          trueques_realizados: 0,
          trueques_pendientes: 0,
          recompensas: 0,
          insignias: [],
          verificado: false,
          ultima_actualizacion_foto: undefined,
          ultima_actualizacion_perfil: new Date(),
          rol: 'user'
        };

        this.usuarios.push(nuevoUsuario);
        this.guardarUsuarios();
        this.usuarioActual$.next(nuevoUsuario);
        this.guardarSesionActual(nuevoUsuario);

        observer.next({
          exito: true,
          mensaje: 'Registro exitoso'
        });
        observer.complete();
      }, 1000);
    });
  }

  login(email: string, contrasena: string): Observable<{exito: boolean, mensaje: string}> {
    return new Observable(observer => {
      setTimeout(() => {
        const usuario = this.usuarios.find(u => u.email === email && u.contrasena === contrasena);
        
        if (usuario) {
          this.usuarioActual$.next(usuario);
          this.guardarSesionActual(usuario);
          observer.next({
            exito: true,
            mensaje: 'Login exitoso'
          });
        } else {
          observer.next({
            exito: false,
            mensaje: 'Email o contraseña incorrectos'
          });
        }
        observer.complete();
      }, 1000);
    });
  }

  getUsuarioActual(): Observable<Usuario | null> {
    return this.usuarioActual$.asObservable();
  }

  getUsuarioActualSync(): Usuario | null {
    return this.usuarioActual$.value;
  }

  logout() {
    this.usuarioActual$.next(null);
    this.guardarSesionActual(null);
  }

  estaAutenticado(): boolean {
    return this.usuarioActual$.value !== null;
  }

  /**
   * Actualizar datos del perfil
   */
  actualizarPerfil(datosActualizados: any): Observable<RespuestaActualizacion> {
    return new Observable(observer => {
      setTimeout(() => {
        const usuarioActual = this.usuarioActual$.value;
        
        if (!usuarioActual) {
          observer.next({
            exito: false,
            mensaje: 'No hay usuario autenticado'
          });
          observer.complete();
          return;
        }

        const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
        if (index !== -1) {
          const usuarioActualizado = {
            ...this.usuarios[index],
            ...datosActualizados,
            ultima_actualizacion_perfil: new Date()
          };
          
          this.usuarios[index] = usuarioActualizado;
          this.guardarUsuarios();
          this.usuarioActual$.next(usuarioActualizado);
          this.guardarSesionActual(usuarioActualizado);

          observer.next({
            exito: true,
            mensaje: '✅ Perfil actualizado correctamente',
            usuario: usuarioActualizado
          });
        } else {
          observer.next({
            exito: false,
            mensaje: 'Error al actualizar el perfil'
          });
        }
        observer.complete();
      }, 800);
    });
  }

  /**
   * Actualizar foto de perfil
   */
  actualizarFoto(foto: string): Observable<RespuestaFoto> {
    return new Observable(observer => {
      setTimeout(() => {
        const usuarioActual = this.usuarioActual$.value;
        
        if (!usuarioActual) {
          observer.next({
            exito: false,
            mensaje: 'No hay usuario autenticado'
          });
          observer.complete();
          return;
        }

        // Verificar si puede cambiar foto
        if (!this.puedeActualizarFoto()) {
          const diasRestantes = this.diasParaActualizarFoto();
          observer.next({
            exito: false,
            mensaje: `Debes esperar ${diasRestantes} días para cambiar tu foto`
          });
          observer.complete();
          return;
        }

        const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
        if (index !== -1) {
          // La foto queda pendiente de aprobación por el administrador
          const usuarioActualizado = {
            ...this.usuarios[index],
            foto_pendiente: foto,
            estado_foto: 'pendiente' as const,
            ultima_actualizacion_foto: new Date()
          };

          this.usuarios[index] = usuarioActualizado;
          this.guardarUsuarios();
          this.usuarioActual$.next(usuarioActualizado);
          this.guardarSesionActual(usuarioActualizado);

          observer.next({
            exito: true,
            mensaje: '📸 Foto enviada. Está en revisión por el administrador',
            foto_url: foto
          });
        } else {
          observer.next({
            exito: false,
            mensaje: 'Error al actualizar la foto'
          });
        }
        observer.complete();
      }, 1000);
    });
  }

  /**
   * Verificar si puede actualizar la foto (límite de 30 días)
   */
  puedeActualizarFoto(): boolean {
    const usuario = this.usuarioActual$.value;
    if (!usuario) return false;

    // Si no tiene fecha de última actualización, puede actualizar
    if (!usuario.ultima_actualizacion_foto) return true;

    const ahora = new Date();
    const ultimaActualizacion = new Date(usuario.ultima_actualizacion_foto);
    const diasTranscurridos = (ahora.getTime() - ultimaActualizacion.getTime()) / (1000 * 60 * 60 * 24);

    return diasTranscurridos >= this.DIAS_LIMITE_FOTO;
  }

  /**
   * Días restantes para poder actualizar la foto
   */
  diasParaActualizarFoto(): number {
    const usuario = this.usuarioActual$.value;
    if (!usuario || !usuario.ultima_actualizacion_foto) return 0;

    const ahora = new Date();
    const ultimaActualizacion = new Date(usuario.ultima_actualizacion_foto);
    const diasTranscurridos = (ahora.getTime() - ultimaActualizacion.getTime()) / (1000 * 60 * 60 * 24);

    const diasRestantes = Math.ceil(this.DIAS_LIMITE_FOTO - diasTranscurridos);
    return diasRestantes > 0 ? diasRestantes : 0;
  }

  /**
   * Agregar recompensas al usuario
   */
  agregarRecompensa(cantidad: number = 1) {
    const usuarioActual = this.usuarioActual$.value;
    if (usuarioActual) {
      const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
      if (index !== -1) {
        this.usuarios[index].recompensas += cantidad;
        this.guardarUsuarios();
        this.usuarioActual$.next(this.usuarios[index]);
        this.guardarSesionActual(this.usuarios[index]);
      }
    }
  }

  /**
   * Incrementar contador de trueques realizados
   */
  incrementarTruequeRealizados() {
    const usuarioActual = this.usuarioActual$.value;
    if (usuarioActual) {
      const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
      if (index !== -1) {
        this.usuarios[index].trueques_realizados += 1;
        this.guardarUsuarios();
        this.usuarioActual$.next(this.usuarios[index]);
        this.guardarSesionActual(this.usuarios[index]);
      }
    }
  }

  /**
   * Agregar insignia al usuario
   */
  agregarInsignia(insigniaId: string) {
    const usuarioActual = this.usuarioActual$.value;
    if (usuarioActual) {
      const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
      if (index !== -1 && !this.usuarios[index].insignias.includes(insigniaId)) {
        this.usuarios[index].insignias.push(insigniaId);
        this.guardarUsuarios();
        this.usuarioActual$.next(this.usuarios[index]);
        this.guardarSesionActual(this.usuarios[index]);
      }
    }
  }

  /**
   * Verificar usuario
   */
  verificarUsuario() {
    const usuarioActual = this.usuarioActual$.value;
    if (usuarioActual) {
      const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
      if (index !== -1) {
        this.usuarios[index].verificado = true;
        this.guardarUsuarios();
        this.usuarioActual$.next(this.usuarios[index]);
        this.guardarSesionActual(this.usuarios[index]);
      }
    }
  }

  /**
   * Actualizar calificación del usuario
   */
  actualizarCalificacion(nuevaCalificacion: number) {
    const usuarioActual = this.usuarioActual$.value;
    if (usuarioActual) {
      const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
      if (index !== -1) {
        this.usuarios[index].calificacion = nuevaCalificacion;
        this.guardarUsuarios();
        this.usuarioActual$.next(this.usuarios[index]);
        this.guardarSesionActual(this.usuarios[index]);
      }
    }
  }

  /**
   * Obtener todos los usuarios (para pruebas/admin)
   */
  obtenerTodosUsuarios(): Usuario[] {
    return this.usuarios;
  }

  /**
   * Verificar si el usuario actual es administrador
   */
  esAdmin(): boolean {
    const usuario = this.usuarioActual$.value;
    return usuario?.rol === 'admin';
  }

  /**
   * Verificar si el usuario actual es admin o es el propietario del recurso
   */
  esAdminOPropietario(usuarioId: string): boolean {
    const usuario = this.usuarioActual$.value;
    if (!usuario) return false;
    return usuario.rol === 'admin' || usuario.id === usuarioId;
  }

  /**
   * Obtener usuarios con fotos pendientes de aprobación (solo admin)
   */
  obtenerUsuariosConFotosPendientes(): Usuario[] {
    if (!this.esAdmin()) return [];
    return this.usuarios.filter(u => u.estado_foto === 'pendiente' && u.foto_pendiente);
  }

  /**
   * Aprobar foto de usuario (solo admin)
   */
  aprobarFoto(usuarioId: string): Observable<{exito: boolean, mensaje: string}> {
    return new Observable(observer => {
      setTimeout(() => {
        if (!this.esAdmin()) {
          observer.next({
            exito: false,
            mensaje: 'No tienes permisos para esta acción'
          });
          observer.complete();
          return;
        }

        const index = this.usuarios.findIndex(u => u.id === usuarioId);
        if (index !== -1 && this.usuarios[index].foto_pendiente) {
          // Aprobar la foto pendiente
          this.usuarios[index].foto = this.usuarios[index].foto_pendiente;
          this.usuarios[index].estado_foto = 'aprobada';
          this.usuarios[index].foto_pendiente = undefined;

          this.guardarUsuarios();

          // Si el usuario aprobado es el actual, actualizar sesión
          if (this.usuarioActual$.value?.id === usuarioId) {
            this.usuarioActual$.next(this.usuarios[index]);
            this.guardarSesionActual(this.usuarios[index]);
          }

          observer.next({
            exito: true,
            mensaje: '✅ Foto aprobada correctamente'
          });
        } else {
          observer.next({
            exito: false,
            mensaje: 'No hay foto pendiente para este usuario'
          });
        }
        observer.complete();
      }, 500);
    });
  }

  /**
   * Rechazar foto de usuario (solo admin)
   */
  rechazarFoto(usuarioId: string, motivo?: string): Observable<{exito: boolean, mensaje: string}> {
    return new Observable(observer => {
      setTimeout(() => {
        if (!this.esAdmin()) {
          observer.next({
            exito: false,
            mensaje: 'No tienes permisos para esta acción'
          });
          observer.complete();
          return;
        }

        const index = this.usuarios.findIndex(u => u.id === usuarioId);
        if (index !== -1 && this.usuarios[index].foto_pendiente) {
          // Rechazar la foto pendiente
          this.usuarios[index].estado_foto = 'rechazada';
          this.usuarios[index].foto_pendiente = undefined;
          // Restaurar el limite de tiempo para que pueda intentar de nuevo
          this.usuarios[index].ultima_actualizacion_foto = undefined;

          this.guardarUsuarios();

          // Si el usuario rechazado es el actual, actualizar sesión
          if (this.usuarioActual$.value?.id === usuarioId) {
            this.usuarioActual$.next(this.usuarios[index]);
            this.guardarSesionActual(this.usuarios[index]);
          }

          observer.next({
            exito: true,
            mensaje: motivo ? `❌ Foto rechazada: ${motivo}` : '❌ Foto rechazada'
          });
        } else {
          observer.next({
            exito: false,
            mensaje: 'No hay foto pendiente para este usuario'
          });
        }
        observer.complete();
      }, 500);
    });
  }

  /**
   * Obtener usuario por ID (solo admin)
   */
  obtenerUsuarioPorId(id: string): Usuario | undefined {
    if (!this.esAdmin()) {
      console.warn('Acceso denegado: Solo administradores pueden ver otros usuarios');
      return undefined;
    }
    return this.usuarios.find(u => u.id === id);
  }

  /**
   * Eliminar usuario (solo admin)
   * Elimina el usuario y todos sus datos relacionados
   */
  async eliminarUsuario(usuarioId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Verificar permisos de admin
      if (!this.esAdmin()) {
        reject(new Error('Acceso denegado: Solo administradores pueden eliminar usuarios'));
        return;
      }

      // Buscar el usuario a eliminar
      const usuarioAEliminar = this.usuarios.find(u => u.id === usuarioId);

      if (!usuarioAEliminar) {
        reject(new Error('Usuario no encontrado'));
        return;
      }

      // No permitir eliminar usuarios admin
      if (usuarioAEliminar.rol === 'admin') {
        reject(new Error('No se puede eliminar usuarios administradores'));
        return;
      }

      // No permitir auto-eliminación
      const usuarioActual = this.usuarioActual$.value;
      if (usuarioActual?.id === usuarioId) {
        reject(new Error('No puedes eliminar tu propia cuenta'));
        return;
      }

      try {
        // 1. Eliminar usuario de la lista
        this.usuarios = this.usuarios.filter(u => u.id !== usuarioId);
        this.guardarUsuarios();

        // 2. Limpiar datos relacionados
        this.limpiarDatosRelacionados(usuarioId);

        // 3. Si el usuario eliminado está en sesión actual, hacer logout
        if (usuarioActual?.id === usuarioId) {
          this.logout();
        }

        console.log(`✅ Usuario ${usuarioId} eliminado correctamente`);
        resolve();
      } catch (error) {
        console.error('Error al eliminar usuario:', error);
        reject(new Error('Error al eliminar el usuario'));
      }
    });
  }

  /**
   * Limpiar datos relacionados con un usuario eliminado
   * - Artículos del usuario
   * - Conversaciones donde participa
   * - Mensajes enviados/recibidos
   */
  private async limpiarDatosRelacionados(usuarioId: string): Promise<void> {
    try {
      // Importar dinámicamente los servicios para evitar dependencias circulares
      const { ArticulosService } = await import('./articulos');
      const { MensajesService } = await import('./mensajes.service');

      // Nota: Aquí idealmente inyectarías los servicios, pero para evitar dependencias circulares
      // trabajamos directamente con localStorage/Preferences

      // 1. Eliminar artículos del usuario desde Capacitor Preferences
      const { Preferences } = await import('@capacitor/preferences');
      const { value: articulosValue } = await Preferences.get({ key: 'articulos_publicados' });

      if (articulosValue) {
        const articulos = JSON.parse(articulosValue);
        const articulosFiltrados = articulos.filter((art: any) => art.usuarioId !== usuarioId);
        await Preferences.set({
          key: 'articulos_publicados',
          value: JSON.stringify(articulosFiltrados)
        });
        console.log(`✅ Artículos del usuario ${usuarioId} eliminados`);
      }

      // 2. Eliminar conversaciones donde participa el usuario
      const conversacionesGuardadas = localStorage.getItem('conversaciones');
      if (conversacionesGuardadas) {
        const conversaciones = JSON.parse(conversacionesGuardadas);
        const conversacionesFiltradas = conversaciones.filter((conv: any) =>
          !conv.participantes.includes(usuarioId)
        );
        localStorage.setItem('conversaciones', JSON.stringify(conversacionesFiltradas));
        console.log(`✅ Conversaciones del usuario ${usuarioId} eliminadas`);
      }

      // 3. Eliminar mensajes del usuario
      const mensajesGuardados = localStorage.getItem('mensajes');
      if (mensajesGuardados) {
        const mensajes = JSON.parse(mensajesGuardados);
        const mensajesFiltrados = mensajes.filter((msg: any) =>
          msg.emisorId !== usuarioId && msg.receptorId !== usuarioId
        );
        localStorage.setItem('mensajes', JSON.stringify(mensajesFiltrados));
        console.log(`✅ Mensajes del usuario ${usuarioId} eliminados`);
      }

    } catch (error) {
      console.error('Error al limpiar datos relacionados:', error);
      // No lanzamos error para no bloquear la eliminación del usuario
    }
  }

  /**
   * Contar artículos de un usuario
   * Útil para mostrar advertencias antes de eliminar
   */
  async contarArticulosUsuario(usuarioId: string): Promise<number> {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'articulos_publicados' });

      if (value) {
        const articulos = JSON.parse(value);
        return articulos.filter((art: any) => art.usuarioId === usuarioId).length;
      }
      return 0;
    } catch (error) {
      console.error('Error al contar artículos:', error);
      return 0;
    }
  }
}