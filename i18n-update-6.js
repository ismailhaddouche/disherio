const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'frontend', 'src', 'assets', 'i18n');
const esPath = path.join(localesDir, 'es.json');
const enPath = path.join(localesDir, 'en.json');

const esData = JSON.parse(fs.readFileSync(esPath, 'utf8'));
const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

if (!esData.KDS) esData.KDS = {};
esData.KDS.AVAILABILITY_DESC = "Desactiva platos que se hayan agotado.";

if (!enData.KDS) enData.KDS = {};
enData.KDS.AVAILABILITY_DESC = "Deactivate dishes that are out of stock.";

fs.writeFileSync(esPath, JSON.stringify(esData, null, 4));
fs.writeFileSync(enPath, JSON.stringify(enData, null, 4));

console.log('Frontend translation files updated with KDS translation.');
