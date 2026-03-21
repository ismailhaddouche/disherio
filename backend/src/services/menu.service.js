import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MenuService {
    /**
     * Processes and optimizes a menu item image
     * @param {Buffer} buffer - The image buffer from multer
     * @returns {Promise<string>} - The relative URL of the saved image
     */
    async processImage(file) {
        const uploadDir = path.join(__dirname, '../../public/uploads/menu');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const buffer = file?.buffer;
        if (!buffer) {
            throw new Error('Invalid image payload: missing buffer');
        }

        const webpFilename = `item-${Date.now()}-${Math.round(Math.random() * 1000)}.webp`;
        const webpFilepath = path.join(uploadDir, webpFilename);

        try {
            await sharp(buffer)
                .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(webpFilepath);

            return `/uploads/menu/${webpFilename}`;
        } catch {
            const extension = (file.originalname && path.extname(file.originalname)) || '.jpg';
            const fallbackFilename = `item-${Date.now()}-${Math.round(Math.random() * 1000)}${extension.toLowerCase()}`;
            const fallbackPath = path.join(uploadDir, fallbackFilename);
            fs.writeFileSync(fallbackPath, buffer);
            return `/uploads/menu/${fallbackFilename}`;
        }
    }
}

export default new MenuService();
