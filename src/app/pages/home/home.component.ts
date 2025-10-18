import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [IonicModule, CommonModule],
})
export class HomeComponent {

  // 🔹 Lista simulada de trueques
  trueques = [
  {
    id: 1,
    titulo: 'Intercambio de libros',
    descripcion: 'Busco novelas y ofrezco cómics.',
    color: 'color-azul',
    emoji: '📚',
    nombre: 'Libros y Cómics',
    cambio: 'Cambio novelas por cómics',
    ciudad: 'Santiago'
  },
  {
    id: 2,
    titulo: 'Cambio de videojuegos',
    descripcion: 'Intercambio juegos de PS4 por Switch.',
    color: 'color-verde',
    emoji: '🎮',
    nombre: 'Videojuegos PS4 y Switch',
    cambio: 'Cambio PS4 ⇄ Switch',
    ciudad: 'Valparaíso'
  },
  {
    id: 3,
    titulo: 'Ropa vintage',
    descripcion: 'Ofrezco chaquetas antiguas por sneakers.',
    color: 'color-rojo',
    emoji: '👕',
    nombre: 'Ropa vintage',
    cambio: 'Chaquetas por zapatillas',
    ciudad: 'Concepción'
  }
];


  // 🔹 Pestaña activa
  tabActiva: string = 'home';

  constructor(private router: Router) {}

  // 🔹 Mostrar detalle
  verDetalle(trueque: any) {
    console.log('Ver detalle de:', trueque);
  }

  // 🔹 Ir a crear un nuevo trueque
  irACrearTrueque() {
    console.log('Ir a crear trueque');
    this.router.navigate(['/crear-trueque']);
  }

  cambiarTab(tab: string) {
  this.tabActiva = tab;
  if (tab === 'messages') {
    this.router.navigate(['/mensajes']);
  } else if (tab === 'perfil') {
    this.router.navigate(['/perfil']);
  }}

  
}
