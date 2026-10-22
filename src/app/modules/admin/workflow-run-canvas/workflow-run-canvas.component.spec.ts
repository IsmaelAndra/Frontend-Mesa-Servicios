import { WorkflowGraph, WorkflowNodeType } from '../../../models/workflow.model';
import { WorkflowRunCanvasComponent } from './workflow-run-canvas.component';

/**
 * El lienzo es un componente standalone sin Servicios (solo NgZone), asi que se
 * instancia directo y se le alimenta el grafo por la signal. Este spec fija el
 * contrato nuevo: cada conector nace con el color del nodo de origen.
 */
function comp(): WorkflowRunCanvasComponent {
  return new WorkflowRunCanvasComponent(undefined as never);
}

function grafo(nodos: Array<[string, WorkflowNodeType, number, number]>, edges: Array<[string, string]>): WorkflowGraph {
  return {
    name: 'Prueba',
    nodes: nodos.map(([id, type, positionX, positionY]) => ({ id, type, name: type, positionX, positionY, config: {} })),
    edges: edges.map(([from, to]) => ({ from, to, sourcePort: 'NEXT' })),
    variables: {},
  };
}

describe('WorkflowRunCanvasComponent', () => {
  it('pinta el conector con el color del nodo de origen en cadenas simples', () => {
    const c = comp();
    c.grafoS.set(grafo(
      [['inicio', 'INICIO', 0, 0], ['mapi', 'MAPI', 0, 200]],
      [['inicio', 'mapi']],
    ));

    const lineas = c.lineas();
    expect(lineas).toHaveSize(1);
    expect(lineas[0].color).toBe('#16a34a');
  });

  it('cada conector hereda el color de su propio origen (INICIO verde, MAPI morado)', () => {
    const c = comp();
    c.grafoS.set(grafo(
      [['inicio', 'INICIO', 0, 0], ['mapi', 'MAPI', 0, 200], ['correo', 'EMAIL', 0, 400]],
      [['inicio', 'mapi'], ['mapi', 'correo']],
    ));

    const lineas = c.lineas();
    expect(lineas.map((l) => l.color)).toEqual(['#16a34a', '#9333ea']);
  });

  it('genera un marcador de punta por cada color distinto', () => {
    const c = comp();
    c.grafoS.set(grafo(
      [['inicio', 'INICIO', 0, 0], ['mapi', 'MAPI', 0, 200], ['correo', 'EMAIL', 0, 400]],
      [['inicio', 'mapi'], ['mapi', 'correo']],
    ));

    const marcas = c.marcasLineas();
    expect(marcas.map((m) => m.id)).toEqual(['16a34a', '9333ea']);
  });

  it('los tipos sin color propio usan el azul por defecto', () => {
    const c = comp();
    c.grafoS.set(grafo(
      [['raro', 'OTRO_TIPO' as WorkflowNodeType, 0, 0], ['fin', 'FIN', 0, 200]],
      [['raro', 'fin']],
    ));

    expect(c.lineas()[0].color).toBe('#2563eb');
    expect(c.idColor('#16a34a')).toBe('16a34a');
  });

  it('contraste elige texto legible sobre el color del conector', () => {
    const c = comp();
    // Sobre el ambar y el verde el blanco no llega a 4,5:1 → tinta oscura.
    expect(c.contraste('#d97706')).toBe('#0f172a');
    expect(c.contraste('#16a34a')).toBe('#0f172a');
    // El morado es suficientemente oscuro para texto blanco.
    expect(c.contraste('#9333ea')).toBe('#ffffff');
    expect(c.contraste('#000000')).toBe('#ffffff');
  });
});