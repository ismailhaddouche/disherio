import { Pipe, PipeTransform } from '@angular/core';

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

@Pipe({
  name: 'safeUrl',
  standalone: true,
})
export class SafeUrlPipe implements PipeTransform {
  transform(value: string | null | undefined): string | null {
    if (!value) return null;

    try {
      const url = new URL(value, window.location.origin);
      if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
        return null;
      }
      // Keep Angular's context-aware URL sanitizer in the enforcement path.
      return url.href;
    } catch {
      return null;
    }
  }
}
