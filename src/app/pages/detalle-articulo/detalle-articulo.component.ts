import { Component, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { ArticulosService, Articulo } from '../../core/services/articulos';
import { AuthService } from '../../core/services/auth.service';
import { MensajesService } from '../../core/services/mensajes.service';
import { Usuario } from '../../core/models/user.model';
import { register } from 'swiper/element/bundle';

register();

@Component({
  selector: 'app-detalle-articulo',
  standalone: true,
  templateUrl: './detalle-articulo.component.html',
  styleUrls: ['./detalle-articulo.component.scss'],
  imports: [CommonModule, IonicModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class DetalleArticuloComponent implements OnInit {

  articulo?: Articulo;
  propietario?: Usuario;
  usuarioActual?: Usuario | null;
  esMiArticulo: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private modalController: ModalController,
    private articulosService: ArticulosService,
    private authService: AuthService,
    private mensajesService: MensajesService
  ) {}

  ngOnInit() {
    this.usuarioActual = this.authService.getUsuarioActualSync();

    // Obtener el ID del artículo desde la ruta
    const articuloId = this.route.snapshot.paramMap.get('id');

    if (articuloId) {
      this.cargarArticulo(articuloId);
    }
  }

  cargarArticulo(id: string) {
    // Obtener todos los artículos y encontrar el específico
    this.articulosService.articulos$.subscribe(articulos => {
      this.articulo = articulos.find(art => art.id === id);

      if (this.articulo) {
        // Verificar si es mi artículo
        this.esMiArticulo = this.articulo.usuarioId === this.usuarioActual?.id;

        // Cargar información del propietario
        if (this.articulo.usuarioId) {
          const usuarios = this.authService.obtenerTodosUsuarios();
          this.propietario = usuarios.find(u => u.id === this.articulo?.usuarioId);
        }
      }
    });
  }

  contactarPropietario() {
    if (!this.articulo || !this.articulo.usuarioId) {
      console.error('No se puede contactar: artículo sin propietario');
      return;
    }

    if (this.esMiArticulo) {
      console.log('No puedes contactarte a ti mismo');
      return;
    }

    try {
      // Crear o obtener conversación con contexto del artículo
      const conversacion = this.mensajesService.obtenerOCrearConversacion(
        this.articulo.usuarioId,
        {
          id: this.articulo.id || '',
          nombre: this.articulo.nombre,
          foto: this.articulo.fotos.length > 0 ? this.articulo.fotos[0] : undefined
        }
      );

      // Navegar al chat
      this.router.navigate(['/chat', conversacion.id]);
    } catch (error) {
      console.error('Error al crear conversación:', error);
    }
  }

  volver() {
    this.router.navigate(['/home']);
  }

  cerrarModal() {
    this.modalController.dismiss();
  }
}
