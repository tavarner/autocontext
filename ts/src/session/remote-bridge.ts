/**
 * Remote mission bridge with delegated approval relay (AC-514 TS parity).
 */

import { randomUUID } from "node:crypto";

export const SessionRole = { VIEWER: "viewer", CONTROLLER: "controller" } as const;
export type SessionRole = (typeof SessionRole)[keyof typeof SessionRole];

export class RemoteSession {
  readonly remoteSessionId: string;
  readonly sessionId: string;
  readonly operator: string;
  readonly role: SessionRole;

  private constructor(sessionId: string, operator: string, role: SessionRole) {
    this.remoteSessionId = randomUUID().slice(0, 12);
    this.sessionId = sessionId;
    this.operator = operator;
    this.role = role;
  }

  static create(opts: { sessionId: string; operator: string; role: SessionRole }): RemoteSession {
    return new RemoteSession(opts.sessionId, opts.operator, opts.role);
  }

  get canApprove(): boolean { return this.role === SessionRole.CONTROLLER; }
  get canControl(): boolean { return this.role === SessionRole.CONTROLLER; }
}

export class ApprovalRequest {
  readonly requestId: string;
  readonly action: string;
  status: string = "pending";
  decidedBy: string = "";
  denialReason: string = "";

  private constructor(action: string) {
    this.requestId = randomUUID().slice(0, 12);
    this.action = action;
  }

  static create(action: string): ApprovalRequest { return new ApprovalRequest(action); }

  approve(by: string): void { this.status = "approved"; this.decidedBy = by; }
  deny(by: string, reason: string = ""): void { this.status = "denied"; this.decidedBy = by; this.denialReason = reason; }
  timeout(): void { this.status = "timed_out"; }
}

export class RemoteBridge {
  readonly missionId: string;
  private sessions = new Map<string, RemoteSession>();
  private approvals = new Map<string, ApprovalRequest>();

  constructor(missionId: string) { this.missionId = missionId; }

  connect(operator: string, role: SessionRole): RemoteSession {
    const session = RemoteSession.create({ sessionId: this.missionId, operator, role });
    this.sessions.set(session.remoteSessionId, session);
    return session;
  }

  disconnect(remoteSessionId: string): void { this.sessions.delete(remoteSessionId); }

  get connectedSessions(): RemoteSession[] { return [...this.sessions.values()]; }

  requestApproval(action: string): ApprovalRequest {
    const req = ApprovalRequest.create(action);
    this.approvals.set(req.requestId, req);
    return req;
  }

  get pendingApprovals(): ApprovalRequest[] {
    return [...this.approvals.values()].filter((a) => a.status === "pending");
  }

  respond(requestId: string, approved: boolean, by: string, reason?: string): void {
    const session = [...this.sessions.values()].find((s) => s.operator === by);
    if (session?.role === SessionRole.VIEWER) {
      throw new Error(`Operator '${by}' is a viewer and cannot respond`);
    }
    const req = this.approvals.get(requestId);
    if (!req) throw new Error(`Approval '${requestId}' not found`);
    if (approved) req.approve(by); else req.deny(by, reason ?? "");
  }
}
