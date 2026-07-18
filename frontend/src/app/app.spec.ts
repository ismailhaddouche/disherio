import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { App } from './app';
import { UpdateService } from './core/services/update.service';

describe('App', () => {
  let updateService: UpdateService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App, RouterModule.forRoot([])],
      providers: [
        { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: { subscribe: () => ({ unsubscribe: () => {} }) }, checkForUpdate: () => Promise.resolve(false), activateUpdate: () => Promise.resolve() } },
      ],
    }).compileComponents();

    updateService = TestBed.inject(UpdateService);
  });

  afterEach(() => {
    (updateService as any).ngOnDestroy?.();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render router-outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});