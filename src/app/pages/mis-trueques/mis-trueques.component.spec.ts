import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { MisTruequesComponent } from './mis-trueques.component';

describe('MisTruequesComponent', () => {
  let component: MisTruequesComponent;
  let fixture: ComponentFixture<MisTruequesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [MisTruequesComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MisTruequesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
