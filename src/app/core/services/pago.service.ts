import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { SuscripcionService } from './suscripcion.service';

export interface PagoRequest {
  planId: string;
  email: string;
  token: string;
}

export interface PagoResponse {
  success: boolean;
  message: string;
  transactionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PagoService {

  private stripe: Stripe | null = null;
  private publicKey = 'pk_test_51SZlIvI9ifOWb5cYcYIzguDs4Rpzjjx8QYRkl0iqXtjuoWSWhjJirVHb6NhYUP9ELQRnxJGdJHtrUfwlXniDDz7200gc3p6aP3';

  constructor(
    private http: HttpClient,
    private suscripcionService: SuscripcionService
  ) {
    this.inicializarStripe();
  }

  // Inicializar Stripe
  private async inicializarStripe() {
    this.stripe = await loadStripe(this.publicKey);
    console.log('Stripe inicializado');
  }

  // Procesar pago con Stripe
  async procesarPagoConStripe(planId: string, email: string): Promise<PagoResponse> {
    try {
      if (!this.stripe) {
        await this.inicializarStripe();
      }

      // Obtener plan
      const plan = this.obtenerPlanDetalle(planId);
      if (!plan) {
        return { success: false, message: 'Plan no encontrado' };
      }

      // Para demo, usar pago simulado
      // En producción, aquí irías a tu backend para crear sesión de checkout
      return await this.procesarPagoTest(planId);

    } catch (error) {
      console.error('Error al procesar pago con Stripe:', error);
      return {
        success: false,
        message: 'Error al procesar el pago'
      };
    }
  }

  // Para modo TEST sin backend real
  async procesarPagoTest(planId: string): Promise<PagoResponse> {
    try {
      // Simulamos un pago exitoso después de 2 segundos
      await new Promise(resolve => setTimeout(resolve, 2000));

      const plan = planId as 'premium' | 'pro';
      await this.suscripcionService.crearSuscripcion(plan);

      return {
        success: true,
        message: 'Pago procesado correctamente en modo TEST',
        transactionId: 'TEST_' + Date.now()
      };
    } catch (error) {
      console.error('Error en pago test:', error);
      return {
        success: false,
        message: 'Error al procesar el pago de prueba'
      };
    }
  }

  // Obtener detalles del plan
  obtenerPlanDetalle(planId: string) {
    const planes = this.obtenerPlanes();
    return planes.find(p => p.id === planId);
  }

  // Obtener planes disponibles
  obtenerPlanes() {
    return [
      {
        id: 'premium',
        nombre: 'Premium',
        precio: 4990,
        precioEnCentavos: 4990,
        moneda: 'clp',
        simbolo: '$',
        duracion: '30 días',
        beneficios: [
          'Publicar ilimitadamente',
          'Sin límite de 24h',
          'Soporte prioritario',
          'Estadísticas básicas'
        ],
        stripePriceId: 'price_1SZlIvI9ifOWb5cYexample1'
      },
      {
        id: 'pro',
        nombre: 'Pro',
        precio: 39990,
        precioEnCentavos: 39990,
        moneda: 'clp',
        simbolo: '$',
        duracion: '1 año',
        beneficios: [
          'Publicar ilimitadamente',
          'Sin límite de 24h',
          'Soporte prioritario',
          'Estadísticas avanzadas',
          'Insignia exclusiva',
          'Promoción especial'
        ],
        stripePriceId: 'price_1SZlIvI9ifOWb5cYexample2'
      }
    ];
  }

  // Obtener clave pública de Stripe
  obtenerPublicKey(): string {
    return this.publicKey;
  }

}
