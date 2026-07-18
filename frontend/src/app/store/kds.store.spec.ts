import { kdsStore, type KdsItem } from './kds.store';

describe('kdsStore', () => {
  afterEach(() => kdsStore.setItems([]));

  it('handles duplicate new-item events idempotently', () => {
    const item = { _id: 'item-1', item_state: 'ORDERED' } as KdsItem;
    kdsStore.addItem(item);
    kdsStore.addItem(item);

    expect(kdsStore.items()).toEqual([item]);
  });
});
