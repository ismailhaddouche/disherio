const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'backend', 'src', 'locales');
const esPath = path.join(localesDir, 'es.json');
const enPath = path.join(localesDir, 'en.json');

const esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

esData.ERRORS.NO_TOKEN_PROVIDED = 'No se proporcionó ningún token de acceso';
esData.ERRORS.FAILED_AUTH_TOKEN = 'Fallo al autenticar el token';

enData.ERRORS.NO_TOKEN_PROVIDED = 'No access token provided';
enData.ERRORS.FAILED_AUTH_TOKEN = 'Failed to authenticate token';

fs.writeFileSync(esPath, JSON.stringify(esData, null, 4));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 4));

console.log('Auth middleware errors added to backend translation files.');
