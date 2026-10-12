import {
  DEFAULT_LOADING_IMAGE_SIZE,
  DEFAULT_LOADING_MIN_DURATION_MS,
  LOADING_LOGO_EFFECTS,
  MAX_LOADING_IMAGE_SIZE,
  MAX_LOADING_MIN_DURATION_MS,
  MIN_LOADING_IMAGE_SIZE,
  clampDuration,
  clampSize,
  loadingLogoEffectClass,
  resolveLoadingScreen,
} from './loading-screen.util';
import { BrandingConfig } from '../services/admin.service';

const TITULO = 'Mesa de Servicios COAC';

describe('resolveLoadingScreen', () => {
  it('sin configuracion usa el icono del sistema y el color primario de fondo', () => {
    const vista = resolveLoadingScreen({ primaryColor: '#0f172a' }, TITULO);

    expect(vista.mode).toBe('AUTO');
    expect(vista.backgroundColor).toBe('#0f172a');
    // Sobre un fondo oscuro el texto tiene que salir claro.
    expect(vista.textColor).toBe('#ffffff');
    expect(vista.imageUrl).toBe('assets/icons/favicon-app.png');
    expect(vista.title).toBe(TITULO);
    expect(vista.message).toBe('Cargando...');
    expect(vista.animation).toBe('SPINNER');
    expect(vista.theme).toBe('LIGHT');
    expect(vista.progress).toBe(false);
    expect(vista.minDurationMs).toBe(DEFAULT_LOADING_MIN_DURATION_MS);
    expect(vista.soloMarca).toBe(false);
    expect(vista.showTexts).toBe(true);
  });

  it('con branding ausente o vacio no rompe y cae al azul de la marca', () => {
    expect(resolveLoadingScreen(null, TITULO).backgroundColor).toBe('#062e86');
    expect(resolveLoadingScreen(undefined, TITULO).backgroundColor).toBe('#062e86');
    expect(resolveLoadingScreen({}, TITULO).backgroundColor).toBe('#062e86');
    expect(resolveLoadingScreen({ primaryColor: 'no-es-un-color' }, TITULO).backgroundColor)
      .toBe('#062e86');
  });

  it('en modo IMAGE usa la imagen subida', () => {
    const vista = resolveLoadingScreen(
      {
        loadingMode: 'IMAGE',
        loadingImageUrl: '/uploads/publico/loading_1.png',
      },
      TITULO,
    );

    expect(vista.mode).toBe('IMAGE');
    expect(vista.imageUrl).toBe('/uploads/publico/loading_1.png');
  });

  it('en modo ICON deja la imagen en el icono del sistema y guarda la clase', () => {
    const vista = resolveLoadingScreen(
      { loadingMode: 'ICON', loadingIcon: 'fa-solid fa-headset' },
      TITULO,
    );

    expect(vista.mode).toBe('ICON');
    expect(vista.icon).toBe('fa-solid fa-headset');
    expect(vista.imageUrl).toBe('assets/icons/favicon-app.png');
  });

  it('si el modo pide una imagen o icono que no existen vuelve a AUTO', () => {
    // Sin esto el splash se quedaria en blanco con el modo equivocado.
    const sinImagen = resolveLoadingScreen({ loadingMode: 'IMAGE' }, TITULO);
    expect(sinImagen.mode).toBe('AUTO');
    expect(sinImagen.imageUrl).toBe('assets/icons/favicon-app.png');

    const sinIcono = resolveLoadingScreen({ loadingMode: 'ICON' }, TITULO);
    expect(sinIcono.mode).toBe('AUTO');
  });

  it('acepta los modos en minusculas y descarta los inventados', () => {
    // La imagen acompaña al modo: sin ella, IMAGE cae a AUTO (ver más abajo).
    expect(
      resolveLoadingScreen(
        { loadingMode: 'image' as BrandingConfig['loadingMode'], loadingImageUrl: '/uploads/publico/l.png' },
        TITULO,
      ).mode,
    ).toBe('IMAGE');
    expect(resolveLoadingScreen({ loadingMode: 'video' as BrandingConfig['loadingMode'] }, TITULO).mode)
      .toBe('AUTO');
    expect(resolveLoadingScreen({ loadingAnimation: 'dots' as BrandingConfig['loadingAnimation'] }, TITULO).animation)
      .toBe('DOTS');
    expect(resolveLoadingScreen({ loadingAnimation: 'BOUNCING' as BrandingConfig['loadingAnimation'] }, TITULO).animation)
      .toBe('SPINNER');
  });

  it('el texto personalizado gana, y un texto en blanco se ignora', () => {
    const vista = resolveLoadingScreen(
      {
        loadingTitle: '  Bienvenido  ',
        loadingMessage: 'Cargando tus tickets',
      },
      TITULO,
    );

    expect(vista.title).toBe('Bienvenido');
    expect(vista.message).toBe('Cargando tus tickets');
    expect(resolveLoadingScreen({ loadingTitle: '   ' }, TITULO).title).toBe(TITULO);
    expect(resolveLoadingScreen({ loadingMessage: '' }, TITULO).message).toBe('Cargando...');
  });

  it('un color de fondo claro fuerza texto negro', () => {
    const vista = resolveLoadingScreen(
      { loadingBackgroundColor: '#ffffff', loadingTextColor: '' },
      TITULO,
    );

    expect(vista.backgroundColor).toBe('#ffffff');
    expect(vista.textColor).toBe('#000000');
  });

  it('el color de texto elegido tiene prioridad sobre el contraste', () => {
    const vista = resolveLoadingScreen(
      { loadingBackgroundColor: '#ffffff', loadingTextColor: '#123456' },
      TITULO,
    );

    expect(vista.textColor).toBe('#123456');
  });

  it('en modo "solo el logo" no se pintan ni los textos ni el indicador', () => {
    const vista = resolveLoadingScreen(
      {
        loadingMode: 'IMAGE',
        loadingImageUrl: '/uploads/publico/loading_1.png',
        loadingAnimation: 'BARS',
        loadingSoloMarca: true,
      },
      TITULO,
    );

    expect(vista.showTexts).toBe(false);
    expect(vista.animation).toBe('NONE');
    // El titulo y el mensaje se siguen resolviendo por si el administrador
    // vuelve a encenderlos.
    expect(vista.title).toBe(TITULO);
    expect(vista.message).toBe('Cargando...');
  });

  it('apagar "solo el logo" recupera el indicador que se habia elegido', () => {
    const vista = resolveLoadingScreen(
      { loadingAnimation: 'BARS', loadingSoloMarca: false },
      TITULO,
    );

    expect(vista.showTexts).toBe(true);
    expect(vista.animation).toBe('BARS');
  });

  it('el efecto del logo sigue activo en modo "solo el logo"', () => {
    const vista = resolveLoadingScreen(
      { loadingLogoEffect: 'FADE', loadingSoloMarca: true },
      TITULO,
    );

    expect(vista.logoEffectClass).toBe('loading-logo-fade');
  });

  it('respeta la variante clara u oscura y la barra de progreso', () => {
    const config: Partial<BrandingConfig> = { loadingTheme: 'DARK', loadingProgress: true };

    expect(resolveLoadingScreen(config, TITULO).theme).toBe('DARK');
    expect(resolveLoadingScreen(config, TITULO).progress).toBe(true);
  });
});

