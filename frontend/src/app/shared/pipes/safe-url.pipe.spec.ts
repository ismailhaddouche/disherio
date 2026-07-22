import { TestBed } from '@angular/core/testing';
import { SafeUrlPipe } from './safe-url.pipe';

describe('SafeUrlPipe', () => {
  let pipe: SafeUrlPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = TestBed.runInInjectionContext(() => new SafeUrlPipe());
  });

  it('accepts HTTP URLs and same-origin upload paths', () => {
    expect(pipe.transform('https://cdn.example.com/dish.webp')).not.toBeNull();
    expect(pipe.transform('/uploads/dishes/dish.webp')).not.toBeNull();
  });

  it('rejects active or embedded-data protocols', () => {
    expect(pipe.transform('javascript:alert(1)')).toBeNull();
    expect(pipe.transform('data:image/svg+xml,<svg></svg>')).toBeNull();
    expect(pipe.transform('file:///etc/passwd')).toBeNull();
  });
});
