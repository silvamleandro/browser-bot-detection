/**
 * Layer B: environment and fingerprint coherence.
 *
 * No single property is worth much: spoofing a User-Agent costs one line. The
 * value is in cross-checks, which are far harder to keep mutually consistent.
 *
 * Raw observations only. Derived comparisons live in features.js, so stored
 * sessions stay stable while feature engineering changes.
 */
import { safe, safeAsync, PROBE_ABSENT } from '../util.js';

/** Fonts chosen to separate real desktop installs from minimal container images. */
const FONT_PROBES = [
  'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas',
  'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Palatino Linotype',
  'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
  'Helvetica', 'Helvetica Neue', 'Menlo', 'Monaco', 'Geneva', 'Optima',
  'Ubuntu', 'Cantarell', 'DejaVu Sans', 'DejaVu Serif', 'Liberation Sans',
  'Liberation Serif', 'Noto Sans', 'Noto Color Emoji', 'FreeSans', 'Nimbus Sans',
  'Roboto', 'Droid Sans', 'Open Sans', 'Fira Sans',
];

const CSS_QUERIES = [
  'any-hover: hover', 'any-hover: none', 'any-pointer: fine', 'any-pointer: coarse',
  'any-pointer: none', 'hover: hover', 'hover: none', 'pointer: fine',
  'pointer: coarse', 'pointer: none', 'prefers-reduced-motion: reduce',
  'prefers-color-scheme: dark', 'prefers-contrast: more', 'forced-colors: active',
  'color-gamut: srgb', 'color-gamut: p3', 'dynamic-range: high', 'display-mode: browser',
];

const CODECS = [
  ['video/mp4; codecs="avc1.42E01E"', 'h264'],
  ['video/webm; codecs="vp9"', 'vp9'],
  ['video/webm; codecs="vp8"', 'vp8'],
  ['video/mp4; codecs="av01.0.05M.08"', 'av1'],
  ['audio/mpeg', 'mp3'],
  ['audio/mp4; codecs="mp4a.40.2"', 'aac'],
  ['audio/ogg; codecs="vorbis"', 'vorbis'],
];

function collectNavigator() {
  const n = navigator;
  return {
    user_agent: safe(() => n.userAgent),
    platform: safe(() => n.platform),
    vendor: safe(() => n.vendor),
    language: safe(() => n.language),
    languages: safe(() => (n.languages || []).join(',')),
    hardware_concurrency: safe(() => n.hardwareConcurrency),
    device_memory: safe(() => n.deviceMemory),
    max_touch_points: safe(() => n.maxTouchPoints),
    pdf_viewer_enabled: safe(() => n.pdfViewerEnabled),
    cookie_enabled: safe(() => n.cookieEnabled),
    do_not_track: safe(() => n.doNotTrack),
    plugins_count: safe(() => n.plugins.length),
    mime_types_count: safe(() => n.mimeTypes.length),
      webdriver: safe(() => n.webdriver),
  };
}

function collectScreen() {
  // outer == inner means no browser chrome is drawn: no toolbars, no borders.
  return {
    screen_w: safe(() => screen.width),
    screen_h: safe(() => screen.height),
    avail_w: safe(() => screen.availWidth),
    avail_h: safe(() => screen.availHeight),
    color_depth: safe(() => screen.colorDepth),
    pixel_depth: safe(() => screen.pixelDepth),
    orientation: safe(() => screen.orientation.type),
    inner_w: safe(() => innerWidth),
    inner_h: safe(() => innerHeight),
    outer_w: safe(() => outerWidth),
    outer_h: safe(() => outerHeight),
    device_pixel_ratio: safe(() => devicePixelRatio),
    visual_viewport_scale: safe(() => visualViewport.scale),
  };
}

function collectIntl() {
  const opts = safe(() => Intl.DateTimeFormat().resolvedOptions(), {});
  return {
    timezone: opts?.timeZone ?? PROBE_ABSENT,
    locale: opts?.locale ?? PROBE_ABSENT,
    calendar: opts?.calendar ?? PROBE_ABSENT,
    numbering_system: opts?.numberingSystem ?? PROBE_ABSENT,
    tz_offset_minutes: safe(() => new Date().getTimezoneOffset()),
    // Six months apart: a zone pinned to UTC shows no seasonal shift.
    tz_offset_jan: safe(() => new Date(2026, 0, 15).getTimezoneOffset()),
    tz_offset_jul: safe(() => new Date(2026, 6, 15).getTimezoneOffset()),
  };
}

