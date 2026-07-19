import { Injectable, inject } from '@angular/core';
import { authStore } from '../../../store/auth.store';
import { SocketConnectionService } from './socket-connection.service';
import { KdsSocketService } from './kds-socket.service';

@Injectable({ providedIn: 'root' })
export class PosSocketService {
  private readonly connection = inject(SocketConnectionService);
  private readonly kds = inject(KdsSocketService);
  private currentPosSessionId: string | null = null;

  constructor() {
    this.connection.registerReconnectHandler((socket) => {
      if (this.currentPosSessionId) {
        socket.emit('pos:join', this.currentPosSessionId);
      }
    });
  }

  /**
   * Join a session with permission verification.
   * @param sessionId - The session ID to join
   * @param sessionType - Optional specific session type to join. If not provided, joins all types the user has permission for.
   */
  joinSession(sessionId: string, sessionType?: 'TOTEM' | 'KDS' | 'TAS' | 'POS'): void {
    const userPermissions = authStore.user()?.permissions || [];
    if (sessionType === 'POS') {
      const requiredPermission = this.getRequiredPermission('POS');
      if (requiredPermission
        && !userPermissions.includes(requiredPermission)
        && !userPermissions.includes('ADMIN')) return;
      if (this.currentPosSessionId === sessionId) return;
      const previousSessionId = this.currentPosSessionId;
      this.currentPosSessionId = sessionId;
      if (!this.connection.isConnected()) return;
      if (previousSessionId) this.connection.emit('pos:leave', previousSessionId);
      this.connection.emit('pos:join', sessionId);
      return;
    }

    if (!this.connection.isConnected()) {
      return;
    }

    if (sessionType) {
      // Join specific session type with permission check
      const requiredPermission = this.getRequiredPermission(sessionType);
      if (requiredPermission
        && !userPermissions.includes(requiredPermission)
        && !userPermissions.includes('ADMIN')) {
        return;
      }

      switch (sessionType) {
        case 'KDS':
          this.kds.joinKdsSession(sessionId);
          break;
        case 'TAS':
          this.connection.emit('tas:join', sessionId);
          break;
        case 'TOTEM':
          // Totem sessions use a different method
          break;
      }
    } else {
      // Legacy mode: join all session types the user has permission for
      const posPermission = this.getRequiredPermission('POS');
      const kdsPermission = this.getRequiredPermission('KDS');
      const tasPermission = this.getRequiredPermission('TAS');

      if (!posPermission || userPermissions.includes(posPermission)) {
        this.connection.emit('pos:join', sessionId);
      }

      if (!kdsPermission || userPermissions.includes(kdsPermission)) {
        this.kds.joinKdsSession(sessionId);
      }

      if (!tasPermission || userPermissions.includes(tasPermission)) {
        this.connection.emit('tas:join', sessionId);
      }
    }
  }

  /**
   * Get the required permission for a given session type.
   */
  private getRequiredPermission(sessionType: string): string | null {
    switch (sessionType) {
      case 'KDS': return 'KTS';
      case 'TOTEM': return null;
      case 'TAS': return 'TAS';
      case 'POS': return 'POS';
      default: return null;
    }
  }

  leaveSession(sessionId: string): void {
    if (this.connection.isConnected()) {
      this.connection.emit('pos:leave', sessionId);
      this.connection.emit('tas:leave', sessionId);
    }
    if (this.currentPosSessionId === sessionId) this.currentPosSessionId = null;
  }
}
