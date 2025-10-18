import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Usuario } from '../models/user.model';
import { v4 as uuid } from 'uuid';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private usuarioActual$ = new BehaviorSubject<Usuario | null>(null);
  private usuarios: Usuario[] = [];

  constructor() {
    this.cargarUsuarios();
  }

  private cargarUsuarios() {
    const usuariosGuardados = localStorage.getItem('usuarios');
    if (usuariosGuardados) {
      this.usuarios = JSON.parse(usuariosGuardados);
    }
  }

  private guardarUsuarios() {
    localStorage.setItem('usuarios', JSON.stringify(this.usuarios));
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
          ultima_actualizacion_foto: new Date(),
          ultima_actualizacion_perfil: new Date()
        };

        this.usuarios.push(nuevoUsuario);
        this.guardarUsuarios();
        this.usuarioActual$.next(nuevoUsuario);

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

  logout() {
    this.usuarioActual$.next(null);
  }

  estaAutenticado(): boolean {
    return this.usuarioActual$.value !== null;
  }

  actualizarPerfil(datosActualizados: any): Observable<{exito: boolean, mensaje: string}> {
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
          this.usuarios[index] = {
            ...this.usuarios[index],
            ...datosActualizados,
            ultima_actualizacion_perfil: new Date()
          };
          
          this.guardarUsuarios();
          this.usuarioActual$.next(this.usuarios[index]);

          observer.next({
            exito: true,
            mensaje: 'Perfil actualizado correctamente'
          });
        } else {
          observer.next({
            exito: false,
            mensaje: 'Error al actualizar el perfil'
          });
        }
        observer.complete();
      }, 1000);
    });
  }

  actualizarFoto(foto: string): Observable<{exito: boolean, mensaje: string}> {
    return new Observable(observer => {
      const usuarioActual = this.usuarioActual$.value;
      
      if (!usuarioActual) {
        observer.next({
          exito: false,
          mensaje: 'No hay usuario autenticado'
        });
        observer.complete();
        return;
      }

      // Verificar si puede cambiar foto (cada 30 días)
      const ultimaActualizacion = usuarioActual.ultima_actualizacion_foto;
      const ahora = new Date();
      const diasTranscurridos = (ahora.getTime() - new Date(ultimaActualizacion).getTime()) / (1000 * 60 * 60 * 24);

      if (diasTranscurridos < 30) {
        const diasRestantes = Math.ceil(30 - diasTranscurridos);
        observer.next({
          exito: false,
          mensaje: `Debes esperar ${diasRestantes} días para cambiar tu foto`
        });
        observer.complete();
        return;
      }

      const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
      if (index !== -1) {
        this.usuarios[index] = {
          ...this.usuarios[index],
          foto: foto,
          ultima_actualizacion_foto: new Date()
        };

        this.guardarUsuarios();
        this.usuarioActual$.next(this.usuarios[index]);

        observer.next({
          exito: true,
          mensaje: 'Foto actualizada correctamente'
        });
      }
      observer.complete();
    });
  }

  agregarRecompensa(cantidad: number = 1) {
    const usuarioActual = this.usuarioActual$.value;
    if (usuarioActual) {
      const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
      if (index !== -1) {
        this.usuarios[index].recompensas += cantidad;
        this.guardarUsuarios();
        this.usuarioActual$.next(this.usuarios[index]);
      }
    }
  }

  getUsuarioActualSync(): Usuario | null {
    return this.usuarioActual$.value;
  }

  puedeActualizarFoto(): boolean {
    const usuario = this.usuarioActual$.value;
    if (!usuario) return false;

    const ahora = new Date();
    const ultimaActualizacion = new Date(usuario.ultima_actualizacion_foto);
    const diasTranscurridos = (ahora.getTime() - ultimaActualizacion.getTime()) / (1000 * 60 * 60 * 24);

    return diasTranscurridos >= 30;
  }

  diasParaActualizarFoto(): number {
    const usuario = this.usuarioActual$.value;
    if (!usuario) return 0;

    const ahora = new Date();
    const ultimaActualizacion = new Date(usuario.ultima_actualizacion_foto);
    const diasTranscurridos = (ahora.getTime() - ultimaActualizacion.getTime()) / (1000 * 60 * 60 * 24);

    return Math.ceil(30 - diasTranscurridos);
  }

  incrementarTruequeRealizados() {
    const usuarioActual = this.usuarioActual$.value;
    if (usuarioActual) {
      const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
      if (index !== -1) {
        this.usuarios[index].trueques_realizados += 1;
        this.guardarUsuarios();
        this.usuarioActual$.next(this.usuarios[index]);
      }
    }
  }

  agregarInsignia(insigniaId: string) {
    const usuarioActual = this.usuarioActual$.value;
    if (usuarioActual) {
      const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
      if (index !== -1 && !this.usuarios[index].insignias.includes(insigniaId)) {
        this.usuarios[index].insignias.push(insigniaId);
        this.guardarUsuarios();
        this.usuarioActual$.next(this.usuarios[index]);
      }
    }
  }

  verificarUsuario() {
    const usuarioActual = this.usuarioActual$.value;
    if (usuarioActual) {
      const index = this.usuarios.findIndex(u => u.id === usuarioActual.id);
      if (index !== -1) {
        this.usuarios[index].verificado = true;
        this.guardarUsuarios();
        this.usuarioActual$.next(this.usuarios[index]);
      }
    }
  }
}