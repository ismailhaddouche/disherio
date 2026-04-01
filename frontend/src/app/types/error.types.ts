/**
 * Códigos de error de la aplicación
 */
export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_ERROR = 'AUTH_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  NOT_FOUND = 'NOT_FOUND',
  FORBIDDEN = 'FORBIDDEN',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Interfaz base para errores de la aplicación
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: string;
  timestamp: Date;
}

/**
 * Error de validación de campo
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Contexto adicional para el manejo de errores
 */
export interface ErrorContext {
  component?: string;
  action?: string;
  userMessage?: string;
}

/**
 * Respuesta de error del servidor
 */
export interface ServerErrorResponse {
  statusCode: number;
  message: string;
  errorCode?: string;
  errors?: ValidationError[];
  path?: string;
  timestamp?: string;
}

/**
 * Mensajes de error amigables para el usuario
 */
export const USER_FRIENDLY_MESSAGES: Record<ErrorCode | number, string> = {
  // Códigos HTTP
  401: 'Tu sesión ha expirado. Por favor inicia sesión nuevamente.',
  403: 'No tienes permisos para realizar esta acción.',
  404: 'El recurso solicitado no fue encontrado.',
  429: 'Demasiadas solicitudes. Por favor espera un momento.',
  500: 'Ha ocurrido un error en el servidor. Inténtalo más tarde.',
  502: 'Error de conexión con el servidor. Inténtalo más tarde.',
  503: 'El servicio no está disponible. Inténtalo más tarde.',
  504: 'El servidor tardó demasiado en responder. Inténtalo más tarde.',

  // Códigos de error de la app
  [ErrorCode.NETWORK_ERROR]: 'Error de conexión. Verifica tu internet.',
  [ErrorCode.AUTH_ERROR]: 'Error de autenticación. Por favor inicia sesión nuevamente.',
  [ErrorCode.VALIDATION_ERROR]: 'Por favor verifica los datos ingresados.',
  [ErrorCode.SERVER_ERROR]: 'Ha ocurrido un error en el servidor. Inténtalo más tarde.',
  [ErrorCode.RATE_LIMIT]: 'Demasiadas solicitudes. Por favor espera un momento.',
  [ErrorCode.NOT_FOUND]: 'El recurso solicitado no fue encontrado.',
  [ErrorCode.FORBIDDEN]: 'No tienes permisos para realizar esta acción.',
  [ErrorCode.UNKNOWN_ERROR]: 'Ha ocurrido un error inesperado. Inténtalo más tarde.',
};

/**
 * Obtiene un mensaje amigable para el usuario basado en el código de error
 */
export function getUserFriendlyMessage(code: ErrorCode | number, defaultMessage?: string): string {
  return USER_FRIENDLY_MESSAGES[code] || defaultMessage || USER_FRIENDLY_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}
