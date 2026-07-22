import { extractTax, splitAmount } from '../utils/tax';

describe('Tax Utils', () => {
  describe('extractTax', () => {
    it('should extract 10% tax from gross amount', () => {
      expect(extractTax(110, 10)).toBe(10);
    });

    it('should return 0 for 0% tax rate', () => {
      expect(extractTax(100, 0)).toBe(0);
    });
  });

  describe('splitAmount', () => {
    it('should split evenly when divisible', () => {
      const parts = splitAmount(90, 3);
      expect(parts).toHaveLength(3);
      expect(parts.every((p) => p === 30)).toBe(true);
    });

    it('should handle rounding and put remainder in first part', () => {
      const parts = splitAmount(10, 3);
      const sum = parts.reduce((a, b) => a + b, 0);
      expect(parseFloat(sum.toFixed(2))).toBe(10);
    });

    it('should return full amount for 1 part', () => {
      expect(splitAmount(75.5, 1)).toEqual([75.5]);
    });

    it('never creates negative tickets when cents are split into many parts', () => {
      const parts = splitAmount(0.5, 100);

      expect(parts).toHaveLength(100);
      expect(parts.every((part) => part >= 0)).toBe(true);
      expect(parts.reduce((sum, part) => sum + Math.round(part * 100), 0)).toBe(50);
    });

    it('rejects invalid split inputs', () => {
      expect(() => splitAmount(-1, 2)).toThrow('INVALID_SPLIT_AMOUNT');
      expect(() => splitAmount(1, 0)).toThrow('INVALID_SPLIT_AMOUNT');
      expect(() => splitAmount(1, 1.5)).toThrow('INVALID_SPLIT_AMOUNT');
    });
  });
});
