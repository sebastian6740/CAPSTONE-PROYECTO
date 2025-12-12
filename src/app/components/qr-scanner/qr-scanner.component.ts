import { Component, OnInit, ViewChild, ElementRef, ViewEncapsulation } from '@angular/core';
import { IonicModule, ModalController, AlertController, LoadingController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { QRService } from '../../core/services/qr.service';
import { Auth } from '@angular/fire/auth';

declare var jsQR: any;

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  templateUrl: './qr-scanner.component.html',
  styleUrls: ['./qr-scanner.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [IonicModule, CommonModule]
})
export class QRScannerComponent implements OnInit {

  @ViewChild('video') video!: ElementRef;
  @ViewChild('canvas') canvas!: ElementRef;

  scanning: boolean = false;
  qrDetectado: string = '';
  infoQR: any = null;
  permisosCamara: boolean = false;

  constructor(
    private modalController: ModalController,
    private qrService: QRService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private auth: Auth
  ) { }

  ngOnInit() {
    this.iniciarEscaneo();
  }

  async iniciarEscaneo() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      if (this.video) {
        this.video.nativeElement.srcObject = stream;
        this.permisosCamara = true;
        this.scanning = true;
        this.escanearQR();
      }
    } catch (error) {
      console.error('Error accediendo a cámara:', error);
      const alert = await this.alertController.create({
        header: 'Permiso denegado',
        message: 'No se pudo acceder a la cámara. Por favor, verifica los permisos.',
        buttons: [
          {
            text: 'OK',
            handler: () => this.cerrar()
          }
        ]
      });
      await alert.present();
    }
  }

  escanearQR() {
    if (!this.scanning) return;

    const canvas = this.canvas?.nativeElement;
    const video = this.video?.nativeElement;

    if (canvas && video && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        this.qrDetectado = code.data;
        this.scanning = false;
        this.verificarQR(code.data);
      }
    }

    if (this.scanning) {
      requestAnimationFrame(() => this.escanearQR());
    }
  }

  async verificarQR(codigoQR: string) {
    const loading = await this.loadingController.create({
      message: 'Verificando QR...'
    });
    await loading.present();

    try {
      const qr = await this.qrService.verificarQR(codigoQR);

      await loading.dismiss();

      if (!qr) {
        const alert = await this.alertController.create({
          header: 'QR inválido',
          message: 'El código QR no es válido, está expirado o ya fue utilizado.',
          buttons: [
            {
              text: 'Intentar nuevamente',
              handler: () => {
                this.scanning = true;
                this.escanearQR();
              }
            }
          ]
        });
        await alert.present();
        return;
      }

      // QR válido, mostrar información
      this.infoQR = qr;
      await this.confirmarPermuta(qr);

    } catch (error) {
      await loading.dismiss();
      console.error('Error verificando QR:', error);
      
      const alert = await this.alertController.create({
        header: 'Error',
        message: 'Error al verificar el QR. Intenta nuevamente.',
        buttons: ['OK']
      });
      await alert.present();
      
      this.scanning = true;
      this.escanearQR();
    }
  }

  async confirmarPermuta(qr: any) {
    const alert = await this.alertController.create({
      header: '¡Permuta encontrada!',
      subHeader: qr.articuloNombre,
      message: `<strong>Vendedor:</strong> ${qr.usuarioNombre}<br>
                <strong>Email:</strong> ${qr.usuarioEmail}<br><br>
                ¿Confirmar que has realizado la permuta?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel',
          handler: () => {
            this.scanning = true;
            this.escanearQR();
          }
        },
        {
          text: 'Confirmar permuta',
          handler: async () => {
            await this.completarPermuta(qr.id);
          }
        }
      ]
    });
    await alert.present();
  }

  async completarPermuta(qrId: string) {
    const loading = await this.loadingController.create({
      message: 'Completando trueque...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const usuario = this.auth.currentUser;
      if (!usuario) {
        await loading.dismiss();
        const alert = await this.alertController.create({
          header: 'Error',
          message: 'Debes estar autenticado para completar el trueque',
          buttons: ['OK']
        });
        await alert.present();
        return;
      }

      console.log(`🔄 Llamando a completarPermuta con QR=${qrId}, Usuario=${usuario.uid}`);

      // Llamar al servicio con la nueva firma
      const resultado = await this.qrService.completarPermuta(qrId, usuario.uid);

      await loading.dismiss();

      if (resultado.exito) {
        // Mostrar alert de éxito con puntos ganados
        const puntosGanados = resultado.puntos?.comprador || 0;
        const mensaje = resultado.puntos
          ? `¡Has ganado ${puntosGanados} puntos! 🎉\n\nEl trueque se ha completado exitosamente.`
          : '¡El trueque se ha completado exitosamente!';

        const alertExito = await this.alertController.create({
          header: '¡Trueque completado!',
          message: mensaje,
          buttons: [
            {
              text: 'Ver mis trueques',
              handler: () => {
                this.cerrar();
                // Podrías navegar a /mis-trueques aquí si tienes Router
              }
            },
            {
              text: 'OK',
              handler: () => this.cerrar()
            }
          ]
        });
        await alertExito.present();
      } else {
        // Mostrar error específico del servicio
        const alert = await this.alertController.create({
          header: 'Error al completar trueque',
          message: resultado.mensaje,
          buttons: [
            {
              text: 'OK',
              handler: () => {
                // Si el error no es crítico, permitir reintentar
                if (resultado.mensaje.includes('conexión')) {
                  this.scanning = true;
                  this.escanearQR();
                } else {
                  this.cerrar();
                }
              }
            }
          ]
        });
        await alert.present();
      }
    } catch (error: any) {
      await loading.dismiss();
      console.error('❌ Error completando permuta:', error);

      const alert = await this.alertController.create({
        header: 'Error inesperado',
        message: error.message || 'Error al completar el trueque. Por favor intenta de nuevo.',
        buttons: [
          {
            text: 'Reintentar',
            handler: () => {
              this.completarPermuta(qrId);
            }
          },
          {
            text: 'Cancelar',
            role: 'cancel',
            handler: () => {
              this.scanning = true;
              this.escanearQR();
            }
          }
        ]
      });
      await alert.present();
    }
  }

  detenerEscaneo() {
    this.scanning = false;
    if (this.video) {
      const stream = this.video.nativeElement.srcObject;
      stream?.getTracks().forEach((track: any) => track.stop());
    }
  }

  cerrar() {
    this.detenerEscaneo();
    this.modalController.dismiss();
  }

  ngOnDestroy() {
    this.detenerEscaneo();
  }

}
