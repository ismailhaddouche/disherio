export interface SocketJoinAckResult {
  success: boolean;
  error?: string;
}

export type SocketJoinAcknowledge = (result: SocketJoinAckResult) => void;

export function acknowledgeJoinSuccess(acknowledge?: SocketJoinAcknowledge): void {
  acknowledge?.({ success: true });
}

export function acknowledgeJoinFailure(
  acknowledge: SocketJoinAcknowledge | undefined,
  error: string
): void {
  acknowledge?.({ success: false, error });
}
