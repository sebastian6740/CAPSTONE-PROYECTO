import { TestBed } from '@angular/core/testing';

import { Articulos } from './articulos';

describe('Articulos', () => {
  let service: Articulos;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Articulos);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
