import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, AlertController, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuscripcionService } from '../../core/services/suscripcion.service';
import { PagoService } from '../../core/services/pago.service';

@Component({
  selector: 'app-suscripcion',
  standalone: true,
  templateUrl: './suscripcion.component.html',
  styleUrls: ['./suscripcion.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [IonicModule, CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SuscripcionComponent implements OnInit {

  infoSuscripcion: any = {
    esSuscriptor: false,
    plan: 'gratis',
    diasRestantes: 0,
    fechaVencimiento: null
  };

  planes: any[] = [];
  planSeleccionado: string = '';
  mostrarFormularioPago: boolean = false;

  // Datos de tarjeta para prueba
  datosTargeta = {
    numero: '4242424242424242',
    mes: '12',
    anio: '2025',
    cvc: '123'
  };

  constructor(
    private suscripcionService: SuscripcionService,
    private pagoService: PagoService,
    private router: Router,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {
    this.planes = this.pagoService.obtenerPlanes();
  }

  ngOnInit() {
    this.cargarInfoSuscripcion();
  }

  async cargarInfoSuscripcion() {
    this.infoSuscripcion = await this.suscripcionService.obtenerInfoSuscripcion();
  }

  seleccionarPlan(planId: string) {
    this.planSeleccionado = planId;
    this.mostrarFormularioPago = true;
  }

  async procesarPago() {
    if (!this.planSeleccionado) return;

    const loading = await this.loadingController.create({
      message: 'Procesando pago...',
      spinner: 'circles'
    });
    await loading.present();

    try {
      const resultado = await this.pagoService.procesarPagoConStripe(
        this.planSeleccionado,
        'usuario@example.com'
      );

      await loading.dismiss();

      if (resultado.success) {
        const alert = await this.alertController.create({
          header: '¡Pago Exitoso!',
          message: `Tu suscripción ${this.pagoService.obtenerPlanDetalle(this.planSeleccionado)?.nombre} ha sido activada. Ahora puedes publicar artículos ilimitadamente.`,
          buttons: [
            {
              text: 'Ir a publicar',
              handler: () => {
                // Refrescar estado de suscripción
                this.cargarInfoSuscripcion();
                this.router.navigate(['/publicar-articulo']);
              }
            }
          ]
        });
        await alert.present();
        await this.cargarInfoSuscripcion();
        this.mostrarFormularioPago = false;
        this.planSeleccionado = '';
      } else {
        const alert = await this.alertController.create({
          header: 'Error',
          message: resultado.message,
          buttons: ['OK']
        });
        await alert.present();
      }
    } catch (error) {
      await loading.dismiss();
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'Error al procesar el pago',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  async cancelarSuscripcion() {
    const alert = await this.alertController.create({
      header: '¿Cancelar suscripción?',
      message: 'Se te cobrarán por cada artículo después de la primera publicación gratuita.',
      buttons: [
        {
          text: 'No',
          role: 'cancel'
        },
        {
          text: 'Sí, cancelar',
          handler: async () => {
            await this.suscripcionService.cancelarSuscripcion();
            await this.cargarInfoSuscripcion();
          }
        }
      ]
    });
    await alert.present();
  }

  volver() {
    this.mostrarFormularioPago = false;
    this.planSeleccionado = '';
  }

}
