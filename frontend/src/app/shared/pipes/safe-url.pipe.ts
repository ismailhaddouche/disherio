import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

@Pipe({
  name: 'safeUrl',
  standalone: true,
})
export class SafeUrlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeUrl | null {
    if (!value) return null;

    try {
      const url = new URL(value, window.location.origin);
      if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
        return null;
      }
      return this.sanitizer.bypassSecurityTrustUrl(url.href);
    } catch {
      return null;
    }
  }
}
