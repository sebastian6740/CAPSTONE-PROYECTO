import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';

@Component({
  selector: 'app-terminos-modal',
  templateUrl: './terminos-modal.component.html',
  styleUrls: ['./terminos-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class TerminosModalComponent {
  @Input() soloLectura: boolean = false; // Modo solo lectura (para ver términos sin aceptar/rechazar)

  constructor(private modalController: ModalController) {}

  aceptarTerminos() {
    this.modalController.dismiss({ aceptado: true });
  }

  rechazarTerminos() {
    this.modalController.dismiss({ aceptado: false });
  }

  cerrar() {
    this.modalController.dismiss();
  }
}
