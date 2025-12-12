import { Component, Input, OnInit, ViewEncapsulation } from '@angular/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { QRService } from '../../core/services/qr.service';
import * as QRCodeLib from 'qrcode';

@Component({
  selector: 'app-qr-generator',
  standalone: true,
  templateUrl: './qr-generator.component.html',
  styleUrls: ['./qr-generator.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [IonicModule, CommonModule]
})
export class QRGeneratorComponent implements OnInit {

  @Input() articuloId: string = '';
  @Input() articuloNombre: string = '';

  qrCode: string = '';
  generando: boolean = false;
  qrGenerado: boolean = false;
  qrImageUrl: SafeUrl | string = '';

  constructor(
    private qrService: QRService,
    private modalController: ModalController,
    private sanitizer: DomSanitizer
  ) { }

  ngOnInit() {
    this.generarQR();
  }

  async generarQR() {
    try {
      this.generando = true;
      this.qrCode = await this.qrService.generarQRPermuta(this.articuloId, this.articuloNombre);
      
      setTimeout(() => {
        this.generarImagenQR();
        this.qrGenerado = true;
      }, 500);
    } catch (error) {
      console.error('Error generando QR:', error);
      alert('Error al generar QR');
    } finally {
      this.generando = false;
    }
  }

  async generarImagenQR() {
    try {
      const dataUrl = await (QRCodeLib.toDataURL as any)(this.qrCode, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 1,
        scale: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      this.qrImageUrl = this.sanitizer.bypassSecurityTrustUrl(dataUrl);
    } catch (error) {
      console.error('Error generando imagen QR:', error);
    }
  }

  async descargarQR() {
    try {
      const url = await (QRCodeLib.toDataURL as any)(this.qrCode, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 1,
        scale: 4
      });
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-permuta-${this.articuloNombre}.png`;
      link.click();
    } catch (error) {
      console.error('Error descargando QR:', error);
      alert('Error al descargar QR');
    }
  }

  cerrar() {
    this.modalController.dismiss();
  }

}