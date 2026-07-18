import { Types } from 'mongoose';
import { Staff } from '../models/staff.model';

interface AccessSessionIdentity {
  staffId: string;
  authVersion?: number;
}

/**
 * Access tokens are accepted only while their staff record still exists and
 * its authorization version matches. Version zero also supports records
 * created before the field was introduced.
 */
export async function isAccessSessionCurrent(identity: AccessSessionIdentity): Promise<boolean> {
  if (!Types.ObjectId.isValid(identity.staffId)) return false;

  const authVersion = Number.isSafeInteger(identity.authVersion) && identity.authVersion! >= 0
    ? identity.authVersion!
    : 0;
  const versionCondition = authVersion === 0
    ? { $or: [{ auth_version: 0 }, { auth_version: { $exists: false } }] }
    : { auth_version: authVersion };

  const staff = await Staff.exists({
    _id: new Types.ObjectId(identity.staffId),
    ...versionCondition,
  });
  return staff !== null;
}
