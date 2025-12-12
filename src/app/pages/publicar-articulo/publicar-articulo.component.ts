import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule, ActionSheetController, AlertController, ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { ArticulosService, Articulo } from '../../core/services/articulos';
import { SuscripcionService } from '../../core/services/suscripcion.service';

@Component({
  selector: 'app-publicar-articulo',
  standalone: true,
  templateUrl: './publicar-articulo.component.html',
  styleUrls: ['./publicar-articulo.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [IonicModule, CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class PublicarArticuloComponent implements OnInit {

  // Datos del artículo
  articulo: Articulo = {
    nombre: '',
    descripcion: '',
    categoria: '',
    fotos: []
  };

  // Propiedades para control de publicaciones
  ultimaPublicacion: number = 0;
  esSuscriptor: boolean = false;
  puedePublicar: boolean = true;
  proximaPublicacionEn: string = '';
  esFirstPublicacion: boolean = false;

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
    private alertController: AlertController,
    private suscripcionService: SuscripcionService,
    private modalController: ModalController
  ) { }

  ngOnInit() {
    this.cargarArticuloBorrador();
    this.verificarEstadoPublicacion();
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

  // Verificar si el usuario puede publicar
  async verificarEstadoPublicacion() {
    try {
      // Verificar suscripción en Firebase
      this.esSuscriptor = await this.suscripcionService.esSuscriptorActivo();

      // Obtener última publicación del storage local
      const { value: ultimaPub } = await Preferences.get({ key: 'ultima_publicacion' });
      this.ultimaPublicacion = ultimaPub ? parseInt(ultimaPub) : 0;

      // Validar permisos
      this.validarPermisoPublicacion();
    } catch (error) {
      console.error('Error al verificar estado de publicación:', error);
    }
  }

  // Validar si puede publicar según reglas
  private validarPermisoPublicacion() {
    // Si es suscriptor, puede publicar ilimitadamente
    if (this.esSuscriptor) {
      this.puedePublicar = true;
      this.proximaPublicacionEn = '';
      return;
    }

    // Si nunca ha publicado, puede publicar gratis
    if (this.ultimaPublicacion === 0) {
      this.puedePublicar = true;
      this.proximaPublicacionEn = '';
      return;
    }

    // Verificar si pasaron 24 horas
    const ahora = Date.now();
    const horasTranscurridas = (ahora - this.ultimaPublicacion) / (1000 * 60 * 60);
    const HORAS_ESPERA = 24;

    if (horasTranscurridas >= HORAS_ESPERA) {
      this.puedePublicar = true;
      this.proximaPublicacionEn = '';
    } else {
      this.puedePublicar = false;
      const horasRestantes = Math.ceil(HORAS_ESPERA - horasTranscurridas);
      const minutosRestantes = Math.ceil((HORAS_ESPERA - horasTranscurridas) * 60);
      this.proximaPublicacionEn = horasRestantes > 0 
        ? `${horasRestantes}h` 
        : `${minutosRestantes}m`;
    }
  }

  // Publicar artículo
  async publicarArticulo() {
    // Verificar permisos antes de publicar
    await this.verificarEstadoPublicacion();

    if (!this.puedePublicar) {
      const alert = await this.alertController.create({
        header: 'No puedes publicar aún',
        message: `Debes esperar ${this.proximaPublicacionEn} para la próxima publicación gratuita, o suscríbete para publicar ilimitadamente.`,
        buttons: [
          {
            text: 'Suscribirme',
            handler: () => {
              this.router.navigate(['/suscripcion']);
            }
          },
          {
            text: 'Esperar',
            role: 'cancel'
          }
        ]
      });
      await alert.present();
      return;
    }

    if (this.validarFormulario()) {
      try {
        console.log('Publicando artículo:', this.articulo);

        // Guardar el artículo usando el servicio
        await this.articulosService.agregarArticulo(this.articulo);

        // Verificar si es la primera publicación
        this.esFirstPublicacion = this.ultimaPublicacion === 0;

        // Guardar timestamp de publicación (solo si no es suscriptor)
        if (!this.esSuscriptor) {
          await Preferences.set({
            key: 'ultima_publicacion',
            value: Date.now().toString()
          });
        }

        // Limpiar el borrador
        await this.limpiarStorage();

        // Si es primera publicación y no es suscriptor, mostrar modal de suscripción
        if (this.esFirstPublicacion && !this.esSuscriptor) {
          await this.mostrarModalSuscripcion();
        } else {
          // Mostrar mensaje normal
          const alert = await this.alertController.create({
            header: '¡Artículo publicado!',
            message: 'Tu artículo ha sido publicado exitosamente y está siendo revisado por nuestro equipo de administración. Recibirás una notificación cuando sea aprobado.',
            buttons: [
              {
                text: 'Entendido',
                handler: () => {
                  this.router.navigate(['/home']);
                }
              }
            ],
            backdropDismiss: false
          });
          await alert.present();
        }
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

  // Modal de invitación a suscripción
  async mostrarModalSuscripcion() {
    const alert = await this.alertController.create({
      header: '🎉 ¡Felicidades!',
      subHeader: 'Tu primer artículo fue publicado gratis',
      message: `Ya completaste tu publicación gratuita. Para subir más artículos, tienes dos opciones:
      
      📌 Esperar 24 horas para tu próxima publicación gratuita
      
      ⭐ O suscríbete ahora para publicar ilimitadamente`,
      buttons: [
        {
          text: 'Esperar 24h',
          role: 'cancel',
          handler: () => {
            this.router.navigate(['/home']);
          }
        },
        {
          text: 'Suscribirme Ahora',
          handler: () => {
            this.router.navigate(['/suscripcion']);
          }
        }
      ],
      backdropDismiss: false
    });
    await alert.present();
  }

  // Ir a suscripción
  irASuscripcion() {
    this.router.navigate(['/suscripcion']);
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
