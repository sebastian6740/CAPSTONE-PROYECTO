import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { DetalleUsuarioModalComponent } from './detalle-usuario-modal.component';

describe('DetalleUsuarioModalComponent', () => {
  let component: DetalleUsuarioModalComponent;
  let fixture: ComponentFixture<DetalleUsuarioModalComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [DetalleUsuarioModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DetalleUsuarioModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
