import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { RecompensasService } from '../../core/services/recompensas.service';
import { Voucher, VoucherCanjeado } from '../../core/models/recompensas.model';

@Component({
  selector: 'app-recompensas',
  templateUrl: './recompensas.component.html',
  styleUrls: ['./recompensas.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class RecompensasComponent implements OnInit {

  vouchersDisponibles: Voucher[] = [];
  vouchersActivos: VoucherCanjeado[] = [];
  puntosActuales = 0;
  segmentoActual: string = 'catalogo';

  constructor(
    private router: Router,
    private recompensasService: RecompensasService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.cargarDatos();
  }

  ionViewWillEnter() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.vouchersDisponibles = this.recompensasService.obtenerVouchersDisponibles();
    this.vouchersActivos = this.recompensasService.obtenerVouchersActivos();
    this.puntosActuales = this.recompensasService.obtenerSaldoPuntos();

    // Suscribirse a cambios en puntos
    this.recompensasService.puntosActualizados$.subscribe(puntos => {
      this.puntosActuales = puntos;
    });
  }

  cambiarSegmento(event: any) {
    this.segmentoActual = event.detail.value;
  }

  async canjearVoucher(voucher: Voucher) {
    // Validar puntos suficientes
    if (this.puntosActuales < voucher.puntosNecesarios) {
      const faltante = voucher.puntosNecesarios - this.puntosActuales;
      this.mostrarMensaje(
        `Te faltan ${faltante} puntos para canjear esta recompensa`,
        'warning'
      );
      return;
    }

    // Confirmar canje
    const alert = await this.alertController.create({
      header: 'Canjear Recompensa',
      message: `¿Deseas canjear "${voucher.nombre}" por ${voucher.puntosNecesarios} puntos?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Canjear',
          handler: () => {
            this.procesarCanje(voucher);
          }
        }
      ]
    });

    await alert.present();
  }

  private async procesarCanje(voucher: Voucher) {
    const resultado = await this.recompensasService.canjearVoucher(voucher.id);

    if (resultado.exito) {
      this.mostrarMensaje(resultado.mensaje, 'success');
      this.cargarDatos(); // Recargar datos

      // Mostrar detalles del voucher canjeado
      if (resultado.voucher) {
        this.mostrarDetallesVoucher(resultado.voucher);
      }
    } else {
      this.mostrarMensaje(resultado.mensaje, 'danger');
    }
  }

  async mostrarDetallesVoucher(voucher: VoucherCanjeado) {
    const mensaje = voucher.fechaExpiracion
      ? `Código: ${voucher.codigo}\n\nVálido hasta: ${new Date(voucher.fechaExpiracion).toLocaleDateString()}`
      : `Código: ${voucher.codigo}\n\nSin fecha de expiración`;

    const alert = await this.alertController.create({
      header: '¡Voucher Canjeado!',
      message: mensaje,
      buttons: ['OK']
    });

    await alert.present();
  }

  volver() {
    this.router.navigate(['/perfil']);
  }

  async mostrarMensaje(mensaje: string, color: string) {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2500,
      position: 'bottom',
      color: color
    });
    await toast.present();
  }

  // Helpers para la UI
  puedesCanjear(voucher: Voucher): boolean {
    return this.puntosActuales >= voucher.puntosNecesarios;
  }

  obtenerTextoExpiracion(voucherCanjeado: VoucherCanjeado): string {
    if (!voucherCanjeado.fechaExpiracion) {
      return 'Sin expiración';
    }

    const fecha = new Date(voucherCanjeado.fechaExpiracion);
    const ahora = new Date();
    const diasRestantes = Math.ceil((fecha.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

    if (diasRestantes < 0) {
      return 'Expirado';
    } else if (diasRestantes === 0) {
      return 'Expira hoy';
    } else if (diasRestantes === 1) {
      return 'Expira mañana';
    } else if (diasRestantes <= 7) {
      return `Expira en ${diasRestantes} días`;
    } else {
      return `Válido hasta ${fecha.toLocaleDateString()}`;
    }
  }

  estaExpirado(voucherCanjeado: VoucherCanjeado): boolean {
    if (!voucherCanjeado.fechaExpiracion) {
      return false;
    }
    return new Date(voucherCanjeado.fechaExpiracion) < new Date();
  }

  formatearFecha(fecha: Date | string): string {
    return new Date(fecha).toLocaleDateString();
  }
}
