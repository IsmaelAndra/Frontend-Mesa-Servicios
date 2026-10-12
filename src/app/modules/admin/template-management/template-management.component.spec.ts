import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';

import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { PaginatorComponent } from '../../shared/components/paginator/paginator.component';
import { MasterSelectComponent } from '../../shared/components/master-select/master-select.component';
import { TemplateManagementComponent } from './template-management.component';

/** Cuerpo con la misma forma que las plantillas de correo reales. */
const CUERPO = `<div style="background:#f3f4f6;padding:32px;">
  <table role="presentation" width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;">
    <tr><td align="center" style="background:#062e86;padding:28px;">
      <span style="color:#ffffff;font-size:22px;">Encabezado azul</span>
    </td></tr>
    <tr><td style="color:#1f2937;padding:24px;">Hola [nombre], su ticket #[id] esta en proceso.</td></tr>
  </table>
</div>`;

/**
 * AdminService mínimo. El componente pide getTemplates y getBranding al
 * iniciar, así que los dos tienen que existir. El subscribe devuelve un
 * observable que entrega `[]` tanto si le pasan una función suelta como un
 * observer con next(), que es como los llama el componente.
 */
const vacio = {
  subscribe(observador: ((v: unknown) => void) | { next: (v: unknown) => void }) {
    if (typeof observador === 'function') {
      observador([]);
    } else {
      observador.next([]);
    }
    return { unsubscribe: () => {} };
  }
};

function adminServiceStub(): unknown {
  return {
    getTemplates: () => vacio,
    getBranding: () => vacio
  };
}

