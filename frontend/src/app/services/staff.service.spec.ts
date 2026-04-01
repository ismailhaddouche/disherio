import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { StaffService, CreateStaffRequest, UpdateStaffRequest } from './staff.service';
import { environment } from '../../environments/environment';
import type { Staff, Role } from '../types';

describe('StaffService', () => {
  let service: StaffService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/staff`;

  const createMockStaff = (overrides: Partial<Staff> = {}): Staff => ({
    _id: '1',
    restaurant_id: 'rest1',
    staff_name: 'Juan Pérez',
    username: 'juan.perez',
    role_id: 'role1',
    ...overrides
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [StaffService]
    });
    service = TestBed.inject(StaffService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getStaff', () => {
    it('should return array of staff members', () => {
      const mockStaff: Staff[] = [
        createMockStaff({ _id: '1', staff_name: 'Juan Pérez', username: 'juan.perez' }),
        createMockStaff({ _id: '2', staff_name: 'María García', username: 'maria.garcia', role_id: 'role2' })
      ];

      service.getStaff().subscribe(staff => {
        expect(staff).toEqual(mockStaff);
        expect(staff.length).toBe(2);
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('GET');
      req.flush({ data: mockStaff });
    });

    it('should return empty array when no staff', () => {
      service.getStaff().subscribe(staff => {
        expect(staff).toEqual([]);
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush({ data: [] });
    });

    it('should handle server error', () => {
      service.getStaff().subscribe({
        error: (error) => {
          expect(error.status).toBe(500);
        }
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('getStaffMember', () => {
    it('should return a single staff member', () => {
      const staffId = '1';
      const mockStaff = createMockStaff({ _id: staffId, staff_name: 'Juan Pérez' });

      service.getStaffMember(staffId).subscribe(staff => {
        expect(staff).toEqual(mockStaff);
        expect(staff._id).toBe(staffId);
      });

      const req = httpMock.expectOne(`${apiUrl}/${staffId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStaff);
    });

    it('should handle 404 when staff not found', () => {
      const staffId = 'nonexistent';

      service.getStaffMember(staffId).subscribe({
        error: (error) => {
          expect(error.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`${apiUrl}/${staffId}`);
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('createStaff', () => {
    it('should create a new staff member', () => {
      const createData: CreateStaffRequest = {
        staff_name: 'Nuevo Empleado',
        username: 'nuevo.empleado',
        password: 'password123',
        pin_code: '9999',
        role_id: 'role1'
      };
      const mockResponse = createMockStaff({
        _id: '3',
        staff_name: createData.staff_name,
        username: createData.username
      });

      service.createStaff(createData).subscribe(staff => {
        expect(staff.staff_name).toBe(createData.staff_name);
        expect(staff.username).toBe(createData.username);
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createData);
      req.flush(mockResponse);
    });

    it('should handle validation error on create', () => {
      const createData: CreateStaffRequest = {
        staff_name: '',
        username: 'invalid',
        password: '123',
        pin_code: '99',
        role_id: 'role1'
      };

      service.createStaff(createData).subscribe({
        error: (error) => {
          expect(error.status).toBe(400);
        }
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush('Validation error', { status: 400, statusText: 'Bad Request' });
    });

    it('should handle duplicate username error', () => {
      const createData: CreateStaffRequest = {
        staff_name: 'Usuario Duplicado',
        username: 'existing.user',
        password: 'password123',
        pin_code: '1234',
        role_id: 'role1'
      };

      service.createStaff(createData).subscribe({
        error: (error) => {
          expect(error.status).toBe(409);
        }
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush('Username already exists', { status: 409, statusText: 'Conflict' });
    });
  });

  describe('updateStaff', () => {
    it('should update staff member name', () => {
      const staffId = '1';
      const updateData: UpdateStaffRequest = {
        staff_name: 'Nombre Actualizado'
      };
      const mockResponse = createMockStaff({
        _id: staffId,
        staff_name: updateData.staff_name
      });

      service.updateStaff(staffId, updateData).subscribe(staff => {
        expect(staff.staff_name).toBe(updateData.staff_name);
      });

      const req = httpMock.expectOne(`${apiUrl}/${staffId}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateData);
      req.flush(mockResponse);
    });

    it('should update staff member role', () => {
      const staffId = '1';
      const updateData: UpdateStaffRequest = {
        role_id: 'newRoleId'
      };

      service.updateStaff(staffId, updateData).subscribe(staff => {
        expect(staff.role_id).toBe(updateData.role_id);
      });

      const req = httpMock.expectOne(`${apiUrl}/${staffId}`);
      req.flush(createMockStaff({ _id: staffId, role_id: 'newRoleId' }));
    });

    it('should update password and pin', () => {
      const staffId = '1';
      const updateData: UpdateStaffRequest = {
        password: 'newPassword123',
        pin_code: '9876'
      };

      service.updateStaff(staffId, updateData).subscribe(staff => {
        expect(staff._id).toBe(staffId);
      });

      const req = httpMock.expectOne(`${apiUrl}/${staffId}`);
      expect(req.request.body).toEqual(updateData);
      req.flush(createMockStaff({ _id: staffId }));
    });
  });

  describe('deleteStaff', () => {
    it('should delete a staff member', () => {
      const staffId = '1';

      service.deleteStaff(staffId).subscribe(response => {
        // HTTP DELETE returns null on success
        expect(response).toBeNull();
      });

      const req = httpMock.expectOne(`${apiUrl}/${staffId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should handle 403 when deleting own account', () => {
      const staffId = '1';

      service.deleteStaff(staffId).subscribe({
        error: (error) => {
          expect(error.status).toBe(403);
        }
      });

      const req = httpMock.expectOne(`${apiUrl}/${staffId}`);
      req.flush('Cannot delete your own account', { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('getRoles', () => {
    it('should return all roles', () => {
      const mockRoles: Role[] = [
        {
          _id: 'role1',
          role_name: 'Administrador',
          permissions: ['all']
        } as Role,
        {
          _id: 'role2',
          role_name: 'Camarero',
          permissions: ['orders:read', 'orders:write']
        } as Role
      ];

      service.getRoles().subscribe(roles => {
        expect(roles).toEqual(mockRoles);
        expect(roles.length).toBe(2);
      });

      const req = httpMock.expectOne(`${apiUrl}/roles/all`);
      expect(req.request.method).toBe('GET');
      req.flush(mockRoles);
    });

    it('should handle empty roles', () => {
      service.getRoles().subscribe(roles => {
        expect(roles).toEqual([]);
      });

      const req = httpMock.expectOne(`${apiUrl}/roles/all`);
      req.flush([]);
    });
  });

  describe('createRole', () => {
    it('should create a new role', () => {
      const roleName = 'Nuevo Rol';
      const permissions = ['orders:read', 'orders:write'];
      const mockRole: Role = {
        _id: 'newRoleId',
        role_name: roleName,
        permissions
      } as Role;

      service.createRole(roleName, permissions).subscribe(role => {
        expect(role.role_name).toBe(roleName);
        expect(role.permissions).toEqual(permissions);
      });

      const req = httpMock.expectOne(`${apiUrl}/roles`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ role_name: roleName, permissions });
      req.flush(mockRole);
    });

    it('should create role with empty permissions', () => {
      const roleName = 'Rol sin permisos';
      const permissions: string[] = [];

      service.createRole(roleName, permissions).subscribe(role => {
        expect(role.role_name).toBe(roleName);
        expect(role.permissions).toEqual([]);
      });

      const req = httpMock.expectOne(`${apiUrl}/roles`);
      expect(req.request.body).toEqual({ role_name: roleName, permissions });
      req.flush({
        _id: 'roleId',
        role_name: roleName,
        permissions
      } as Role);
    });
  });
});
