import { describe, expect, it } from "vitest";
import { RemoteBridge, RemoteSession, ApprovalRequest, SessionRole } from "../src/session/remote-bridge.js";

describe("RemoteSession", () => {
  it("viewer cannot approve", () => {
    const s = RemoteSession.create({ sessionId: "s1", operator: "alice", role: SessionRole.VIEWER });
    expect(s.canApprove).toBe(false);
  });

  it("controller can approve", () => {
    const s = RemoteSession.create({ sessionId: "s1", operator: "bob", role: SessionRole.CONTROLLER });
    expect(s.canApprove).toBe(true);
  });
});

describe("ApprovalRequest", () => {
  it("approve flow", () => {
    const r = ApprovalRequest.create("deploy");
    expect(r.status).toBe("pending");
    r.approve("bob");
    expect(r.status).toBe("approved");
    expect(r.decidedBy).toBe("bob");
  });

  it("deny flow", () => {
    const r = ApprovalRequest.create("deploy");
    r.deny("alice", "Not ready");
    expect(r.status).toBe("denied");
    expect(r.denialReason).toBe("Not ready");
  });

  it("timeout", () => {
    const r = ApprovalRequest.create("deploy");
    r.timeout();
    expect(r.status).toBe("timed_out");
  });

  it("decision is terminal", () => {
    const r = ApprovalRequest.create("deploy");
    r.approve("bob");
    expect(() => r.deny("bob", "changed")).toThrow("status=approved");
  });
});

describe("RemoteBridge", () => {
  it("connects observer", () => {
    const bridge = new RemoteBridge("m1");
    bridge.connect("alice", SessionRole.VIEWER);
    expect(bridge.connectedSessions).toHaveLength(1);
  });

  it("routes approval to controllers", () => {
    const bridge = new RemoteBridge("m1");
    bridge.connect("bob", SessionRole.CONTROLLER);
    const req = bridge.requestApproval("deploy");
    expect(bridge.pendingApprovals).toHaveLength(1);
    bridge.respond(req.requestId, true, "bob");
    expect(req.status).toBe("approved");
    expect(bridge.pendingApprovals).toHaveLength(0);
  });

  it("viewer cannot respond", () => {
    const bridge = new RemoteBridge("m1");
    bridge.connect("alice", SessionRole.VIEWER);
    const req = bridge.requestApproval("deploy");
    expect(() => bridge.respond(req.requestId, true, "alice")).toThrow("viewer");
  });

  it("unconnected operator cannot respond", () => {
    const bridge = new RemoteBridge("m1");
    bridge.connect("alice", SessionRole.VIEWER);
    const req = bridge.requestApproval("deploy");
    expect(() => bridge.respond(req.requestId, true, "mallory")).toThrow("not connected");
  });

  it("disconnect removes session", () => {
    const bridge = new RemoteBridge("m1");
    const session = bridge.connect("alice", SessionRole.VIEWER);
    bridge.disconnect(session.remoteSessionId);
    expect(bridge.connectedSessions).toHaveLength(0);
  });
});
