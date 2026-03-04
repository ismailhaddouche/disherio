const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'frontend', 'src', 'assets', 'i18n');
const esPath = path.join(localesDir, 'es.json');
const enPath = path.join(localesDir, 'en.json');

const esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

if (!esData.APP) esData.APP = {};
esData.APP.RESTAURANT_NAME = "Restaurante Digital";
esData.APP.ONLINE = "En Línea";
esData.APP.OFFLINE = "Desconectado";

if (!esData.DASHBOARD) esData.DASHBOARD = {};
esData.DASHBOARD.LIVE = "EN VIVO";
esData.DASHBOARD.TOTEM = "Tótem";

if (!enData.APP) enData.APP = {};
enData.APP.RESTAURANT_NAME = "Digital Restaurant";
enData.APP.ONLINE = "Online";
enData.APP.OFFLINE = "Offline";

if (!enData.DASHBOARD) enData.DASHBOARD = {};
enData.DASHBOARD.LIVE = "LIVE";
enData.DASHBOARD.TOTEM = "Totem";

fs.writeFileSync(esPath, JSON.stringify(esData, null, 4));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 4));

console.log('Frontend translation files updated with APP and DASHBOARD fixes.');
