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
    async processImage(buffer) {
        const uploadDir = path.join(__dirname, '../../public/uploads/menu');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filename = `item-${Date.now()}-${Math.round(Math.random() * 1000)}.webp`;
        const filepath = path.join(uploadDir, filename);

        // Optimize image with sharp: Max 500px, WebP format
        await sharp(buffer)
            .resize(500, 500, { fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(filepath);

        return `/uploads/menu/${filename}`;
    }
}

export default new MenuService();
