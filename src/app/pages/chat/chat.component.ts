import { Component, OnInit, OnDestroy, ViewChild, ElementRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
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
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messagesList', { read: ElementRef }) messagesList?: ElementRef;

  conversacionId: string = '';
  conversacion?: Conversacion;
  mensajes: Mensaje[] = [];
  nuevoMensaje: string = '';
  usuarioActual: Usuario | null = null;
  otroUsuario?: Usuario;

  private mensajesSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private mensajesService: MensajesService,
    private authService: AuthService,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.usuarioActual = this.authService.getUsuarioActualSync();

    this.route.params.subscribe(params => {
      this.conversacionId = params['conversacionId'];
      this.cargarConversacion();
    });
  }

  ngOnDestroy() {
    // Solo desuscribirse del componente, NO detener el listener de Firestore
    // El listener debe permanecer activo para recibir actualizaciones en tiempo real
    if (this.mensajesSubscription) {
      this.mensajesSubscription.unsubscribe();
    }
    // NO llamar a detenerListenerMensajes aquí - dejamos que el servicio mantenga el listener activo
  }

  ionViewDidEnter() {
    this.scrollToBottom();
  }

  ionViewWillLeave() {
    // Marcar mensajes como leídos al salir del chat
    if (this.conversacionId) {
      this.mensajesService.marcarComoLeido(this.conversacionId);
    }
  }

  async cargarConversacion() {
    console.log(`🔍 Cargando conversación ${this.conversacionId}...`);

    // Esperar un momento para que el listener de conversaciones se actualice
    await new Promise(resolve => setTimeout(resolve, 300));

    this.conversacion = this.mensajesService.obtenerConversacionPorId(this.conversacionId);

    if (!this.conversacion) {
      console.warn(`⚠️ Conversación ${this.conversacionId} no encontrada en cache`);
      console.log('💡 Intentando recargar conversaciones...');

      // Esperar un poco más para que el servicio se sincronice
      await new Promise(resolve => setTimeout(resolve, 500));
      this.conversacion = this.mensajesService.obtenerConversacionPorId(this.conversacionId);

      if (!this.conversacion) {
        console.error('❌ No se pudo cargar la conversación después de reintentar');
        this.router.navigate(['/mensajes']);
        return;
      }
    }

    console.log(`✅ Conversación encontrada con ${this.conversacion.participantes.length} participantes`);
    console.log(`👥 Participantes:`, this.conversacion.participantes);

    // Obtener información del otro usuario primero
    const otroUsuarioId = this.conversacion.participantes.find(id => id !== this.usuarioActual?.id);
    if (otroUsuarioId) {
      const usuarios = await this.authService.obtenerTodosUsuarios();
      this.otroUsuario = usuarios.find((u: Usuario) => u.id === otroUsuarioId);
      console.log(`👤 Otro usuario:`, this.otroUsuario?.nombre);
    }

    console.log(`✅ Iniciando listener de mensajes...`);

    // Iniciar listener en tiempo real de mensajes
    this.mensajesSubscription = this.mensajesService.iniciarListenerMensajes(this.conversacionId).subscribe({
      next: (mensajes) => {
        console.log(`💬 ChatComponent recibió ${mensajes.length} mensajes del Observable`);
        console.log(`📝 Mensajes recibidos:`, mensajes.map(m => ({ contenido: m.contenido, emisor: m.emisorId, timestamp: m.timestamp })));

        // Usar NgZone para forzar la detección de cambios de Angular
        this.ngZone.run(() => {
          const mensajesAnteriores = this.mensajes.length;
          this.mensajes = [...mensajes]; // Crear nuevo array para forzar detección
          console.log(`🔄 Mensajes actualizados: ${mensajesAnteriores} → ${this.mensajes.length}`);
          setTimeout(() => this.scrollToBottom(), 100);
        });
      },
      error: (error) => {
        console.error('❌ Error en listener de mensajes:', error);
      }
    });

    // Marcar como leídos
    await this.mensajesService.marcarComoLeido(this.conversacionId);

    // Scroll al final después de cargar
    setTimeout(() => this.scrollToBottom(), 100);
  }

  async enviarMensaje() {
    if (!this.nuevoMensaje.trim()) return;

    const mensajeTexto = this.nuevoMensaje.trim();
    console.log(`📤 Enviando mensaje: "${mensajeTexto}"`);
    console.log(`📊 Mensajes actuales antes de enviar: ${this.mensajes.length}`);

    try {
      // Limpiar input inmediatamente para mejor UX
      this.nuevoMensaje = '';

      // Enviar mensaje a Firestore (el listener lo agregará automáticamente)
      await this.mensajesService.enviarMensaje(this.conversacionId, mensajeTexto);
      console.log(`✅ Mensaje enviado correctamente`);

      // El listener debería actualizar automáticamente, pero por si acaso:
      setTimeout(() => {
        console.log(`📊 Mensajes después de enviar: ${this.mensajes.length}`);
        this.scrollToBottom();
      }, 500);
    } catch (error) {
      console.error('❌ Error al enviar mensaje:', error);
      // Restaurar el mensaje si falla
      this.nuevoMensaje = mensajeTexto;
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
