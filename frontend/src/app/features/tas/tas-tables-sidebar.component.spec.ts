import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import type { TotemSession } from '../../types';
import type { TasSessionActionsService } from './tas-session-actions.service';
import { TasTablesSidebarComponent } from './tas-tables-sidebar.component';

function createSession(overrides: Partial<TotemSession> = {}): TotemSession {
  return {
    _id: 'session-1',
    totem_id: 'totem-1',
    session_date_start: '2026-07-18T10:00:00.000Z',
    totem_state: 'STARTED',
    ...overrides,
  };
}

function createActionsMock() {
  return {
    allTotems: signal([
      { _id: 'totem-1', totem_name: 'Table 1', totem_type: 'STANDARD' },
      { _id: 'totem-2', totem_name: 'Patio', totem_type: 'TEMPORARY' },
    ]),
    selectedTotemId: signal<string | null>(null),
    totemSessions: signal<TotemSession[]>([]),
    newTotemName: signal(''),
    isCreatingTotem: signal(false),
    loadTotemSessions: jasmine.createSpy('loadTotemSessions'),
    startSession: jasmine.createSpy('startSession'),
    createTemporaryTotem: jasmine.createSpy('createTemporaryTotem'),
  };
}

describe('TasTablesSidebarComponent', () => {
  let fixture: ComponentFixture<TasTablesSidebarComponent>;
  let component: TasTablesSidebarComponent;
  let actions: ReturnType<typeof createActionsMock>;

  beforeEach(async () => {
    actions = createActionsMock();

    await TestBed.configureTestingModule({
      imports: [TasTablesSidebarComponent],
      providers: [
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TasTablesSidebarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('actions', actions as unknown as TasSessionActionsService);
    fixture.componentRef.setInput('hasOpenSession', false);
    fixture.detectChanges();
  });

  it('renders the totems with their type badges', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Table 1');
    expect(text).toContain('Patio');
    expect(text).toContain('tas.standard');
    expect(text).toContain('tas.temporary');
  });

  it('loads the sessions of a totem when it is clicked', () => {
    const totemButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(candidate => candidate.textContent?.includes('Table 1')) as HTMLButtonElement;
    totemButton.click();

    expect(actions.loadTotemSessions).toHaveBeenCalledOnceWith('totem-1');
  });

  it('emits the selected session for the expanded totem', () => {
    const session = createSession();
    actions.selectedTotemId.set('totem-1');
    actions.totemSessions.set([session]);
    fixture.detectChanges();
    const selectSpy = jasmine.createSpy('sessionSelect');
    component.sessionSelect.subscribe(selectSpy);

    const sessionButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(candidate => candidate.textContent?.includes('tas.state_open')) as HTMLButtonElement;
    sessionButton.click();

    expect(selectSpy).toHaveBeenCalledOnceWith(session);
  });

  it('opens a new session for the expanded totem when none is open', () => {
    actions.selectedTotemId.set('totem-1');
    actions.totemSessions.set([]);
    fixture.detectChanges();

    const openButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(candidate => candidate.textContent?.includes('tas.session.open')) as HTMLButtonElement;
    openButton.click();

    expect(actions.startSession).toHaveBeenCalledOnceWith('totem-1');
  });

  it('hides the open-session button when a session is already open', () => {
    fixture.componentRef.setInput('hasOpenSession', true);
    actions.selectedTotemId.set('totem-1');
    fixture.detectChanges();

    const openButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(candidate => candidate.textContent?.includes('tas.session.open'));
    expect(openButton).toBeUndefined();
  });

  it('emits closed from the scrim and the close button', () => {
    const closedSpy = jasmine.createSpy('closed');
    component.closed.subscribe(closedSpy);

    (fixture.nativeElement.querySelector('.bg-scrim\\/50') as HTMLElement).click();
    (fixture.nativeElement.querySelector('button[aria-label="common.close"]') as HTMLButtonElement).click();

    expect(closedSpy).toHaveBeenCalledTimes(2);
  });
});