function collectWebGL() {
  const out = {};
  for (const [key, ctxName] of [['webgl', 'webgl'], ['webgl2', 'webgl2']]) {
    const gl = safe(() => document.createElement('canvas').getContext(ctxName), null);
    if (!gl || typeof gl.getParameter !== 'function') {
      out[`${key}_supported`] = false;
      continue;
    }
    out[`${key}_supported`] = true;
    const dbg = safe(() => gl.getExtension('WEBGL_debug_renderer_info'), null);
    out[`${key}_vendor`] = safe(() => gl.getParameter(gl.VENDOR));
    out[`${key}_renderer`] = safe(() => gl.getParameter(gl.RENDERER));
    out[`${key}_unmasked_vendor`] = dbg ? safe(() => gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)) : PROBE_ABSENT;
    out[`${key}_unmasked_renderer`] = dbg ? safe(() => gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : PROBE_ABSENT;
    out[`${key}_version`] = safe(() => gl.getParameter(gl.VERSION));
    out[`${key}_glsl_version`] = safe(() => gl.getParameter(gl.SHADING_LANGUAGE_VERSION));

    // The cross-check: the renderer string is cheap to spoof, these limits are not.
    out[`${key}_max_texture_size`] = safe(() => gl.getParameter(gl.MAX_TEXTURE_SIZE));
    out[`${key}_max_cube_map_size`] = safe(() => gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE));
    out[`${key}_max_renderbuffer_size`] = safe(() => gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    out[`${key}_max_viewport_dims`] = safe(() => Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS)).join('x'));
    out[`${key}_max_vertex_attribs`] = safe(() => gl.getParameter(gl.MAX_VERTEX_ATTRIBS));
    out[`${key}_max_texture_image_units`] = safe(() => gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS));
    out[`${key}_aliased_line_width_range`] = safe(() => Array.from(gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE)).join(','));
    out[`${key}_max_anisotropy`] = safe(() => {
      const ext = gl.getExtension('EXT_texture_filter_anisotropic');
      return ext ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : PROBE_ABSENT;
    });

    // Counts and limits describe the capability surface, which is what the
    // detection uses. A hash of the extension list would describe the device, and
    // that is a tracking identifier this page has no reason to hold.
    const exts = safe(() => (gl.getSupportedExtensions() || []).slice().sort(), []);
    out[`${key}_extension_count`] = Array.isArray(exts) ? exts.length : PROBE_ABSENT;
  }
  return out;
}

