import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DropzoneComponent } from './dropzone.component';

describe('DropzoneComponent', () => {
  let fixture: ComponentFixture<DropzoneComponent>;
  let comp: DropzoneComponent;

  const archivo = (nombre: string, tipo = '') => new File(['x'], nombre, { type: tipo });

  /** Evento drop con los archivos dados (DataTransfer real del navegador). */
  const soltar = (archivos: File[]): DragEvent => {
    const dt = new DataTransfer();
    archivos.forEach(f => dt.items.add(f));
    return new DragEvent('drop', { dataTransfer: dt, cancelable: true });
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ declarations: [DropzoneComponent] });
    fixture = TestBed.createComponent(DropzoneComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('acepta por extensión, por tipo MIME y por comodín', () => {
    comp.accept = '.pdf, image/*, text/csv';
    expect(comp.cumpleAccept(archivo('informe.PDF'))).toBeTrue();
    expect(comp.cumpleAccept(archivo('foto.png', 'image/png'))).toBeTrue();
    expect(comp.cumpleAccept(archivo('datos.csv', 'text/csv'))).toBeTrue();
    expect(comp.cumpleAccept(archivo('virus.exe', 'application/x-msdownload'))).toBeFalse();
  });

  it('sin accept, acepta cualquier archivo', () => {
    comp.accept = '';
    expect(comp.cumpleAccept(archivo('lo-que-sea.bin'))).toBeTrue();
  });

  it('al soltar, entrega los válidos y avisa de los rechazados', () => {
    comp.accept = '.pdf,.png';
    comp.multiple = true;
    let entregados: File[] = [];
    let rechazados: string[] = [];
    comp.archivos.subscribe(a => (entregados = a));
    comp.rechazados.subscribe(r => (rechazados = r));

    comp.alSoltar(soltar([archivo('a.pdf'), archivo('b.exe'), archivo('c.png')]));

    expect(entregados.map(f => f.name)).toEqual(['a.pdf', 'c.png']);
    expect(rechazados).toEqual(['b.exe']);
  });

  it('sin multiple, solo entrega el primer archivo soltado', () => {
    let entregados: File[] = [];
    comp.archivos.subscribe(a => (entregados = a));
    comp.alSoltar(soltar([archivo('uno.png'), archivo('dos.png')]));
    expect(entregados.map(f => f.name)).toEqual(['uno.png']);
  });

  it('emite también un evento con forma de change para los manejadores antiguos', () => {
    let evento: Event | undefined;
    comp.cambio.subscribe(e => (evento = e));
    comp.alSoltar(soltar([archivo('logo.png', 'image/png')]));
    const input = evento!.target as HTMLInputElement;
    expect(input.files?.[0]?.name).toBe('logo.png');
  });

  it('deshabilitada no entrega nada', () => {
    comp.disabled = true;
    const espia = jasmine.createSpy('archivos');
    comp.archivos.subscribe(espia);
    comp.alSoltar(soltar([archivo('a.png')]));
    expect(espia).not.toHaveBeenCalled();
  });
});
