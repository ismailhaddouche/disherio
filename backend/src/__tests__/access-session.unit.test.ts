import { Types } from 'mongoose';
import { Staff } from '../models/staff.model';
import { isAccessSessionCurrent } from '../services/access-session.service';

describe('access session authorization version', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects malformed staff identities without querying MongoDB', async () => {
    const exists = jest.spyOn(Staff, 'exists');

    await expect(isAccessSessionCurrent({ staffId: 'not-an-object-id' })).resolves.toBe(false);
    expect(exists).not.toHaveBeenCalled();
  });

  it('accepts a token only when its authorization version is current', async () => {
    const staffId = new Types.ObjectId().toString();
    const exists = jest.spyOn(Staff, 'exists').mockResolvedValue({ _id: staffId } as never);

    await expect(isAccessSessionCurrent({ staffId, authVersion: 3 })).resolves.toBe(true);
    expect(exists).toHaveBeenCalledWith({
      _id: new Types.ObjectId(staffId),
      auth_version: 3,
    });
  });

  it('rejects deleted staff or a stale authorization version', async () => {
    jest.spyOn(Staff, 'exists').mockResolvedValue(null);

    await expect(isAccessSessionCurrent({
      staffId: new Types.ObjectId().toString(),
      authVersion: 1,
    })).resolves.toBe(false);
  });
});
