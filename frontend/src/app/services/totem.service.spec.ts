import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TotemService, CreateTotemRequest, UpdateTotemRequest } from './totem.service';
import { environment } from '../../environments/environment';
import type { Totem } from '../types';

describe('TotemService', () => {
  let service: TotemService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/totems`;

  const createMockTotem = (overrides: Partial<Totem> = {}): Totem => ({
    _id: '1',
    restaurant_id: 'rest1',
    totem_name: 'Mesa 1',
    totem_qr: 'qr-code-1',
    totem_type: 'STANDARD',
    ...overrides
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [TotemService]
    });
    service = TestBed.inject(TotemService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getTotems', () => {
    it('should return an array of totems', () => {
      const mockTotems: Totem[] = [
        createMockTotem({ _id: '1', totem_name: 'Mesa 1', totem_type: 'STANDARD' }),
        createMockTotem({ 
          _id: '2', 
          totem_name: 'Evento Especial', 
          totem_type: 'TEMPORARY',
          totem_start_date: new Date().toISOString()
        })
      ];

      service.getTotems().subscribe(totems => {
        expect(totems).toEqual(mockTotems);
        expect(totems.length).toBe(2);
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockTotems);
    });

    it('should return empty array when no totems', () => {
      service.getTotems().subscribe(totems => {
        expect(totems).toEqual([]);
        expect(totems.length).toBe(0);
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush([]);
    });

    it('should handle error response', () => {
      service.getTotems().subscribe({
        error: (error) => {
          expect(error.status).toBe(500);
        }
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('getTotem', () => {
    it('should return a single totem by id', () => {
      const totemId = '1';
      const mockTotem = createMockTotem({ _id: totemId, totem_name: 'Mesa 1' });

      service.getTotem(totemId).subscribe(totem => {
        expect(totem).toEqual(mockTotem);
        expect(totem._id).toBe(totemId);
      });

      const req = httpMock.expectOne(`${apiUrl}/${totemId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockTotem);
    });

    it('should handle 404 when totem not found', () => {
      const totemId = 'nonexistent';

      service.getTotem(totemId).subscribe({
        error: (error) => {
          expect(error.status).toBe(404);
        }
      });

      const req = httpMock.expectOne(`${apiUrl}/${totemId}`);
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('createTotem', () => {
    it('should create a new standard totem', () => {
      const createData: CreateTotemRequest = {
        totem_name: 'Nueva Mesa',
        totem_type: 'STANDARD'
      };
      const mockResponse = createMockTotem({
        _id: '3',
        totem_name: createData.totem_name,
        totem_type: createData.totem_type
      });

      service.createTotem(createData).subscribe(totem => {
        expect(totem.totem_name).toBe(createData.totem_name);
        expect(totem.totem_type).toBe(createData.totem_type);
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createData);
      req.flush(mockResponse);
    });

    it('should create a temporary totem with start date', () => {
      const startDate = new Date().toISOString();
      const createData: CreateTotemRequest = {
        totem_name: 'Evento Temporal',
        totem_type: 'TEMPORARY',
        totem_start_date: startDate
      };
      const mockResponse = createMockTotem({
        _id: '4',
        ...createData
      });

      service.createTotem(createData).subscribe(totem => {
        expect(totem.totem_type).toBe('TEMPORARY');
        expect(totem.totem_start_date).toBe(startDate);
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('POST');
      req.flush(mockResponse);
    });

    it('should handle validation error on create', () => {
      const createData: CreateTotemRequest = {
        totem_name: '',
        totem_type: 'STANDARD'
      };

      service.createTotem(createData).subscribe({
        error: (error) => {
          expect(error.status).toBe(400);
        }
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush('Validation error', { status: 400, statusText: 'Bad Request' });
    });
  });

  describe('updateTotem', () => {
    it('should update totem name', () => {
      const totemId = '1';
      const updateData: UpdateTotemRequest = {
        totem_name: 'Mesa Actualizada'
      };
      const mockResponse = createMockTotem({
        _id: totemId,
        totem_name: updateData.totem_name
      });

      service.updateTotem(totemId, updateData).subscribe(totem => {
        expect(totem.totem_name).toBe(updateData.totem_name);
      });

      const req = httpMock.expectOne(`${apiUrl}/${totemId}`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(updateData);
      req.flush(mockResponse);
    });

    it('should update multiple fields', () => {
      const totemId = '1';
      const updateData: UpdateTotemRequest = {
        totem_name: 'Mesa Renombrada',
        totem_type: 'TEMPORARY',
        totem_start_date: new Date().toISOString()
      };

      service.updateTotem(totemId, updateData).subscribe(totem => {
        expect(totem.totem_name).toBe(updateData.totem_name);
        expect(totem.totem_type).toBe(updateData.totem_type);
      });

      const req = httpMock.expectOne(`${apiUrl}/${totemId}`);
      expect(req.request.method).toBe('PATCH');
      req.flush(createMockTotem({ _id: totemId, ...updateData }));
    });
  });

  describe('deleteTotem', () => {
    it('should delete a totem', () => {
      const totemId = '1';

      service.deleteTotem(totemId).subscribe(response => {
        // HTTP DELETE returns null on success
        expect(response).toBeNull();
      });

      const req = httpMock.expectOne(`${apiUrl}/${totemId}`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });

    it('should handle 403 when deleting totem with active session', () => {
      const totemId = '1';

      service.deleteTotem(totemId).subscribe({
        error: (error) => {
          expect(error.status).toBe(403);
        }
      });

      const req = httpMock.expectOne(`${apiUrl}/${totemId}`);
      req.flush('Cannot delete totem with active session', { status: 403, statusText: 'Forbidden' });
    });
  });

  describe('regenerateQr', () => {
    it('should regenerate QR code', () => {
      const totemId = '1';
      const mockResponse = { qr: 'new-regenerated-qr-code' };

      service.regenerateQr(totemId).subscribe(response => {
        expect(response.qr).toBe(mockResponse.qr);
      });

      const req = httpMock.expectOne(`${apiUrl}/${totemId}/regenerate-qr`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({});
      req.flush(mockResponse);
    });

    it('should handle error when regenerating QR', () => {
      const totemId = '1';

      service.regenerateQr(totemId).subscribe({
        error: (error) => {
          expect(error.status).toBe(500);
        }
      });

      const req = httpMock.expectOne(`${apiUrl}/${totemId}/regenerate-qr`);
      req.flush('QR generation failed', { status: 500, statusText: 'Internal Server Error' });
    });
  });
});
