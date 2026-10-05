import {
  createReplyDraft,
  getDashboard,
  setApprovalRequired,
  setAutoReply
} from '../../../lib/agent-service';

export async function GET() {
  return Response.json(getDashboard());
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (body.action === 'set_auto_reply') {
      return Response.json({ ok: true, status: setAutoReply(body.enabled) });
    }
    if (body.action === 'set_approval_required') {
      return Response.json({ ok: true, status: setApprovalRequired(body.enabled) });
    }
    if (body.action === 'draft_reply') {
      return Response.json({ ok: true, draft: createReplyDraft(body) });
    }
    return Response.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error.message || 'Request failed' }, { status: 500 });
  }
}
