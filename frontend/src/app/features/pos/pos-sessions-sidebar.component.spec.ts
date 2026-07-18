import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { I18nService } from '../../core/services/i18n.service';
import { authStore, type AuthUser } from '../../store/auth.store';
import type { ItemOrder, TotemSession } from '../../types';
import type { PosSessionActionsService } from './pos-session-actions.service';
import { PosSessionsSidebarComponent } from './pos-sessions-sidebar.component';

function createSession(overrides: Partial<TotemSession> = {}): TotemSession {
  return {
    _id: 'session-1',
    totem_id: 'totem-1',
    session_date_start: '2026-07-18T10:00:00.000Z',
    totem_state: 'STARTED',
    item_count: 3,
    totem: {
      _id: 'totem-1',
      restaurant_id: 'restaurant-1',
      totem_name: 'Table 1',
      totem_qr: 'qr-1',
      totem_type: 'STANDARD',
    },
    ...overrides,
  };
}

function createActionsMock(): Pick<PosSessionActionsService, 'newTotemName' | 'isCreatingTotem' | 'startSession' | 'createTemporaryTotem'> {
  return {
    newTotemName: signal(''),
    isCreatingTotem: signal(false),
    startSession: jasmine.createSpy('startSession'),
    createTemporaryTotem: jasmine.createSpy('createTemporaryTotem'),
  };
}

describe('PosSessionsSidebarComponent', () => {
  let fixture: ComponentFixture<PosSessionsSidebarComponent>;
  let component: PosSessionsSidebarComponent;
  let actions: ReturnType<typeof createActionsMock>;

  beforeEach(async () => {
    actions = createActionsMock();

    await TestBed.configureTestingModule({
      imports: [PosSessionsSidebarComponent],
      providers: [
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PosSessionsSidebarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isConnected', true);
    fixture.componentRef.setInput('isLoading', false);
    fixture.componentRef.setInput('activeSessions', []);
    fixture.componentRef.setInput('closedSessions', []);
    fixture.componentRef.setInput('sessionItems', []);
    fixture.componentRef.setInput('availableTotems', []);
    fixture.componentRef.setInput('hasOpenSession', false);
    fixture.componentRef.setInput('showTicketHistory', false);
    fixture.componentRef.setInput('actions', actions as unknown as PosSessionActionsService);
    fixture.detectChanges();
  });

  afterEach(() => authStore.clearAuth());

  it('renders the active sessions and emits the selected one on click', () => {
    const session = createSession();
    fixture.componentRef.setInput('activeSessions', [session]);
    fixture.detectChanges();
    const selectSpy = jasmine.createSpy('sessionSelect');
    component.sessionSelect.subscribe(selectSpy);

    const button = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(candidate => candidate.textContent?.includes('Table 1')) as HTMLButtonElement;
    button.click();

    expect(selectSpy).toHaveBeenCalledOnceWith(session);
  });

  it('counts live items for the selected session and item_count for the rest', () => {
    const selected = createSession({ _id: 'session-1', item_count: 9 });
    const other = createSession({ _id: 'session-2', item_count: 4 });
    const liveItems = [
      { _id: 'item-1', item_state: 'ORDERED' } as ItemOrder,
      { _id: 'item-2', item_state: 'CANCELED' } as ItemOrder,
    ];
    fixture.componentRef.setInput('selectedSessionId', 'session-1');
    fixture.componentRef.setInput('sessionItems', liveItems);
    fixture.detectChanges();

    expect(component.getSessionItemCount(selected)).toBe(1);
    expect(component.getSessionItemCount(other)).toBe(4);
  });

  it('starts a session from an available totem through the actions service', () => {
    fixture.componentRef.setInput('availableTotems', [
      { _id: 'totem-7', totem_name: 'Table 7', totem_type: 'STANDARD' },
    ]);
    fixture.detectChanges();

    const openButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(candidate => candidate.textContent?.includes('tas.session.open')) as HTMLButtonElement;
    openButton.click();

    expect(actions.startSession).toHaveBeenCalledOnceWith('totem-7');
  });

  it('shows the empty state while loading and emits openHistory for staff with payment access', () => {
    fixture.componentRef.setInput('isLoading', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('common.loading');

    authStore.setAuth({ permissions: ['POS'] } as AuthUser, 0);
    fixture.detectChanges();
    const historySpy = jasmine.createSpy('openHistory');
    component.openHistory.subscribe(historySpy);

    const historyButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[])
      .find(candidate => candidate.textContent?.includes('pos.history.title')) as HTMLButtonElement;
    historyButton.click();

    expect(historySpy).toHaveBeenCalledTimes(1);
  });
});
