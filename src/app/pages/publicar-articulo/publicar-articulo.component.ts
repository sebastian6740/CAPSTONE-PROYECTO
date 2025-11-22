import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, ActionSheetController, AlertController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { ArticulosService, Articulo } from '../../core/services/articulos';

@Component({
  selector: 'app-publicar-articulo',
  standalone: true,
  templateUrl: './publicar-articulo.component.html',
  styleUrls: ['./publicar-articulo.component.scss'],
  imports: [IonicModule, CommonModule, FormsModule]
})
export class PublicarArticuloComponent implements OnInit {

  // Datos del artículo
  articulo: Articulo = {
    nombre: '',
    descripcion: '',
    categoria: '',
    fotos: []
  };

  // Categorías disponibles
  categorias = [
    { id: 'libros', nombre: 'Libros', emoji: '📚' },
    { id: 'videojuegos', nombre: 'Videojuegos', emoji: '🎮' },
    { id: 'ropa', nombre: 'Ropa', emoji: '👕' },
    { id: 'electronica', nombre: 'Electrónica', emoji: '📱' },
    { id: 'deportes', nombre: 'Deportes', emoji: '⚽' },
    { id: 'otros', nombre: 'Otros', emoji: '📦' }
  ];

  constructor(
    private router: Router,
    private actionSheetController: ActionSheetController,
    private articulosService: ArticulosService,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.cargarArticuloBorrador();
  }

  // Volver a home
  volver() {
    this.router.navigate(['/home']);
  }

  // Seleccionar categoría
  async seleccionarCategoria(categoriaId: string) {
    this.articulo.categoria = categoriaId;
    await this.guardarEnStorage();
  }

  // Seleccionar fotos - Mostrar opciones
  async seleccionarFotos() {
    if (this.articulo.fotos.length >= 5) {
      alert('Solo puedes agregar hasta 5 fotos');
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: 'Seleccionar foto',
      buttons: [
        {
          text: 'Tomar foto',
          icon: 'camera',
          handler: () => {
            this.tomarFoto(CameraSource.Camera);
          }
        },
        {
          text: 'Elegir de galería',
          icon: 'images',
          handler: () => {
            this.tomarFoto(CameraSource.Photos);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });

    await actionSheet.present();
  }

  // Tomar o seleccionar foto
  async tomarFoto(source: CameraSource) {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source
      });

      if (image.dataUrl) {
        this.articulo.fotos.push(image.dataUrl);
        await this.guardarEnStorage();
      }
    } catch (error) {
      console.error('Error al seleccionar foto:', error);
    }
  }

  // Eliminar foto
  async eliminarFoto(index: number) {
    this.articulo.fotos.splice(index, 1);
    await this.guardarEnStorage();
  }

  // Guardar en storage
  async guardarEnStorage() {
    try {
      await Preferences.set({
        key: 'articulo_borrador',
        value: JSON.stringify(this.articulo)
      });
      console.log('Artículo guardado en storage');
    } catch (error) {
      console.error('Error al guardar en storage:', error);
    }
  }

  // Cargar artículo desde storage
  async cargarArticuloBorrador() {
    try {
      const { value } = await Preferences.get({ key: 'articulo_borrador' });
      if (value) {
        this.articulo = JSON.parse(value);
        console.log('Artículo cargado desde storage');
      }
    } catch (error) {
      console.error('Error al cargar desde storage:', error);
    }
  }

  // Limpiar storage al publicar
  async limpiarStorage() {
    try {
      await Preferences.remove({ key: 'articulo_borrador' });
      console.log('Storage limpiado');
    } catch (error) {
      console.error('Error al limpiar storage:', error);
    }
  }

  // Publicar artículo
  async publicarArticulo() {
    if (this.validarFormulario()) {
      try {
        console.log('Publicando artículo:', this.articulo);

        // Guardar el artículo usando el servicio
        await this.articulosService.agregarArticulo(this.articulo);

        // Limpiar el borrador
        await this.limpiarStorage();

        // Mostrar mensaje de éxito con información de revisión
        const alert = await this.alertController.create({
          header: '¡Artículo publicado!',
          message: 'Tu artículo ha sido publicado exitosamente y está siendo revisado por nuestro equipo de administración. Recibirás una notificación cuando sea aprobado.',
          buttons: [
            {
              text: 'Entendido',
              handler: () => {
                // Volver al home
                this.router.navigate(['/home']);
              }
            }
          ],
          backdropDismiss: false
        });
        await alert.present();
      } catch (error) {
        console.error('Error al publicar artículo:', error);
        const alertError = await this.alertController.create({
          header: 'Error',
          message: 'Error al publicar el artículo. Por favor intenta de nuevo.',
          buttons: ['OK']
        });
        await alertError.present();
      }
    }
  }

  // Validar formulario
  validarFormulario(): boolean {
    if (!this.articulo.nombre.trim()) {
      alert('Por favor ingresa un nombre para el artículo');
      return false;
    }
    if (!this.articulo.descripcion.trim()) {
      alert('Por favor ingresa una descripción');
      return false;
    }
    if (!this.articulo.categoria) {
      alert('Por favor selecciona una categoría');
      return false;
    }
    return true;
  }

}
