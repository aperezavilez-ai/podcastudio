/**
 * Logger unificado para PodcastStudio
 * En desarrollo: console.log/warn/error
 * En producción: solo errores críticos, opcionalmente a servicio remoto
 */

const IS_DEV = typeof import.meta !== 'undefined' && import.meta.env?.DEV === true;
const IS_ELECTRON = typeof window !== 'undefined' && window.api !== undefined;

function formatArgs(...args) {
  const timestamp = new Date().toISOString();
  return [`[${timestamp}]`, ...args];
}

export const logger = {
  log: (...args) => {
    if (IS_DEV) console.log(...formatArgs(...args));
  },
  warn: (...args) => {
    if (IS_DEV) console.warn(...formatArgs(...args));
    else if (IS_ELECTRON && window.api?.logError) {
      window.api.logError(args.map(String).join(' '));
    }
  },
  error: (...args) => {
    const msg = args.map(String).join(' ');
    console.error(...formatArgs(...args));
    if (IS_ELECTRON && window.api?.logError) {
      window.api.logError(msg);
    }
  },
  debug: (...args) => {
    if (IS_DEV) console.debug(...formatArgs(...args));
  },
};

/**
 * Wrapper para try/catch con logging automático
 * @param {Function} fn - función a ejecutar
 * @param {string} context - contexto para el log de error
 * @returns {Promise<any>|any}
 */
export async function tryCatch(fn, context = '') {
  try {
    return await fn();
  } catch (err) {
    logger.error(`[${context}]`, err);
    throw err;
  }
}

/**
 * Wrapper síncrono para try/catch con logging
 */
export function tryCatchSync(fn, context = '') {
  try {
    return fn();
  } catch (err) {
    logger.error(`[${context}]`, err);
    throw err;
  }
}

/**
 * Ejecuta fn y loggea el error si falla, pero no lo relanza
 * Útil para cleanup code
 */
export function safeRun(fn, context = '') {
  try {
    return fn();
  } catch (err) {
    logger.warn(`[${context} safeRun]`, err);
    return null;
  }
}