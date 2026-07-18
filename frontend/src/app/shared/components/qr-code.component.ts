import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, input, OnChanges, viewChild } from '@angular/core';
import QRCode from 'qrcode';

@Component({
  selector: 'app-qr-code',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas role="img" [attr.aria-label]="ariaLabel()"></canvas>`,
  styles: [`:host { display: inline-flex; } canvas { width: 100%; height: auto; }`],
})
export class QrCodeComponent implements AfterViewInit, OnChanges {
  readonly value = input.required<string>();
  readonly ariaLabel = input.required<string>();
  readonly size = input(200);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private viewInitialized = false;

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.render();
  }

  ngOnChanges(): void {
    if (this.viewInitialized) this.render();
  }

  private render(): void {
    void QRCode.toCanvas(this.canvas().nativeElement, this.value(), {
      width: this.size(),
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }
}