describe('efectos del logo', () => {
  it('sin configurar, el logo se queda quieto', () => {
    const vista = resolveLoadingScreen({}, TITULO);

    expect(vista.logoEffect).toBe('NONE');
    expect(vista.logoEffectClass).toBe('');
  });

  it('cada efecto del catalogo tiene su clase y todas son distintas', () => {
    const clases = LOADING_LOGO_EFFECTS.map((e) => loadingLogoEffectClass(e.value));

    expect(clases).toContain('');
    expect(new Set(clases).size).toBe(LOADING_LOGO_EFFECTS.length);
    // Ninguna clase puede quedar sin definir: seria una animacion muda.
    for (const clase of clases) {
      expect(clase).toMatch(/^(|loading-logo-[a-z-]+)$/);
    }
  });

  it('el efecto configurado viaja resuelto a la vista', () => {
    expect(resolveLoadingScreen({ loadingLogoEffect: 'FADE' }, TITULO).logoEffectClass)
      .toBe('loading-logo-fade');
    expect(resolveLoadingScreen({ loadingLogoEffect: 'GLOW' }, TITULO).logoEffectClass)
      .toBe('loading-logo-glow');
    expect(resolveLoadingScreen({ loadingLogoEffect: 'floating' as BrandingConfig['loadingLogoEffect'] }, TITULO).logoEffect)
      .toBe('NONE');
  });

  it('el catalogo no tiene efectos duplicados ni desconocidos', () => {
    const valores = LOADING_LOGO_EFFECTS.map((e) => e.value);

    expect(new Set(valores).size).toBe(valores.length);
    expect(valores).toContain('FADE');
    expect(valores).toContain('SHIMMER');
    // Un valor fuera del catalogo cae en NONE y no rompe la pantalla.
    expect(resolveLoadingScreen({ loadingLogoEffect: 'EXPLOTION' as BrandingConfig['loadingLogoEffect'] }, TITULO).logoEffectClass)
      .toBe('');
  });

  it('el efecto del logo y el indicador son independientes', () => {
    const vista = resolveLoadingScreen(
      { loadingLogoEffect: 'FADE', loadingAnimation: 'BARS' },
      TITULO,
    );

    expect(vista.logoEffectClass).toBe('loading-logo-fade');
    expect(vista.animation).toBe('BARS');
  });
});

