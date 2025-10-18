import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Trueque {
  id: number;
  nombre: string;
  categoria: string;
  cambio: string;
  ciudad: string;
  emoji: string;
  color: string;
}

@Injectable({
  providedIn: 'root'
})
export class TruequeService {
  private trueques$ = new BehaviorSubject<Trueque[]>([
    {
      id: 1,
      nombre: 'Audífonos',
      categoria: 'Electrónica',
      cambio: 'Cambio por mochila',
      ciudad: 'Santiago',
      emoji: '🎧',
      color: 'bg-yellow-100'
    },
    {
      id: 2,
      nombre: 'Mochila',
      categoria: 'Accesorios',
      cambio: 'Cambio por libro',
      ciudad: 'Viña del Mar',
      emoji: '🎒',
      color: 'bg-blue-100'
    },
    {
      id: 3,
      nombre: 'Libro',
      categoria: 'Educación',
      cambio: 'Cambio por silla',
      ciudad: 'Santiago',
      emoji: '📚',
      color: 'bg-yellow-50'
    },
    {
      id: 4,
      nombre: 'Silla',
      categoria: 'Muebles',
      cambio: 'Cambio por tablet',
      ciudad: 'Santiago',
      emoji: '🪑',
      color: 'bg-orange-100'
    }
  ]);

  constructor() {}

  getTrueques(): Observable<Trueque[]> {
    return this.trueques$.asObservable();
  }

  agregarTrueque(trueque: Trueque) {
    const actuales = this.trueques$.value;
    this.trueques$.next([...actuales, trueque]);
  }
}