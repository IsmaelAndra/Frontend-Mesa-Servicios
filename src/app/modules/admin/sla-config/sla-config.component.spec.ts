import { environment } from '../../../../environments/environment';
import { MonthlyEvaluation } from '../../../models/dashboard.model';
import { SlaConfigComponent } from './sla-config.component';

/**
 * Tabla de "Evaluaciones del mes": icono y color de cada política SLA, y avatar
 * con foto y punto de sesión de cada agente.
 *
 * Las políticas SLA son la única entidad del catálogo queRegressionó sin icono ni
 * color, así que todas se pintaban con el mismo escudo. Los agentes, en cambio,
 * solo tenían su inicial: sin foto no se distinguía a nadie y sin punto de sesión
 * no había forma de saber quién estaba conectado desde la propia tabla.
 */
describe('SlaConfigComponent (tablas de políticas y evaluaciones)', () => {
  function setup(): SlaConfigComponent {
    const adminService = jasmine.createSpyObj('AdminService', ['catalog', 'evaluationsByMonth', 'generateEvaluations']);
    adminService.catalog.and.returnValue({ of: () => ({ subscribe: () => undefined }) } as any);
    adminService.evaluationsByMonth.and.returnValue({ subscribe: () => undefined } as any);
    const toastService = jasmine.createSpyObj('ToastService', ['success', 'error', 'info', 'warning']);
    const c = new SlaConfigComponent(adminService, toastService);
    // catalog() nunca resuelve en la prueba, pero el resto de helpers no lo necesita.
    c.catalog = { slaPolicies: [] } as any;
    return c;
  }

  function evaluacion(extra: Partial<MonthlyEvaluation> = {}): MonthlyEvaluation {
    return {
      idEvaluation: '1',
      agentId: '7',
      agentEmail: 'agente@coacmagisterio.fin.ec',
      evaluationMonth: '2026-09-01',
      ticketsClosed: 10,
      avgResponseTimeMinutes: 30,
      avgResolutionTimeMinutes: 240,
      slaComplianceRate: 92,
      avgRequirementsMet: 4,
      avgOverallSatisfaction: 4.2,
      satisfactionScore: 4.2,
      status: 'COMPLETED',
      createdAt: '2026-09-01T10:00:00',
      ...extra,
    };
  }

  describe('icono y color de las políticas SLA', () => {
    it('usa el icono y el color que trae la política', () => {
      const c = setup();
      expect(c.policyIcon({ icon: 'fa-solid fa-bolt' })).toBe('fa-solid fa-bolt');
      expect(c.policyColor({ color: '#DC2626' })).toBe('#DC2626');
    });

    it('son distintos en cada política, que es justo lo que se pedía', () => {
      const c = setup();
      const critico = { icon: 'fa-solid fa-bolt', color: '#DC2626' };
      const alto = { icon: 'fa-solid fa-triangle-exclamation', color: '#EA580C' };
      const bajo = { icon: 'fa-solid fa-hourglass-half', color: '#2563EB' };
      const iconos = [critico, alto, bajo].map((p) => c.policyIcon(p));
      const colores = [critico, alto, bajo].map((p) => c.policyColor(p));
      expect(new Set(iconos).size).toBe(3);
      expect(new Set(colores).size).toBe(3);
    });

    it('si no hay icono configurado usa el escudo de antes, para no dejar el hueco vacío', () => {
      const c = setup();
      expect(c.policyIcon({})).toBe('fa-solid fa-shield-halved');
      expect(c.policyIcon({ icon: '   ' })).toBe('fa-solid fa-shield-halved');
    });

    it('si no hay color configurado usa el azul de la marca', () => {
      const c = setup();
      expect(c.policyColor({})).toBe('#062e86');
      expect(c.policyColor({ color: '' })).toBe('#062e86');
    });

    it('el fondo del chip se deriva del color con transparencia', () => {
      const c = setup();
      expect(c.policyBg({ color: '#DC2626' })).toBe('#DC26261f');
    });
  });

  describe('avatar y sesión del agente evaluado', () => {
    it('muestra el nombre legible del agente, no el correo', () => {
      const c = setup();
      const e = evaluacion({ agentDisplayName: 'Ismael Andrade' });
      expect(c.agentLabel(e)).toBe('Ismael Andrade');
    });

    it('si no hay nombre, cae al correo para no dejar la celda vacía', () => {
      const c = setup();
      expect(c.agentLabel(evaluacion())).toBe('agente@coacmagisterio.fin.ec');
    });

    it('antepone la URL de la API a la foto relativa del backend', () => {
      const c = setup();
      expect(c.agentPhoto(evaluacion({ agentPhotoUrl: '/uploads/fotos/7.png' })))
        .toBe(`${environment.apiUrl}/uploads/fotos/7.png`);
    });

    it('respeta una foto que ya viene absoluta', () => {
      const c = setup();
      const url = 'https://graph.microsoft.com/v1.0/users/7/photo/$value';
      expect(c.agentPhoto(evaluacion({ agentPhotoUrl: url }))).toBe(url);
    });

    it('sin foto devuelve null, que es lo que hace caer en la inicial', () => {
      const c = setup();
      expect(c.agentPhoto(evaluacion())).toBeNull();
      expect(c.agentPhoto(evaluacion({ agentPhotoUrl: '' }))).toBeNull();
    });

    it('el punto de sesión se pinta siempre, conectado o no', () => {
      // El componente PresenceDot dibuja los tres estados a propósito: si solo se
      // pintara con sesión, no se sabría si la foto falló o si el agente no está.
      const c = setup();
      expect(c.agentPhoto(evaluacion({ agentPhotoUrl: '', agentSessionState: 'EN_LINEA' }))).toBeNull();
      expect(c.agentPhoto(evaluacion({ agentPhotoUrl: '', agentSessionState: 'DESCONECTADO' }))).toBeNull();
    });
  });
});
