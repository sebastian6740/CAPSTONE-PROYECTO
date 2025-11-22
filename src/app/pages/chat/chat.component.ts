import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MensajesService } from '../../core/services/mensajes.service';
import { AuthService } from '../../core/services/auth.service';
import { Conversacion, Mensaje } from '../../core/models/mensaje.model';
import { Usuario } from '../../core/models/user.model';

@Component({
  selector: 'app-chat',
  standalone: true,
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ChatComponent implements OnInit {
  @ViewChild('messagesList', { read: ElementRef }) messagesList?: ElementRef;

  conversacionId: string = '';
  conversacion?: Conversacion;
  mensajes: Mensaje[] = [];
  nuevoMensaje: string = '';
  usuarioActual: Usuario | null = null;
  otroUsuario?: Usuario;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mensajesService: MensajesService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.usuarioActual = this.authService.getUsuarioActualSync();

    this.route.params.subscribe(params => {
      this.conversacionId = params['conversacionId'];
      this.cargarConversacion();
    });
  }

  ionViewDidEnter() {
    this.scrollToBottom();
  }

  cargarConversacion() {
    this.conversacion = this.mensajesService.obtenerConversacionPorId(this.conversacionId);

    if (!this.conversacion) {
      this.router.navigate(['/mensajes']);
      return;
    }

    // Cargar mensajes
    this.mensajes = this.mensajesService.obtenerMensajesDeConversacion(this.conversacionId);

    // Marcar como leídos
    this.mensajesService.marcarComoLeido(this.conversacionId);

    // Obtener información del otro usuario
    const otroUsuarioId = this.conversacion.participantes.find(id => id !== this.usuarioActual?.id);
    if (otroUsuarioId) {
      const usuarios = this.authService.obtenerTodosUsuarios();
      this.otroUsuario = usuarios.find(u => u.id === otroUsuarioId);
    }

    // Scroll al final después de cargar
    setTimeout(() => this.scrollToBottom(), 100);
  }

  enviarMensaje() {
    if (!this.nuevoMensaje.trim()) return;

    try {
      const mensaje = this.mensajesService.enviarMensaje(this.conversacionId, this.nuevoMensaje.trim());
      this.mensajes.push(mensaje);
      this.nuevoMensaje = '';

      setTimeout(() => this.scrollToBottom(), 100);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    }
  }

  esMensajeMio(mensaje: Mensaje): boolean {
    return mensaje.emisorId === this.usuarioActual?.id;
  }

  formatearHora(timestamp: Date): string {
    const fecha = new Date(timestamp);
    return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  formatearFechaCompleta(timestamp: Date): string {
    const fecha = new Date(timestamp);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    if (fecha.toDateString() === hoy.toDateString()) {
      return 'Hoy';
    } else if (fecha.toDateString() === ayer.toDateString()) {
      return 'Ayer';
    } else {
      return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    }
  }

  mostrarSeparadorFecha(index: number): boolean {
    if (index === 0) return true;

    const mensajeActual = new Date(this.mensajes[index].timestamp);
    const mensajeAnterior = new Date(this.mensajes[index - 1].timestamp);

    return mensajeActual.toDateString() !== mensajeAnterior.toDateString();
  }

  private scrollToBottom() {
    if (this.messagesList) {
      const element = this.messagesList.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  volver() {
    this.router.navigate(['/mensajes']);
  }

  abrirPerfilUsuario() {
    // Podrías implementar navegación al perfil del otro usuario
    console.log('Abrir perfil de', this.otroUsuario?.nombre);
  }
}
