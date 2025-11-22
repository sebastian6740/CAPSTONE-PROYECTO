import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Mensaje, Conversacion, ConversacionConDetalles } from '../models/mensaje.model';
import { AuthService } from './auth.service';
import { Usuario } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class MensajesService {
  private conversaciones: Conversacion[] = [];
  private mensajes: Mensaje[] = [];

  private conversaciones$ = new BehaviorSubject<Conversacion[]>([]);
  private mensajesNoLeidos$ = new BehaviorSubject<number>(0);

  private readonly STORAGE_KEY_CONVERSACIONES = 'conversaciones';
  private readonly STORAGE_KEY_MENSAJES = 'mensajes';

  constructor(private authService: AuthService) {
    this.cargarDatos();
  }

  private cargarDatos() {
    // Cargar conversaciones
    const conversacionesGuardadas = localStorage.getItem(this.STORAGE_KEY_CONVERSACIONES);
    if (conversacionesGuardadas) {
      this.conversaciones = JSON.parse(conversacionesGuardadas).map((c: any) => ({
        ...c,
        ultimaActualizacion: new Date(c.ultimaActualizacion)
      }));
    }

    // Cargar mensajes
    const mensajesGuardados = localStorage.getItem(this.STORAGE_KEY_MENSAJES);
    if (mensajesGuardados) {
      this.mensajes = JSON.parse(mensajesGuardados).map((m: any) => ({
        ...m,
        timestamp: new Date(m.timestamp)
      }));
    }

    this.actualizarObservables();
  }

  private guardarConversaciones() {
    localStorage.setItem(this.STORAGE_KEY_CONVERSACIONES, JSON.stringify(this.conversaciones));
    this.actualizarObservables();
  }

  private guardarMensajes() {
    localStorage.setItem(this.STORAGE_KEY_MENSAJES, JSON.stringify(this.mensajes));
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
      const noLeidos = conv.mensajesNoLeidos[usuarioActual.id] || 0;
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
        const otroUsuarioId = conv.participantes.find(id => id !== usuarioActual.id) || '';
        const otroUsuario = this.obtenerUsuarioPorId(otroUsuarioId);

        const ultimoMensajeObj = this.mensajes
          .filter(m => m.conversacionId === conv.id)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

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
      .sort((a, b) => new Date(b.ultimaActualizacion).getTime() - new Date(a.ultimaActualizacion).getTime());
  }

  // Obtener mensajes de una conversación específica
  obtenerMensajesDeConversacion(conversacionId: string): Mensaje[] {
    return this.mensajes
      .filter(m => m.conversacionId === conversacionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Obtener o crear conversación entre dos usuarios
  obtenerOCrearConversacion(otroUsuarioId: string, articuloRelacionado?: { id: string, nombre: string, foto?: string }): Conversacion {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) {
      throw new Error('No hay usuario autenticado');
    }

    // Buscar si ya existe una conversación entre estos usuarios
    let conversacion = this.conversaciones.find(c =>
      c.participantes.includes(usuarioActual.id) && c.participantes.includes(otroUsuarioId)
    );

    if (!conversacion) {
      // Crear nueva conversación
      conversacion = {
        id: `conv_${Date.now()}`,
        participantes: [usuarioActual.id, otroUsuarioId],
        ultimaActualizacion: new Date(),
        articuloRelacionado,
        mensajesNoLeidos: {
          [usuarioActual.id]: 0,
          [otroUsuarioId]: 0
        }
      };

      this.conversaciones.push(conversacion);
      this.guardarConversaciones();
    }

    return conversacion;
  }

  // Enviar un mensaje
  enviarMensaje(conversacionId: string, contenido: string): Mensaje {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) {
      throw new Error('No hay usuario autenticado');
    }

    const conversacion = this.conversaciones.find(c => c.id === conversacionId);
    if (!conversacion) {
      throw new Error('Conversación no encontrada');
    }

    const receptorId = conversacion.participantes.find(id => id !== usuarioActual.id) || '';

    const mensaje: Mensaje = {
      id: `msg_${Date.now()}`,
      conversacionId,
      emisorId: usuarioActual.id,
      receptorId,
      contenido,
      timestamp: new Date(),
      leido: false
    };

    this.mensajes.push(mensaje);
    this.guardarMensajes();

    // Actualizar conversación
    conversacion.ultimoMensaje = contenido;
    conversacion.ultimaActualizacion = new Date();

    // Incrementar contador de no leídos para el receptor
    if (!conversacion.mensajesNoLeidos) {
      conversacion.mensajesNoLeidos = {};
    }
    conversacion.mensajesNoLeidos[receptorId] = (conversacion.mensajesNoLeidos[receptorId] || 0) + 1;

    this.guardarConversaciones();

    return mensaje;
  }

  // Marcar mensajes como leídos
  marcarComoLeido(conversacionId: string) {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) return;

    const conversacion = this.conversaciones.find(c => c.id === conversacionId);
    if (!conversacion) return;

    // Marcar todos los mensajes no leídos de esta conversación como leídos
    this.mensajes
      .filter(m => m.conversacionId === conversacionId && m.receptorId === usuarioActual.id && !m.leido)
      .forEach(m => m.leido = true);

    this.guardarMensajes();

    // Resetear contador de no leídos para el usuario actual
    conversacion.mensajesNoLeidos[usuarioActual.id] = 0;
    this.guardarConversaciones();
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
  eliminarConversacion(conversacionId: string) {
    const index = this.conversaciones.findIndex(c => c.id === conversacionId);
    if (index > -1) {
      this.conversaciones.splice(index, 1);
      this.guardarConversaciones();
    }

    // Eliminar todos los mensajes de esta conversación
    this.mensajes = this.mensajes.filter(m => m.conversacionId !== conversacionId);
    this.guardarMensajes();
  }

  // Helper para obtener usuario por ID
  private obtenerUsuarioPorId(usuarioId: string): Usuario | undefined {
    const usuarios = this.authService.obtenerTodosUsuarios();
    return usuarios.find(u => u.id === usuarioId);
  }
}
