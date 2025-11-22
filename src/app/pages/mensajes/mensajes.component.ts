import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { MensajesService } from '../../core/services/mensajes.service';
import { AuthService } from '../../core/services/auth.service';
import { ConversacionConDetalles } from '../../core/models/mensaje.model';

@Component({
  selector: 'app-mensajes',
  standalone: true,
  templateUrl: './mensajes.component.html',
  styleUrls: ['./mensajes.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class MensajesComponent implements OnInit, OnDestroy {

  conversaciones: ConversacionConDetalles[] = [];
  conversacionesFiltradas: ConversacionConDetalles[] = [];
  searchTerm: string = '';
  private conversacionesSubscription?: Subscription;

  constructor(
    private mensajesService: MensajesService,
    private authService: AuthService,
    private router: Router,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.cargarConversaciones();
  }

  ngOnDestroy() {
    if (this.conversacionesSubscription) {
      this.conversacionesSubscription.unsubscribe();
    }
  }

  ionViewWillEnter() {
    this.cargarConversaciones();
  }

  cargarConversaciones() {
    // Suscribirse al Observable para recibir actualizaciones en tiempo real
    this.conversacionesSubscription = this.mensajesService.obtenerConversaciones().subscribe({
      next: (conversaciones) => {
        console.log(`📩 MensajesComponent recibió ${conversaciones.length} conversaciones actualizadas`);
        this.conversaciones = this.mensajesService.obtenerConversacionesConDetalles();

        // Debug: Mostrar mensajes no leídos de cada conversación
        const usuarioActualId = this.obtenerUsuarioActualId();
        console.log(`👤 Usuario actual ID: ${usuarioActualId}`);
        this.conversaciones.forEach(conv => {
          console.log(`📬 Conversación con ${conv.otroUsuario.nombre}:`, {
            mensajesNoLeidos: conv.mensajesNoLeidos,
            misMensajesNoLeidos: conv.mensajesNoLeidos?.[usuarioActualId]
          });
        });

        // Si hay un término de búsqueda activo, aplicar el filtro
        if (this.searchTerm) {
          this.buscarConversacionInterno();
        } else {
          this.conversacionesFiltradas = this.conversaciones;
        }
      },
      error: (error) => {
        console.error('❌ Error al cargar conversaciones:', error);
      }
    });
  }

  abrirChat(conversacion: ConversacionConDetalles) {
    this.router.navigate(['/chat', conversacion.id]);
  }

  buscarConversacion(event: any) {
    const searchTerm = event.target.value?.toLowerCase() || '';
    this.searchTerm = searchTerm;
    this.buscarConversacionInterno();
  }

  private buscarConversacionInterno() {
    if (!this.searchTerm) {
      this.conversacionesFiltradas = this.conversaciones;
      return;
    }

    this.conversacionesFiltradas = this.conversaciones.filter(conv =>
      conv.otroUsuario.nombre.toLowerCase().includes(this.searchTerm) ||
      conv.ultimoMensaje?.toLowerCase().includes(this.searchTerm)
    );
  }

  obtenerMensajesNoLeidos(conversacion: ConversacionConDetalles): number {
    const usuarioActualId = this.obtenerUsuarioActualId();
    const noLeidos = conversacion.mensajesNoLeidos?.[usuarioActualId] || 0;

    // Debug detallado
    console.log(`🔍 obtenerMensajesNoLeidos() llamado para ${conversacion.otroUsuario.nombre}`, {
      usuarioActualId,
      mensajesNoLeidos: conversacion.mensajesNoLeidos,
      noLeidos,
      mostrarBadge: noLeidos > 0
    });

    return noLeidos;
  }

  formatearFecha(fecha: Date): string {
    const ahora = new Date();
    const fechaMensaje = new Date(fecha);

    const diffMs = ahora.getTime() - fechaMensaje.getTime();
    const diffMinutos = Math.floor(diffMs / 60000);
    const diffHoras = Math.floor(diffMs / 3600000);
    const diffDias = Math.floor(diffMs / 86400000);

    if (diffMinutos < 1) return 'Ahora';
    if (diffMinutos < 60) return `${diffMinutos}m`;
    if (diffHoras < 24) return `${diffHoras}h`;
    if (diffDias === 1) return 'Ayer';
    if (diffDias < 7) return `${diffDias}d`;

    return fechaMensaje.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  }

  handleRefresh(event: any) {
    this.cargarConversaciones();
    setTimeout(() => {
      event.target.complete();
    }, 500);
  }

  async confirmarEliminar(conversacion: ConversacionConDetalles) {
    const alert = await this.alertController.create({
      header: 'Eliminar conversación',
      message: `¿Estás seguro de que quieres eliminar la conversación con ${conversacion.otroUsuario.nombre}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.eliminarConversacion(conversacion);
          }
        }
      ]
    });

    await alert.present();
  }

  async eliminarConversacion(conversacion: ConversacionConDetalles) {
    try {
      console.log(`🗑️ Eliminando conversación con ${conversacion.otroUsuario.nombre}...`);
      await this.mensajesService.eliminarConversacion(conversacion.id);
      console.log('✅ Conversación eliminada exitosamente');
    } catch (error) {
      console.error('❌ Error al eliminar conversación:', error);

      // Mostrar mensaje de error
      const errorAlert = await this.alertController.create({
        header: 'Error',
        message: 'No se pudo eliminar la conversación. Por favor, intenta de nuevo.',
        buttons: ['OK']
      });
      await errorAlert.present();
    }
  }

  volverHome() {
    this.router.navigate(['/home']);
  }

  volver() {
    this.router.navigate(['/home']);
  }

  private obtenerUsuarioActualId(): string {
    const usuario = this.authService.getUsuarioActualSync();
    return usuario?.id || '';
  }
}
