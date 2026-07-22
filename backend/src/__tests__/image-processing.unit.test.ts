const metadata = jest.fn();
const toFile = jest.fn();
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
  },
}));

import { processAndSaveImage } from '../services/image.service';

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

    const publicPath = await processAndSaveImage(file, 'dishes');

    expect(publicPath).toMatch(/^\/uploads\/dishes\/\d+-[\w-]+\.webp$/);
    expect(toFile).toHaveBeenCalledWith(expect.stringMatching(/\.webp$/));
    expect(sharpPipeline.webp).toHaveBeenCalledWith({ quality: 80 });
  });
});
