import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, PopoverController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { Notificacion } from '../../../core/models/notificacion.model';
import { FirebaseDatePipe } from '../../../core/pipes/firebase-date.pipe';

@Component({
  selector: 'app-notificaciones-popover',
  standalone: true,
  templateUrl: './notificaciones-popover.component.html',
  styleUrls: ['./notificaciones-popover.component.scss'],
  imports: [IonicModule, CommonModule, FirebaseDatePipe]
})
export class NotificacionesPopoverComponent implements OnInit {

  notificaciones: Notificacion[] = [];
  cargando: boolean = true;

  constructor(
    private notificacionesService: NotificacionesService,
    private popoverController: PopoverController,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargarNotificaciones();
  }

  cargarNotificaciones() {
    this.notificacionesService.obtenerNotificaciones().subscribe(notificaciones => {
      this.notificaciones = notificaciones;
      this.cargando = false;
    });
  }

  async clickNotificacion(notificacion: Notificacion) {
    // Marcar como leída
    if (!notificacion.leida && notificacion.id) {
      await this.notificacionesService.marcarComoLeida(notificacion.id);
    }

    // Cerrar popover
    await this.popoverController.dismiss();

    // Navegar si tiene acción
    if (notificacion.accion?.tipo === 'navegar' && notificacion.accion.ruta) {
      this.router.navigate([notificacion.accion.ruta]);
    }
  }

  async marcarTodasLeidas() {
    await this.notificacionesService.marcarTodasComoLeidas();
  }

  async eliminarNotificacion(event: Event, notificacion: Notificacion) {
    event.stopPropagation();
    if (notificacion.id) {
      await this.notificacionesService.eliminarNotificacion(notificacion.id);
    }
  }

  cerrar() {
    this.popoverController.dismiss();
  }

  tieneNotificacionesNoLeidas(): boolean {
    return this.notificaciones.length > 0 && this.notificaciones.some(n => !n.leida);
  }

  getIconoNotificacion(tipo: string): string {
    switch (tipo) {
      case 'articulo_aprobado':
        return 'checkmark-circle';
      case 'articulo_rechazado':
        return 'close-circle';
      case 'mensaje':
        return 'chatbubble';
      case 'sistema':
        return 'information-circle';
      default:
        return 'notifications';
    }
  }

  getColorNotificacion(tipo: string): string {
    switch (tipo) {
      case 'articulo_aprobado':
        return 'success';
      case 'articulo_rechazado':
        return 'danger';
      case 'mensaje':
        return 'primary';
      case 'sistema':
        return 'medium';
      default:
        return 'primary';
    }
  }
}
