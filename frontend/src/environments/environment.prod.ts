export const environment = {
  production: true,
  apiUrl: '/api',
  // WebSocket uses the same site URL (wss:// automatically with HTTPS)
  // Set a different endpoint only when WebSocket traffic uses another origin.
  wsUrl: '',
};
