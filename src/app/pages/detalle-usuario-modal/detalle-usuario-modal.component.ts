import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { Usuario } from '../../core/models/user.model';
import { Articulo, ArticulosService } from '../../core/services/articulos';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-detalle-usuario-modal',
  templateUrl: './detalle-usuario-modal.component.html',
  styleUrls: ['./detalle-usuario-modal.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class DetalleUsuarioModalComponent implements OnInit {
  @Input() usuario!: Usuario;

  articulosUsuario: Articulo[] = [];
  segmentoActual: string = 'perfil';

  constructor(
    private modalController: ModalController,
    private articulosService: ArticulosService,
    private authService: AuthService,
    private alertController: AlertController,
    private toastController: ToastController,
    private router: Router
  ) { }

  ngOnInit() {
    this.cargarArticulosUsuario();
  }

  cargarArticulosUsuario() {
    this.articulosUsuario = this.articulosService.getArticulosPorUsuario(this.usuario.id);
  }

  cerrarModal() {
    this.modalController.dismiss();
  }

  cambiarSegmento(event: any) {
    this.segmentoActual = event.detail.value;
  }

  // Verificar usuario
  async verificarUsuario() {
    const alert = await this.alertController.create({
      header: 'Verificar Usuario',
      message: `¿Deseas verificar a ${this.usuario.nombre}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Verificar',
          handler: async () => {
            try {
              // Aquí implementarías la lógica de verificación en el servicio
              this.mostrarMensaje('Usuario verificado correctamente');
              this.usuario.verificado = true;
            } catch (error) {
              this.mostrarMensaje('Error al verificar usuario', true);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Aprobar foto pendiente
  async aprobarFoto() {
    try {
      await this.authService.aprobarFoto(this.usuario.id);
      this.mostrarMensaje('Foto aprobada correctamente');
      // Actualizar usuario
      this.usuario.foto = this.usuario.foto_pendiente;
      this.usuario.foto_pendiente = undefined;
      this.usuario.estado_foto = 'aprobada';
    } catch (error) {
      this.mostrarMensaje('Error al aprobar foto', true);
    }
  }

  // Rechazar foto
  async rechazarFoto() {
    const alert = await this.alertController.create({
      header: 'Rechazar Foto',
      message: 'Indica el motivo del rechazo (opcional):',
      inputs: [
        {
          name: 'motivo',
          type: 'textarea',
          placeholder: 'Ej: La foto no cumple con las políticas...'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Rechazar',
          role: 'destructive',
          handler: async (data) => {
            try {
              await this.authService.rechazarFoto(this.usuario.id, data.motivo);
              this.mostrarMensaje('Foto rechazada');
              this.usuario.foto_pendiente = undefined;
              this.usuario.estado_foto = 'rechazada';
            } catch (error) {
              this.mostrarMensaje('Error al rechazar foto', true);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Eliminar usuario
  async eliminarUsuario() {
    // Contar datos relacionados
    const cantidadArticulos = this.articulosUsuario.length;

    const alert = await this.alertController.create({
      header: '⚠️ Eliminar Usuario',
      message: `¿Estás seguro de eliminar a ${this.usuario.nombre}?

Se eliminarán permanentemente:
• ${cantidadArticulos} artículo(s) publicado(s)
• Todas sus conversaciones
• Todos sus mensajes
• Su foto de perfil

⛔ Esta acción NO se puede deshacer`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar Usuario',
          role: 'destructive',
          handler: async () => {
            try {
              // Eliminar usuario
              await this.authService.eliminarUsuario(this.usuario.id);
              this.mostrarMensaje('Usuario eliminado correctamente');
              this.modalController.dismiss({ eliminado: true });
            } catch (error: any) {
              this.mostrarMensaje(error.message || 'Error al eliminar usuario', true);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Ver detalle de artículo
  verDetalleArticulo(articulo: Articulo) {
    this.modalController.dismiss();
    this.router.navigate(['/detalle-articulo', articulo.id]);
  }

  // Eliminar artículo del usuario
  async eliminarArticulo(articulo: Articulo) {
    const alert = await this.alertController.create({
      header: 'Eliminar Artículo',
      message: `¿Deseas eliminar "${articulo.nombre}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.articulosService.eliminarArticuloComoAdmin(articulo.id || '');
              this.mostrarMensaje('Artículo eliminado');
              this.cargarArticulosUsuario(); // Recargar lista
            } catch (error) {
              this.mostrarMensaje('Error al eliminar artículo', true);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  // Calcular días desde registro
  getDiasDesdeRegistro(): number {
    const fechaRegistro = new Date(this.usuario.fechaRegistro);
    const hoy = new Date();
    const diferencia = hoy.getTime() - fechaRegistro.getTime();
    return Math.floor(diferencia / (1000 * 60 * 60 * 24));
  }

  // Obtener nivel del usuario según trueques
  getNivelUsuario(): string {
    const trueques = this.usuario.trueques_realizados;
    if (trueques >= 50) return 'Premium';
    if (trueques >= 20) return 'Estándar';
    return 'Básico';
  }

  // Mensaje de toast
  async mostrarMensaje(mensaje: string, esError: boolean = false) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2500,
      position: 'bottom',
      color: esError ? 'danger' : 'success'
    });
    await toast.present();
  }

  // Verificar si tiene foto pendiente
  tieneFotoPendiente(): boolean {
    return this.usuario.estado_foto === 'pendiente' && !!this.usuario.foto_pendiente;
  }

  // Verificar si el usuario es admin
  esUsuarioAdmin(): boolean {
    return this.usuario.rol === 'admin';
  }
}
