import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { ArticulosService, Articulo } from '../../core/services/articulos';
import { AuthService } from '../../core/services/auth.service';
import { RecompensasService } from '../../core/services/recompensas.service';

@Component({
  selector: 'app-mis-trueques',
  standalone: true,
  templateUrl: './mis-trueques.component.html',
  styleUrls: ['./mis-trueques.component.scss'],
  imports: [CommonModule, IonicModule]
})
export class MisTruequesComponent implements OnInit {

  misArticulos: Articulo[] = [];

  constructor(
    private router: Router,
    private articulosService: ArticulosService,
    private authService: AuthService,
    private alertController: AlertController,
    private toastController: ToastController,
    private recompensasService: RecompensasService
  ) {}

  ngOnInit() {
    this.cargarMisArticulos();
  }

  ionViewWillEnter() {
    this.cargarMisArticulos();
  }

  cargarMisArticulos() {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (usuarioActual) {
      this.misArticulos = this.articulosService.getArticulosPorUsuario(usuarioActual.id);
    }
  }

  volver() {
    this.router.navigate(['/perfil']);
  }

  verDetalle(articulo: Articulo) {
    if (articulo.id) {
      this.router.navigate(['/detalle-articulo', articulo.id]);
    }
  }

  async marcarComoPermutado(articulo: Articulo) {
    const alert = await this.alertController.create({
      header: 'Confirmar',
      message: `¿Marcar "${articulo.nombre}" como permutado?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: async () => {
            try {
              // Marcar artículo como permutado
              await this.articulosService.cambiarDisponibilidad(articulo.id || '', false);

              // Incrementar contador de trueques realizados
              this.authService.incrementarTruequeRealizados();

              // Otorgar puntos por el trueque
              const puntosGanados = this.recompensasService.otorgarPuntosPorTrueque(articulo.id || '');

              // Verificar y desbloquear insignias según trueques realizados
              this.verificarInsigniasPorTrueques();

              // Recargar artículos
              this.cargarMisArticulos();

              // Mostrar notificación con puntos ganados
              this.mostrarToast(`✅ ¡Trueque completado! +${puntosGanados} puntos`);
            } catch (error) {
              this.mostrarToast('❌ Error al actualizar el artículo', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async marcarComoDisponible(articulo: Articulo) {
    const alert = await this.alertController.create({
      header: 'Confirmar',
      message: `¿Marcar "${articulo.nombre}" como disponible nuevamente?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: async () => {
            try {
              await this.articulosService.cambiarDisponibilidad(articulo.id || '', true);
              this.cargarMisArticulos();
              this.mostrarToast('✅ Artículo marcado como disponible');
            } catch (error) {
              this.mostrarToast('❌ Error al actualizar el artículo', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async eliminarArticulo(articulo: Articulo) {
    const alert = await this.alertController.create({
      header: 'Eliminar artículo',
      message: `¿Estás seguro de eliminar "${articulo.nombre}"? Esta acción no se puede deshacer.`,
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
              await this.articulosService.eliminarArticulo(articulo.id || '');
              this.cargarMisArticulos();
              this.mostrarToast('✅ Artículo eliminado correctamente');
            } catch (error) {
              this.mostrarToast('❌ Error al eliminar el artículo', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  publicarArticulo() {
    this.router.navigate(['/publicar-articulo']);
  }

  async mostrarToast(mensaje: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2000,
      position: 'bottom',
      color: color
    });
    await toast.present();
  }

  /**
   * Verifica y desbloquea insignias según la cantidad de trueques realizados
   */
  private verificarInsigniasPorTrueques() {
    const usuario = this.authService.getUsuarioActualSync();
    if (!usuario) return;

    const trueques = usuario.trueques_realizados;

    // Primer trueque
    if (trueques === 1 && !usuario.insignias.includes('primer-trueque')) {
      this.authService.agregarInsignia('primer-trueque');
      this.mostrarToast('🎉 ¡Insignia desbloqueada: Primer Trueque!');
    }

    // Comerciante (10 trueques)
    if (trueques === 10 && !usuario.insignias.includes('comerciante')) {
      this.authService.agregarInsignia('comerciante');
      this.mostrarToast('🏆 ¡Insignia desbloqueada: Comerciante!');
    }

    // Coleccionista (25 trueques)
    if (trueques === 25 && !usuario.insignias.includes('coleccionista')) {
      this.authService.agregarInsignia('coleccionista');
      this.mostrarToast('🎁 ¡Insignia desbloqueada: Coleccionista!');
    }

    // Experto (50 trueques)
    if (trueques === 50 && !usuario.insignias.includes('experto')) {
      this.authService.agregarInsignia('experto');
      this.mostrarToast('💎 ¡Insignia desbloqueada: Experto!');
    }
  }
}