describe('tamaño de la imagen del splash', () => {
  it('sin configurar usa el tamaño por defecto', () => {
    expect(resolveLoadingScreen({}, TITULO).imageSize).toBe(DEFAULT_LOADING_IMAGE_SIZE);
  });

  it('acepta el tamaño elegido', () => {
    expect(resolveLoadingScreen({ loadingImageSize: 180 }, TITULO).imageSize).toBe(180);
  });

  it('acota a un rango usable, en ambos sentidos', () => {
    expect(resolveLoadingScreen({ loadingImageSize: 5 }, TITULO).imageSize)
      .toBe(MIN_LOADING_IMAGE_SIZE);
    expect(resolveLoadingScreen({ loadingImageSize: 900 }, TITULO).imageSize)
      .toBe(MAX_LOADING_IMAGE_SIZE);
  });

  it('redondea y aplica el valor por defecto a lo que no es un numero', () => {
    expect(clampSize(150.6)).toBe(151);
    expect(clampSize(undefined)).toBe(DEFAULT_LOADING_IMAGE_SIZE);
    expect(clampSize(null)).toBe(DEFAULT_LOADING_IMAGE_SIZE);
    expect(clampSize(NaN)).toBe(DEFAULT_LOADING_IMAGE_SIZE);
  });

  it('el tamaño es independiente del modo', () => {
    const conImagen = resolveLoadingScreen(
      { loadingMode: 'IMAGE', loadingImageUrl: '/uploads/publico/l.png', loadingImageSize: 200 },
      TITULO,
    );
    expect(conImagen.imageSize).toBe(200);

    const conIcono = resolveLoadingScreen(
      { loadingMode: 'ICON', loadingIcon: 'fa-solid fa-gear', loadingImageSize: 200 },
      TITULO,
    );
    expect(conIcono.imageSize).toBe(200);
  });
});

describe('clampDuration', () => {
  it('acota la duracion minima entre 0 y el tope', () => {
    expect(clampDuration(0)).toBe(0);
    expect(clampDuration(-1)).toBe(0);
    expect(clampDuration(1500)).toBe(1500);
    expect(clampDuration(999999)).toBe(MAX_LOADING_MIN_DURATION_MS);
  });

  it('redondea y aplica el valor por defecto a lo que no es un numero', () => {
    expect(clampDuration(1200.6)).toBe(1201);
    expect(clampDuration(undefined)).toBe(DEFAULT_LOADING_MIN_DURATION_MS);
    expect(clampDuration(null)).toBe(DEFAULT_LOADING_MIN_DURATION_MS);
    expect(clampDuration(NaN)).toBe(DEFAULT_LOADING_MIN_DURATION_MS);
  });
});
