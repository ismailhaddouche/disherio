import { PosComponent } from './pos.component';

describe('PosComponent customer assignment', () => {
  let component: PosComponent;

  beforeEach(() => {
    component = Object.create(PosComponent.prototype) as PosComponent;
    spyOn(component, 'assignItemToCustomer');
  });

  it('reads the selected customer from the native select event', () => {
    const event = { target: { value: 'customer-1' } } as unknown as Event;

    component.assignItemFromSelect('item-1', event);

    expect(component.assignItemToCustomer).toHaveBeenCalledOnceWith('item-1', 'customer-1');
  });

  it('maps the empty option to an unassigned item', () => {
    const event = { target: { value: '' } } as unknown as Event;

    component.assignItemFromSelect('item-1', event);

    expect(component.assignItemToCustomer).toHaveBeenCalledOnceWith('item-1', null);
  });
});
