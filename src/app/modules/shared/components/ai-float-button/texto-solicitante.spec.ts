import { textoParaSolicitante } from './ai-float-button.component';

describe('textoParaSolicitante ("Usar esta respuesta" de MAPI)', () => {
  it('toma solo la sección "Respuesta al solicitante" y quita el Markdown', () => {
    const md = [
      '### Diagnóstico para el agente',
      'Revise el bloqueo en Exchange.',
      '### Respuesta al solicitante',
      'Estimado usuario, su **contraseña** fue bloqueada.',
      '- Ingrese al portal',
      '- Pulse *Olvidé mi contraseña*',
      '### Siguientes pasos internos',
      'Escalar a TI.',
    ].join('\n');
    const texto = textoParaSolicitante(md);
    expect(texto).toContain('Estimado usuario, su contraseña fue bloqueada.');
    expect(texto).toContain('• Ingrese al portal');
    expect(texto).toContain('• Pulse Olvidé mi contraseña');
    expect(texto).not.toContain('Exchange');
    expect(texto).not.toContain('Escalar');
  });

  it('sin sección usa todo el texto y descarta la nota final del borrador', () => {
    const texto = textoParaSolicitante('Reinicie el equipo.\n\n_(Es un borrador: todavía no se ha creado ningún ticket.)_');
    expect(texto).toBe('Reinicie el equipo.');
  });
});
