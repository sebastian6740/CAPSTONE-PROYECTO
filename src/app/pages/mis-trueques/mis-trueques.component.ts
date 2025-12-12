import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController, ModalController } from '@ionic/angular';
import { ArticulosService, Articulo } from '../../core/services/articulos';
import { AuthService } from '../../core/services/auth.service';
import { RecompensasService } from '../../core/services/recompensas.service';
import { FirebaseDatePipe } from '../../core/pipes/firebase-date.pipe';
import { QRGeneratorComponent } from '../../components/qr-generator/qr-generator.component';
import { QRService, PermutaCompletada } from '../../core/services/qr.service';

@Component({
  selector: 'app-mis-trueques',
  standalone: true,
  templateUrl: './mis-trueques.component.html',
  styleUrls: ['./mis-trueques.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [CommonModule, FormsModule, IonicModule, FirebaseDatePipe]
})
export class MisTruequesComponent implements OnInit {

  misArticulos: Articulo[] = [];
  historialTrueques: PermutaCompletada[] = [];
  estadisticas: any = null;
  cargandoHistorial: boolean = false;
  vistaActual: 'articulos' | 'historial' = 'articulos';

  constructor(
    private router: Router,
    private articulosService: ArticulosService,
    private authService: AuthService,
    private alertController: AlertController,
    private toastController: ToastController,
    private recompensasService: RecompensasService,
    private modalController: ModalController,
    private qrService: QRService
  ) {}

  ngOnInit() {
    this.cargarMisArticulos();
    this.cargarHistorialTrueques();
  }

  ionViewWillEnter() {
    this.cargarMisArticulos();
    this.cargarHistorialTrueques();
  }

  cargarMisArticulos() {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (usuarioActual) {
      this.misArticulos = this.articulosService.getArticulosPorUsuario(usuarioActual.id);
    }
  }

  async cargarHistorialTrueques() {
    const usuarioActual = this.authService.getUsuarioActualSync();
    if (!usuarioActual) return;

    this.cargandoHistorial = true;

    try {
      // Cargar historial y estadísticas en paralelo
      const [historial, estadisticas] = await Promise.all([
        this.qrService.obtenerHistorialTrueques(usuarioActual.id),
        this.qrService.obtenerEstadisticasTrueques(usuarioActual.id)
      ]);

      this.historialTrueques = historial;
      this.estadisticas = estadisticas;

      console.log(`✅ Historial cargado: ${historial.length} trueques`);
      console.log(`📊 Estadísticas:`, estadisticas);
    } catch (error) {
      console.error('❌ Error cargando historial:', error);
      this.mostrarToast('Error al cargar el historial de trueques', 'danger');
    } finally {
      this.cargandoHistorial = false;
    }
  }

  // Métodos auxiliares para el historial
  getRolDisplay(permuta: PermutaCompletada): string {
    return permuta.rolUsuario === 'vendedor' ? 'Vendiste' : 'Compraste';
  }

  getOtroUsuario(permuta: PermutaCompletada): string {
    return permuta.rolUsuario === 'vendedor'
      ? permuta.compradorNombre
      : permuta.vendedorNombre;
  }

  getPuntosGanados(permuta: PermutaCompletada): number {
    return permuta.rolUsuario === 'vendedor'
      ? permuta.puntosOtorgados?.vendedor || 0
      : permuta.puntosOtorgados?.comprador || 0;
  }

  formatearFecha(fecha: Date): string {
    const ahora = new Date();
    const diffMs = ahora.getTime() - fecha.getTime();
    const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDias === 0) return 'Hoy';
    if (diffDias === 1) return 'Ayer';
    if (diffDias < 7) return `Hace ${diffDias} días`;
    if (diffDias < 30) return `Hace ${Math.floor(diffDias / 7)} semanas`;
    if (diffDias < 365) return `Hace ${Math.floor(diffDias / 30)} meses`;
    return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  volver() {
    this.router.navigate(['/perfil']);
  }

  verDetalle(articulo: Articulo) {
    if (articulo.id) {
      this.router.navigate(['/detalle-articulo', articulo.id]);
    }
  }

  async generarQRPermuta(articulo: any) {
    const modal = await this.modalController.create({
      component: QRGeneratorComponent,
      componentProps: {
        articuloId: articulo.id,
        articuloNombre: articulo.nombre
      }
    });
    await modal.present();
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
