import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular'; // Importar IonicModule
import { AppComponent } from './app.component';


@NgModule({
  declarations: [
    AppComponent, // Declarar el componente raíz
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(), // Asegúrate de incluir IonicModule aquí
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}