function collectCanvas() {
  // Anti-aliasing, subpixel text and gradient dithering all shift on a software renderer.
  return safe(() => {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 80;
    const ctx = c.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(10, 10, 90, 40);
    ctx.fillStyle = '#069';
    ctx.font = '16px "Arial"';
    ctx.fillText('Incognia \u{1F511} bot?', 12, 36);
    ctx.strokeStyle = 'rgba(102, 200, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(180, 40, 30, 0, Math.PI * 2);
    ctx.stroke();
    const grad = ctx.createLinearGradient(0, 0, 300, 0);
    grad.addColorStop(0, 'rgba(255,0,0,0.4)');
    grad.addColorStop(1, 'rgba(0,0,255,0.4)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 60, 300, 20);

    const data = c.toDataURL();
    const m = ctx.measureText('Incognia bot?');
    return {
      // The rendered bytes are not hashed: a canvas hash is the textbook
      // cross-site identifier. The measurements below separate a software
      // rasteriser from a real GPU without identifying the device.
      canvas_len: data.length,
      canvas_text_width: Math.round(m.width * 1000) / 1000,
      canvas_actual_ascent: Math.round((m.actualBoundingBoxAscent ?? 0) * 1000) / 1000,
      canvas_actual_descent: Math.round((m.actualBoundingBoxDescent ?? 0) * 1000) / 1000,
      canvas_emoji_width: Math.round(ctx.measureText('\u{1F511}').width * 1000) / 1000,
    };
  }, {});
}

function collectFonts() {
  // Render against a known fallback. A different width means the font resolved.
  return safe(() => {
    const base = ['monospace', 'sans-serif', 'serif'];
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;font-size:72px;white-space:nowrap;';
    probe.textContent = 'mmmmmmmmmmlli WWW@@@';
    document.body.appendChild(probe);

    const baseline = {};
    for (const b of base) {
      probe.style.fontFamily = b;
      baseline[b] = [probe.offsetWidth, probe.offsetHeight];
    }
    const present = [];
    for (const font of FONT_PROBES) {
      let found = false;
      for (const b of base) {
        probe.style.fontFamily = `"${font}",${b}`;
        if (probe.offsetWidth !== baseline[b][0] || probe.offsetHeight !== baseline[b][1]) {
          found = true;
          break;
        }
      }
      if (found) present.push(font);
    }
    document.body.removeChild(probe);
    // Only the count. The list itself is one of the strongest fingerprinting
    // vectors there is, and the detection only needs "a container image has
    // almost none".
    return { font_count: present.length };
  }, {});
}

function collectCSS() {
  const out = {};
  for (const q of CSS_QUERIES) {
    const key = 'css_' + q.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    out[key] = safe(() => matchMedia(`(${q})`).matches);
  }
  return out;
}

function collectCodecs() {
  const out = {};
  const video = safe(() => document.createElement('video'), null);
  for (const [type, name] of CODECS) {
    out[`codec_${name}`] = video ? safe(() => video.canPlayType(type) || 'no') : PROBE_ABSENT;
    out[`mse_${name}`] = safe(() => (window.MediaSource ? MediaSource.isTypeSupported(type) : PROBE_ABSENT));
  }
  return out;
}

function collectMisc() {
  return {
    has_local_storage: safe(() => !!localStorage),
    has_session_storage: safe(() => !!sessionStorage),
    has_indexed_db: safe(() => !!indexedDB),
    has_webrtc: safe(() => typeof RTCPeerConnection === 'function'),
    has_battery_api: safe(() => typeof navigator.getBattery === 'function'),
    has_bluetooth: safe(() => !!navigator.bluetooth),
    has_usb: safe(() => !!navigator.usb),
    has_credentials: safe(() => !!navigator.credentials),
    has_service_worker: safe(() => !!navigator.serviceWorker),
    has_speech_synthesis: safe(() => !!window.speechSynthesis),
    voices_count: safe(() => speechSynthesis.getVoices().length),
    notification_permission: safe(() => Notification.permission),
    history_length: safe(() => history.length),
    doc_hidden: safe(() => document.hidden),
    doc_has_focus: safe(() => document.hasFocus()),
    doc_visibility: safe(() => document.visibilityState),
    referrer_present: safe(() => document.referrer.length > 0),
    conn_effective_type: safe(() => navigator.connection.effectiveType),
    conn_rtt: safe(() => navigator.connection.rtt),
    conn_downlink: safe(() => navigator.connection.downlink),
    conn_save_data: safe(() => navigator.connection.saveData),
    error_stack_lines: safe(() => new Error('probe').stack.split('\n').length),
    fn_tostring_native: safe(() => Function.prototype.toString.call(Function.prototype.toString).includes('[native code]')),
  };
}

async function collectAsync() {
  const out = {};

  // Structured counterpart to the UA string. Disagreement is a coherence failure.
  // Low-entropy fields only: the high-entropy ones (device model, full version list)
  // describe the device, and no feature needs them.
  const uaData = safe(() => {
    if (!navigator.userAgentData) return PROBE_ABSENT;
    return {
      brands: (navigator.userAgentData.brands || []).map((b) => `${b.brand}:${b.version}`).join('|'),
      mobile: navigator.userAgentData.mobile,
      platform: navigator.userAgentData.platform,
    };
  });
  if (uaData && typeof uaData === 'object') {
    for (const [k, v] of Object.entries(uaData)) out[`uach_${k}`] = v;
  } else {
    out.uach_present = false;
  }

  // Headless exposes no devices, or devices with empty labels.
  const devices = await safeAsync(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return PROBE_ABSENT;
    const list = await navigator.mediaDevices.enumerateDevices();
    return {
      count: list.length,
      kinds: list.map((d) => d.kind).sort().join(','),
      labelled: list.filter((d) => d.label && d.label.length > 0).length,
    };
  });
  if (devices && typeof devices === 'object') {
    out.media_device_count = devices.count;
    out.media_device_kinds = devices.kinds;
    out.media_device_labelled = devices.labelled;
  }

  // A fresh browser returns 'prompt'. Mismatch against Notification.permission
  // means one was patched without the other.
  out.perm_notifications = await safeAsync(async () => (await navigator.permissions.query({ name: 'notifications' })).state);
  out.perm_geolocation = await safeAsync(async () => (await navigator.permissions.query({ name: 'geolocation' })).state);

  // Presence only: charge level and charging state say something about the device
  // and nothing about who is driving it.
  out.battery_present = await safeAsync(async () => {
    if (typeof navigator.getBattery !== 'function') return false;
    await navigator.getBattery();
    return true;
  });

  return out;
}

/** Collect the full environment snapshot. Returns a flat object of raw observations. */
export async function collectEnvironment() {
  const sync = {
    ...collectNavigator(),
    ...collectScreen(),
    ...collectIntl(),
    ...collectWebGL(),
    ...collectCanvas(),
    ...collectFonts(),
    ...collectCSS(),
    ...collectCodecs(),
    ...collectMisc(),
  };
  const async_ = await collectAsync();
  return { ...sync, ...async_ };
}
