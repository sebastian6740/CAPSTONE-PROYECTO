import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { MensajesService } from '../../core/services/mensajes.service';
import { ConversacionConDetalles } from '../../core/models/mensaje.model';

@Component({
  selector: 'app-mensajes',
  standalone: true,
  templateUrl: './mensajes.component.html',
  styleUrls: ['./mensajes.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class MensajesComponent implements OnInit {

  conversaciones: ConversacionConDetalles[] = [];
  conversacionesFiltradas: ConversacionConDetalles[] = [];
  searchTerm: string = '';

  constructor(
    private mensajesService: MensajesService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargarConversaciones();
  }

  ionViewWillEnter() {
    this.cargarConversaciones();
  }

  cargarConversaciones() {
    this.conversaciones = this.mensajesService.obtenerConversacionesConDetalles();
    this.conversacionesFiltradas = this.conversaciones;
  }

  abrirChat(conversacion: ConversacionConDetalles) {
    this.router.navigate(['/chat', conversacion.id]);
  }

  buscarConversacion(event: any) {
    const searchTerm = event.target.value?.toLowerCase() || '';
    this.searchTerm = searchTerm;

    if (!searchTerm) {
      this.conversacionesFiltradas = this.conversaciones;
      return;
    }

    this.conversacionesFiltradas = this.conversaciones.filter(conv =>
      conv.otroUsuario.nombre.toLowerCase().includes(searchTerm) ||
      conv.ultimoMensaje?.toLowerCase().includes(searchTerm)
    );
  }

  obtenerMensajesNoLeidos(conversacion: ConversacionConDetalles): number {
    const usuarioActualId = this.obtenerUsuarioActualId();
    return conversacion.mensajesNoLeidos[usuarioActualId] || 0;
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

  eliminarConversacion(event: Event, conversacion: ConversacionConDetalles) {
    event.stopPropagation();
    // Aquí podrías agregar un AlertController para confirmar
    this.mensajesService.eliminarConversacion(conversacion.id);
    this.cargarConversaciones();
  }

  volverHome() {
    this.router.navigate(['/home']);
  }

  volver() {
    this.router.navigate(['/home']);
  }

  private obtenerUsuarioActualId(): string {
    // Este método debería usar AuthService pero por simplicidad usamos un helper
    const usuarioStr = localStorage.getItem('usuarioActual');
    if (usuarioStr) {
      const usuario = JSON.parse(usuarioStr);
      return usuario.id;
    }
    return '';
  }
}
