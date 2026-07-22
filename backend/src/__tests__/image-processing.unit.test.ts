const metadata = jest.fn();
const toFile = jest.fn();
const unlink = jest.fn();
const sharpPipeline = {
  metadata,
  rotate: jest.fn(),
  resize: jest.fn(),
  webp: jest.fn(),
  toFile,
};
sharpPipeline.rotate.mockReturnValue(sharpPipeline);
sharpPipeline.resize.mockReturnValue(sharpPipeline);
sharpPipeline.webp.mockReturnValue(sharpPipeline);
const sharpMock = jest.fn(() => sharpPipeline);

jest.mock('sharp', () => ({ __esModule: true, default: sharpMock }));
jest.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: jest.fn().mockReturnValue(true),
    mkdirSync: jest.fn(),
    promises: { unlink },
  },
}));

import { deleteImage, processAndSaveImage } from '../services/image.service';

const RESTAURANT_ID = '507f1f77bcf86cd799439011';

describe('image processing output', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sharpPipeline.rotate.mockReturnValue(sharpPipeline);
    sharpPipeline.resize.mockReturnValue(sharpPipeline);
    sharpPipeline.webp.mockReturnValue(sharpPipeline);
    metadata.mockResolvedValue({ width: 800, height: 600, format: 'jpeg' });
    toFile.mockResolvedValue({});
  });

  it('uses a .webp filename for WebP-encoded output', async () => {
    const file = {
      originalname: 'menu-photo.jpg',
      buffer: Buffer.from('image'),
    } as Express.Multer.File;

    const publicPath = await processAndSaveImage(file, 'dishes', RESTAURANT_ID);

    expect(publicPath).toMatch(new RegExp(`^/uploads/dishes/${RESTAURANT_ID}-\\d+-[\\w-]+\\.webp$`));
    expect(toFile).toHaveBeenCalledWith(expect.stringMatching(/\.webp$/));
    expect(sharpPipeline.webp).toHaveBeenCalledWith({ quality: 80 });
  });

  it('refuses to delete another restaurant tenant\'s image', async () => {
    await expect(deleteImage(
      '/uploads/dishes/507f1f77bcf86cd799439012-photo.webp',
      RESTAURANT_ID
    )).resolves.toBe(false);

    expect(unlink).not.toHaveBeenCalled();
  });
});
