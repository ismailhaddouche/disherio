import { applyTax, extractTax, splitAmount } from '../utils/tax';

describe('Tax Utils', () => {
  describe('applyTax', () => {
    it('should apply 10% tax correctly', () => {
      expect(applyTax(100, 10)).toBe(110);
    });

    it('should apply 21% tax correctly', () => {
      expect(applyTax(10, 21)).toBe(12.1);
    });

    it('should return same amount with 0% tax', () => {
      expect(applyTax(50, 0)).toBe(50);
    });
  });

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
  });
});
