import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, AlertController, ModalController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ArticulosService, Articulo } from '../../core/services/articulos';
import { Usuario } from '../../core/models/user.model';
import { DetalleUsuarioModalComponent } from '../detalle-usuario-modal/detalle-usuario-modal.component';
import { FirebaseDatePipe } from '../../core/pipes/firebase-date.pipe';

@Component({
  selector: 'app-admin',
  standalone: true,
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
  imports: [IonicModule, CommonModule, FirebaseDatePipe]
})
export class AdminComponent implements OnInit, OnDestroy {

  usuarios: Usuario[] = [];
  articulos: Articulo[] = [];
  fotosPendientes: Usuario[] = [];
  vistaActiva: 'articulos' | 'usuarios' | 'fotos' | 'pendientes' = 'pendientes';
  usuarioAdmin: Usuario | null = null;
  procesando: boolean = false;
  private articulosSubscription: any;

  estadisticas = {
    totalUsuarios: 0,
    totalArticulos: 0,
    articulosHoy: 0,
    usuariosNuevos: 0,
    articulosPendientes: 0
  };

  constructor(
    private router: Router,
    private authService: AuthService,
    private articulosService: ArticulosService,
    private alertController: AlertController,
    private modalController: ModalController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.usuarioAdmin = this.authService.getUsuarioActualSync();
    this.cargarDatos();
  }

  async cargarDatos() {
    console.log('⚙️ Admin: Cargando datos...');

    // Cargar usuarios
    this.usuarios = await this.authService.obtenerTodosUsuarios();

    // Cargar fotos pendientes
    this.fotosPendientes = await this.authService.obtenerUsuariosConFotosPendientes();

    // Cargar artículos (solo una vez)
    if (this.articulosSubscription) {
      this.articulosSubscription.unsubscribe();
    }

    this.articulosSubscription = this.articulosService.articulos$.subscribe(arts => {
      this.articulos = arts;
      this.calcularEstadisticas();
      console.log(`✅ Admin: ${this.articulos.length} artículos cargados`);
    });
  }

  calcularEstadisticas() {
    this.estadisticas.totalUsuarios = this.usuarios.length;
    this.estadisticas.totalArticulos = this.articulos.length;

    // Artículos publicados hoy
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    this.estadisticas.articulosHoy = this.articulos.filter(art => {
      if (!art.fechaPublicacion) return false;
      const fechaPub = art.fechaPublicacion instanceof Date
        ? new Date(art.fechaPublicacion)
        : new Date();
      fechaPub.setHours(0, 0, 0, 0);
      return fechaPub.getTime() === hoy.getTime();
    }).length;

    // Usuarios nuevos (últimos 7 días)
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 7);
    this.estadisticas.usuariosNuevos = this.usuarios.filter(user => {
      const fechaRegistro = new Date(user.fechaRegistro);
      return fechaRegistro >= hace7Dias;
    }).length;

