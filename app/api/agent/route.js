import {
  addRule,
  createReplyDraft,
  deleteRule,
  getDashboard,
  setApprovalRequired,
  setAutoReply,
  toggleRule
} from '../../../lib/agent-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(getDashboard(), {
    headers: { 'Cache-Control': 'no-store' }
  });
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

    if (body.action === 'add_rule') {
      return Response.json({ ok: true, rule: addRule(body) });
    }

    if (body.action === 'toggle_rule') {
      return Response.json({ ok: true, rule: toggleRule(body) });
    }

    if (body.action === 'delete_rule') {
      return Response.json({ ok: true, rule: deleteRule(body) });
    }

    return Response.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    );
  }
}