describe('Vista previa de plantillas', () => {
  let fixture: ComponentFixture<TemplateManagementComponent>;
  let component: TemplateManagementComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TemplateManagementComponent, PaginatorComponent, MasterSelectComponent],
      imports: [CommonModule, FormsModule],
      providers: [
        { provide: AdminService, useValue: adminServiceStub() },
        { provide: ToastService, useValue: { success: () => {}, error: () => {}, warn: () => {} } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('previewHtml', () => {
    it('devuelve un documento completo', () => {
      const html = component.previewHtml(CUERPO);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
    });

    it('conserva los estilos en linea, que es lo que usan los correos', () => {
      const html = component.previewHtml(CUERPO);

      expect(html).toContain('background:#062e86');
      expect(html).toContain('max-width:620px');
      expect(html).toContain('color:#ffffff');
    });

    it('no reescribe la estructura de la tabla', () => {
      // Angular anade <tbody> a las tablas al sanear; aqui no debe pasar, porque
      // el HTML es el mismo que se manda por correo.
      const html = component.previewHtml(CUERPO);

      expect(html).toContain('<table role="presentation" width="620"');
      expect(html).not.toContain('<tbody>');
    });

    it('resuelve las variables', () => {
      const html = component.previewHtml(CUERPO);

      expect(html).toContain('Nombre Apellido');
      expect(html).toContain('#123');
      expect(html).not.toContain('[nombre]');
      expect(html).not.toContain('[id]');
    });

    it('[imagenUrl] se reemplaza por la imagen de la plantilla', () => {
      component.showNew = true;
      component.nuevoImageUrl = '/templates/image/abc123';

      const html = component.previewHtml('<img src="[imagenUrl]" />', '/templates/image/abc123');

      expect(html).toContain('src="/templates/image/abc123"');
      expect(html).not.toContain('[imagenUrl]');
    });

    it('la variable [imagen] ya no existe', () => {
      component.showNew = true;
      component.nuevoImageUrl = '/templates/image/abc123';

      const html = component.previewHtml('<p>[imagen]</p>', '/templates/image/abc123');

      // No se inserta ninguna etiqueta img: [imagen] dejo de ser una variable.
      // La red de seguridad del preview sustituye los marcadores sin resolver
      // por un texto de ejemplo, asi que no se comprueba el texto final.
      expect(html).not.toContain('<img');
      expect(html).not.toContain('[imagen]');
    });

    it('sin imagen el token de imagen queda vacio, no literal', () => {
      component.showNew = true;
      component.nuevoImageUrl = '';

      const html = component.previewHtml('<img src="[imagenUrl]" />', '/templates/image/abc123');

      expect(html).not.toContain('[imagenUrl]');
    });

    it('la lista de variables ofrece [imagenUrl] en todos los tipos', () => {
      for (const tipo of ['TICKET', 'RATING', 'SLA', 'EVAL', 'TASK', 'CUENTA']) {
        const variables = component.variablesDe(tipo);
        expect(variables).toContain('[imagenUrl]');
        expect(variables).not.toContain('[imagen]');
      }
    });

    it('la imagen se toma de la plantilla que se está enseñando', () => {
      // La imagen ya no se deduce del formulario abierto: cada vista previa pasa
      // la de la plantilla que enseña, así que nunca puede coger la de otra.
      component.editImageUrl = '/templates/image/editada';

      const html = component.previewHtml(
        '<img src="[imagenUrl]" />',
        component.editImageUrl,
      );

      expect(html).toContain('src="/templates/image/editada"');
    });
  });

  describe('previsualizacion con una plantilla que tiene imagen', () => {
    /**
     * Cuerpo con la forma real de las plantillas de correo: tabla de dos
     * columnas con la imagen a la izquierda, y el token dentro del src.
     */
    const CUERPO_CON_IMAGEN = `<div style="background:#f3f4f6;padding:32px;">
      <table role="presentation" width="620" cellpadding="0" cellspacing="0">
        <tr><td style="padding:36px 40px 20px;">
          <table role="presentation">
            <tr>
              <td width="180" valign="top" style="width:180px;padding:0;vertical-align:top;">
                <img src="[imagenUrl]" alt="Bienvenida" width="180" height="400"
                     style="display:block;width:100%;height:100%;border:0;object-fit:cover;" />
              </td>
              <td style="padding-left:24px;"><h1>Tu cuenta ha sido creada</h1>
                <p>Estimado/a <b>[nombre]</b>:</p></td>
            </tr>
          </table>
        </td></tr>
      </table>
    </div>`;

    const IMAGEN =
      'http://localhost:8080/api/templates/image/43da136ec1bd80a1024bb3cb5e1b9ce8';

    it('la vista previa entrega un <img> con la direccion de la imagen', () => {
      component.showEdit = true;
      component.showNew = false;
      component.editImageUrl = IMAGEN;

      const html = component.previewHtml(CUERPO_CON_IMAGEN, IMAGEN);

      expect(html).toContain('src="' + IMAGEN + '"');
      expect(html).not.toContain('[imagenUrl]');
    });

    /**
     * Lo que rompia la vista: el token se rellenaba, pero la imagen no se veia.
     * Se fija que la direccion que acaba en el <img> es exactamente la misma que
     * muestra la miniatura del formulario, para que una y otra no puedan
     * discrepar.
     */
    it('la direccion del preview es la misma que la miniatura del formulario', () => {
      component.showEdit = true;
      component.editImageUrl = IMAGEN;

      const html = component.previewHtml(CUERPO_CON_IMAGEN, IMAGEN);

      expect(html).toContain('src="' + component.editImageUrl + '"');
    });

    it('avisa del marcado que aplasta la imagen a cero alto', () => {
      const avisos = component.avisosDe(CUERPO_CON_IMAGEN);

      expect(avisos.some((a) => a.includes('height:100%'))).toBe(true);
      expect(avisos.some((a) => a.includes('object-fit'))).toBe(true);
    });

    it('el boton inserta un markup que no dispara ninguno de esos avisos', () => {
      const avisos = component.avisosDe(component.markupImagenSeguro);

      expect(avisos).toEqual([]);
      expect(component.markupImagenSeguro).toContain('[imagenUrl]');
      expect(component.markupImagenSeguro).toContain('height:auto');
    });

    /**
     * Este es el fallo que se dio: la imagen salia en la miniatura del formulario
     * de edicion, pero no en la vista previa de la fila de la lista. La causa es
     * que la imagen se adivinaba a partir del formulario abierto, y desde la
     * lista no hay ninguno abierto, así que el token se rellenaba con nada.
     */
    it('la vista previa de la lista muestra la imagen sin abrir el formulario', () => {
      component.showEdit = false;
      component.showNew = false;
      component.editImageUrl = '';

      const html = component.previewHtml(CUERPO_CON_IMAGEN, IMAGEN);

      expect(html).toContain('src="' + IMAGEN + '"');
      expect(html).not.toContain('[imagenUrl]');
    });

    it('la vista previa usa la imagen de la plantilla que se esta enseñando', () => {
      component.showEdit = false;
      component.showNew = false;

      const otra = 'http://localhost:8080/api/templates/image/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const html = component.previewHtml(CUERPO_CON_IMAGEN, otra);

      expect(html).toContain('src="' + otra + '"');
    });

    it('sin imagen el token no se convierte en la de otra plantilla', () => {
      component.showEdit = false;

      const html = component.previewHtml(CUERPO_CON_IMAGEN, '');

      expect(html).not.toContain('[imagenUrl]');
      expect(html).not.toContain('src="http');
    });
  });

  describe('avisos del HTML de la plantilla', () => {
    it('avisa si se usa [imagen], que ya no existe', () => {
      const avisos = component.avisosDe('<img src="[imagen]" />');

      expect(avisos.some((a) => a.includes('[imagen]'))).toBe(true);
    });

    it('avisa de height:100%, que aplasta la imagen a cero alto', () => {
      const avisos = component.avisosDe(
        '<td><img src="[imagenUrl]" style="width:100%;height:100%" /></td>',
      );

      expect(avisos.some((a) => a.includes('height:100%'))).toBe(true);
    });

    it('avisa de object-fit, que Outlook no soporta', () => {
      const avisos = component.avisosDe(
        '<img src="[imagenUrl]" style="object-fit:cover" />',
      );

      expect(avisos.some((a) => a.includes('object-fit'))).toBe(true);
    });

    it('avisa si el token está suelto y no dentro de una etiqueta img', () => {
      const avisos = component.avisosDe('<p>imagen: [imagenUrl]</p>');

      expect(avisos.some((a) => a.includes('no dentro de una etiqueta'))).toBe(true);
    });

    it('no avisa de un cuerpo correcto', () => {
      expect(
        component.avisosDe('<img src="[imagenUrl]" width="600" style="max-width:100%;height:auto" />'),
      ).toEqual([]);
    });

    it('no avisa de un cuerpo sin imagen', () => {
      expect(component.avisosDe('<p>Hola [nombre]</p>')).toEqual([]);
    });
  });

  describe('el visor de plantillas', () => {
    const plantilla = {
      idTemplate: 7,
      nameTemplate: 'TICKET_CREADO',
      typeTemplate: 'TICKET',
      subjectTemplate: 'Tu ticket fue creado',
      bodyTemplate: '<img src="[imagenUrl]" /><p>Hola [nombre]</p>',
      activeTemplate: true,
      imageUrl: '/templates/image/propia',
    };

    it('guarda el cuerpo sin resolver, para que lo resuelva el visor una sola vez', () => {
      component.viewerFullScreen = true;

      component.abrirVisor(plantilla as never);

      expect(component.viewerTemplate).not.toBeNull();
      // Si se resolviera aquí, al pasar por safePreviewHtml se volvería a
      // resolver y los marcadores ya no existirían para nada.
      expect(component.viewerTemplate!.bodyTemplate).toContain('[imagenUrl]');
      expect(component.viewerTemplate!.imageUrl).toBe('/templates/image/propia');
      // Abrir el visor siempre empieza en modo panel, no en pantalla completa.
      expect(component.viewerFullScreen).toBe(false);
    });

    it('el visor pinta la imagen de la plantilla que se abre', () => {
      component.abrirVisor(plantilla as never);
      const t = component.viewerTemplate!;

      const html = component.previewHtml(t.bodyTemplate || '', t.imageUrl || '');

      expect(html).toContain('src="/templates/image/propia"');
      expect(html).not.toContain('[imagenUrl]');
    });

    it('cerrar el visor lo limpia', () => {
      component.abrirVisor(plantilla as never);
      component.cerrarVisor();

      expect(component.viewerTemplate).toBeNull();
    });

    it('no toca la plantilla original al resolver el cuerpo', () => {
      component.abrirVisor(plantilla as never);

      expect(plantilla.bodyTemplate).toContain('[imagenUrl]');
    });
  });

  describe('saneado', () => {
    it('quita los script', () => {
      const html = component.previewHtml('<p>texto</p><script>alert(1)</script>');

      expect(html).not.toContain('<script');
      expect(html).not.toContain('alert(1)');
      expect(html).toContain('texto');
    });

    it('quita los manejadores de evento en linea', () => {
      const html = component.previewHtml('<img src="x" onerror="alert(1)">');

      expect(html).not.toContain('onerror');
    });

    it('neutraliza las URLs javascript', () => {
      const html = component.previewHtml('<a href="javascript:alert(1)">ver</a>');

      expect(html).not.toContain('javascript:');
      expect(html).toContain('href="#"');
    });

    it('impide cerrar el atributo src desde dentro de la URL', () => {
      const html = component.previewHtml('<img src="a&quot; onerror=&quot;alert(1)">');

      expect(html).not.toMatch(/onerror\s*=/i);
    });
  });

  describe('safePreviewHtml', () => {
    it('devuelve el mismo objeto mientras el cuerpo no cambie', () => {
      // Si devolviera un objeto nuevo, [srcdoc] reescribiria el atributo en cada
      // ciclo de deteccion y el iframe se recargaria solo, con parpadeo.
      const a = component.safePreviewHtml(CUERPO);
      const b = component.safePreviewHtml(CUERPO);

      expect(a).toBe(b);
    });

    it('devuelve un objeto distinto cuando el cuerpo cambia', () => {
      const a = component.safePreviewHtml(CUERPO);
      const b = component.safePreviewHtml(CUERPO + '<p>nuevo</p>');

      expect(a).not.toBe(b);
    });

it('devuelve un objeto distinto cuando cambia la imagen de la plantilla', () => {
        const antes = component.safePreviewHtml(CUERPO, '');

        expect(
          component.safePreviewHtml(CUERPO, '/templates/image/nueva.png'),
        ).not.toBe(antes);
      });
  });

  describe('el iframe de la plantilla', () => {
    /** Monta la pantalla de edicion, que es donde esta el preview. */
    function abrirEditor(): HTMLIFrameElement {
      component.showNew = true;
      component.newTemplate = {
        nameTemplate: 'PRUEBA',
        typeTemplate: 'TICKET',
        subjectTemplate: 'asunto',
        bodyTemplate: CUERPO
      };
      fixture.detectChanges();
      return fixture.nativeElement.querySelector('iframe');
    }

    it('lleva sandbox como atributo estatico', () => {
      // Si se quita el sandbox, el bypassSecurityTrust de safePreviewHtml pasa
      // a ser el unico freno y el preview puede ejecutar script.
      const iframe = abrirEditor();

      expect(iframe.hasAttribute('sandbox')).toBe(true);
      // Sin allow-scripts, que es lo que haria ejecutable el documento.
      expect(iframe.getAttribute('sandbox')).not.toContain('allow-scripts');
    });

    it('el srcdoc conserva los estilos en linea', () => {
      const iframe = abrirEditor();
      const srcdoc = iframe.getAttribute('srcdoc') ?? '';

      expect(srcdoc).toContain('background:#062e86');
      expect(srcdoc).toContain('max-width:620px');
    });

    it('el documento lleva los estilos, no solo el texto', () => {
      const iframe = abrirEditor();
      const srcdoc = iframe.getAttribute('srcdoc') ?? '';

      // No se puede mirar el DOM renderizado: con sandbox sin allow-same-origin
      // el iframe tiene origen opaco y contentDocument queda en null desde
      // fuera. Por eso se comprueba el srcdoc, que es lo que el navegador recibe.
      expect(srcdoc).toContain('Encabezado azul');
      expect(srcdoc).toContain('background:#062e86');
      expect(srcdoc).toContain('padding:28px');
    });

    it('el script inyectado no llega al preview', () => {
      // Se comprueba sobre el HTML que se genera, que es lo que recibe el
      // iframe: su contenido no se puede leer desde fuera por el sandbox.
      const html = component.safePreviewHtml('<p>ok</p><script>window.__invadido = true;</script>')
        .toString();

      expect(html).not.toContain('<script');
      expect(html).not.toContain('__invadido');
      expect(html).toContain('ok');
    });
  });
});