    // Artículos pendientes de aprobación
    this.estadisticas.articulosPendientes = this.articulos.filter(art => art.aprobado === false).length;
  }

  cambiarVista(vista: any) {
    if (vista === 'articulos' || vista === 'usuarios' || vista === 'fotos' || vista === 'pendientes') {
      this.vistaActiva = vista;
    }
  }

  getArticulosPendientes(): Articulo[] {
    return this.articulos.filter(art => art.aprobado === false);
  }

  getArticulosAprobados(): Articulo[] {
    return this.articulos.filter(art => art.aprobado === true);
  }

  async eliminarArticulo(articulo: Articulo) {
    const alert = await this.alertController.create({
      header: 'Confirmar eliminación',
      message: `¿Estás seguro de eliminar el artículo "${articulo.nombre}"?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.articulosService.eliminarArticuloComoAdmin(articulo.id || '');
              this.mostrarMensaje('Artículo eliminado correctamente');
            } catch (error) {
              this.mostrarMensaje('Error al eliminar el artículo', true);
            }
          }
        }
      ]
    });

    await alert.present();
  }

  obtenerNombreUsuario(usuarioId: string): string {
    const usuario = this.usuarios.find(u => u.id === usuarioId);
    return usuario?.nombre || 'Usuario desconocido';
  }

  async verDetalleUsuario(usuario: Usuario) {
    const modal = await this.modalController.create({
      component: DetalleUsuarioModalComponent,
      componentProps: {
        usuario: usuario
      },
      cssClass: 'modal-detalle-usuario'
    });

    await modal.present();

    // Cuando se cierre el modal, recargar datos si se eliminó un usuario
    const { data } = await modal.onWillDismiss();
    if (data?.eliminado) {
      this.cargarDatos();
      this.mostrarToast('Usuario eliminado correctamente');
    }
  }

  async eliminarUsuario(usuario: Usuario) {
    // Contar artículos del usuario
    const cantidadArticulos = this.articulos.filter(art => art.usuarioId === usuario.id).length;

    const alert = await this.alertController.create({
      header: '⚠️ Eliminar Usuario',
      message: `
        <p><strong>¿Estás seguro de eliminar a ${usuario.nombre}?</strong></p>
        <p>Se eliminarán permanentemente:</p>
        <ul style="text-align: left; padding-left: 20px;">
          <li>${cantidadArticulos} artículo(s) publicado(s)</li>
          <li>Todas sus conversaciones</li>
          <li>Todos sus mensajes</li>
          <li>Su foto de perfil</li>
        </ul>
        <p style="color: #ef4444; font-weight: bold;">⛔ Esta acción NO se puede deshacer</p>
      `,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar Usuario',
          role: 'destructive',
          handler: async () => {
            try {
              await this.authService.eliminarUsuario(usuario.id);
              this.mostrarToast('Usuario eliminado correctamente');
              this.cargarDatos(); // Recargar lista
            } catch (error: any) {
              this.mostrarToast(error.message || 'Error al eliminar usuario', true);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async aprobarFoto(usuario: Usuario) {
    const alert = await this.alertController.create({
      header: 'Aprobar foto',
      message: `¿Estás seguro que deseas aprobar la foto de ${usuario.nombre}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Aprobar',
          handler: () => {
            this.procesando = true;
            this.authService.aprobarFoto(usuario.id).subscribe({
              next: (resultado) => {
                this.procesando = false;
                if (resultado.exito) {
                  this.mostrarMensaje(resultado.mensaje);
                  // Recargar datos
                  this.cargarDatos();
                } else {
                  this.mostrarMensaje(resultado.mensaje, true);
                }
              },
              error: () => {
                this.procesando = false;
                this.mostrarMensaje('Error al aprobar la foto', true);
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async rechazarFoto(usuario: Usuario) {
    const alert = await this.alertController.create({
      header: 'Rechazar foto',
      message: `¿Por qué rechazas la foto de ${usuario.nombre}?`,
      inputs: [
        {
          name: 'motivo',
          type: 'textarea',
          placeholder: 'Motivo del rechazo (opcional)',
          attributes: {
            maxlength: 200
          }
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Rechazar',
          role: 'destructive',
          handler: (data) => {
            this.procesando = true;
            this.authService.rechazarFoto(usuario.id, data.motivo).subscribe({
              next: (resultado) => {
                this.procesando = false;
                if (resultado.exito) {
                  this.mostrarMensaje(resultado.mensaje);
                  // Recargar datos
                  this.cargarDatos();
                } else {
                  this.mostrarMensaje(resultado.mensaje, true);
                }
              },
              error: () => {
                this.procesando = false;
                this.mostrarMensaje('Error al rechazar la foto', true);
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async mostrarMensaje(mensaje: string, esError: boolean = false) {
    const alert = await this.alertController.create({
      header: esError ? 'Error' : 'Éxito',
      message: mensaje,
      buttons: ['OK']
    });
    await alert.present();
  }

  async mostrarToast(mensaje: string, esError: boolean = false) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2500,
      position: 'bottom',
      color: esError ? 'danger' : 'success'
    });
    await toast.present();
  }

  volver() {
    this.router.navigate(['/home']);
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  async aprobarArticulo(articulo: Articulo) {
    const alert = await this.alertController.create({
      header: 'Aprobar artículo',
      message: `¿Deseas aprobar el artículo "${articulo.nombre}" de ${this.obtenerNombreUsuario(articulo.usuarioId || '')}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Aprobar',
          handler: async () => {
            try {
              this.procesando = true;
              await this.articulosService.aprobarArticulo(articulo.id || '');
              this.mostrarToast('Artículo aprobado correctamente');
              this.procesando = false;
            } catch (error) {
              this.procesando = false;
              this.mostrarToast('Error al aprobar el artículo', true);
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async rechazarArticulo(articulo: Articulo) {
    // Primero pedir el motivo del rechazo
    const alertMotivo = await this.alertController.create({
      header: 'Rechazar artículo',
      message: `Indica el motivo por el que rechazas "${articulo.nombre}". Este mensaje será enviado al usuario.`,
      inputs: [
        {
          name: 'motivo',
          type: 'textarea',
          placeholder: 'Ej: El artículo no cumple con las políticas de la plataforma...',
          attributes: {
            maxlength: 500
          }
        }
      ],
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Continuar',
          handler: async (data) => {
            if (!data.motivo || data.motivo.trim() === '') {
              this.mostrarToast('Debes indicar un motivo de rechazo', true);
              return false;
            }

            // Confirmar el rechazo
            const alertConfirmar = await this.alertController.create({
              header: 'Confirmar rechazo',
              message: `¿Estás seguro de rechazar este artículo? Se eliminará permanentemente y el usuario recibirá una notificación.`,
              buttons: [
                {
                  text: 'Cancelar',
                  role: 'cancel'
                },
                {
                  text: 'Rechazar',
                  role: 'destructive',
                  handler: async () => {
                    try {
                      this.procesando = true;
                      await this.articulosService.rechazarArticulo(articulo.id || '', data.motivo.trim());
                      this.mostrarToast('Artículo rechazado y usuario notificado');
                      this.procesando = false;
                    } catch (error) {
                      this.procesando = false;
                      this.mostrarToast('Error al rechazar el artículo', true);
                    }
                  }
                }
              ]
            });
            await alertConfirmar.present();
            return true;
          }
        }
      ]
    });
    await alertMotivo.present();
  }

  ngOnDestroy() {
    console.log('🔕 Admin: Limpiando suscripciones...');
    if (this.articulosSubscription) {
      this.articulosSubscription.unsubscribe();
    }
  }
}
