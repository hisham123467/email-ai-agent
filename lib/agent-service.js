const demoInbox = [
  {
    id: 'msg_demo_001',
    from: 'salman@example.com',
    name: 'Salman',
    subject: 'Mobile app demo follow-up',
    preview: 'Can you share the updated demo and confirm the login flow?',
    receivedAt: 'Today, 9:02 AM',
    priority: 'high',
    status: 'needs_reply'
  },
  {
    id: 'msg_demo_002',
    from: 'majid@example.com',
    name: 'Majid',
    subject: 'Invoice dashboard changes',
    preview: 'Please send the revised dashboard when it is ready.',
    receivedAt: 'Yesterday, 6:40 PM',
    priority: 'normal',
    status: 'waiting'
  },
  {
    id: 'msg_demo_003',
    from: 'hello@samplebusiness.com',
    name: 'Sample Business',
    subject: 'Re: Website proposal',
    preview: 'Thanks. What would be the next step and expected delivery process?',
    receivedAt: 'Yesterday, 2:18 PM',
    priority: 'normal',
    status: 'needs_reply'
  }
];

const state = globalThis.__EMAIL_AI_AGENT_STATE__ || {
  gmailConnected: false,
  autoReply: false,
  approvalRequired: true,
  mode: 'development',
  inbox: demoInbox,
  activity: [
    { id: 'a1', text: 'Email AI Agent V1 initialized', time: 'Just now' },
    { id: 'a2', text: 'ChatGPT MCP endpoint enabled', time: 'Just now' }
  ]
};

globalThis.__EMAIL_AI_AGENT_STATE__ = state;

export function getAgentStatus() {
  return {
    gmailConnected: state.gmailConnected,
    autoReply: state.autoReply,
    approvalRequired: state.approvalRequired,
    mode: state.mode,
    mcpReady: true,
    database: 'development-memory',
    nextStep: state.gmailConnected ? 'Configure AI rules' : 'Connect Gmail OAuth'
  };
}

export function getDashboard() {
  const needsReply = state.inbox.filter((m) => m.status === 'needs_reply').length;
  const waiting = state.inbox.filter((m) => m.status === 'waiting').length;
  return {
    status: getAgentStatus(),
    stats: {
      inbox: state.inbox.length,
      needsReply,
      waiting,
      autoReplied: 0
    },
    inbox: state.inbox,
    activity: state.activity
  };
}

export function setAutoReply(enabled) {
  state.autoReply = Boolean(enabled);
  state.activity.unshift({
    id: `a_${Date.now()}`,
    text: `Auto reply turned ${state.autoReply ? 'ON' : 'OFF'}`,
    time: 'Just now'
  });
  return getAgentStatus();
}

export function setApprovalRequired(enabled) {
  state.approvalRequired = Boolean(enabled);
  state.activity.unshift({
    id: `a_${Date.now()}`,
    text: `Approval requirement turned ${state.approvalRequired ? 'ON' : 'OFF'}`,
    time: 'Just now'
  });
  return getAgentStatus();
}

export function listInbox({ limit = 10, status } = {}) {
  let rows = [...state.inbox];
  if (status) rows = rows.filter((m) => m.status === status);
  return rows.slice(0, Math.max(1, Math.min(Number(limit) || 10, 50)));
}

export function createReplyDraft({ messageId, instruction = 'Write a professional concise reply.' }) {
  const message = state.inbox.find((m) => m.id === messageId);
  if (!message) throw new Error('Message not found');
  const draft = {
    id: `draft_${Date.now()}`,
    messageId,
    to: message.from,
    subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}`,
    instruction,
    body: `Hi ${message.name},\n\nThanks for your message. I have received your update and I am reviewing it. I will follow up with the relevant details shortly.\n\nBest regards,\nHisham`,
    status: 'draft_only'
  };
  state.activity.unshift({ id: `a_${Date.now()}`, text: `Draft prepared for ${message.name}`, time: 'Just now' });
  return draft;
}

export function sendReply({ messageId, body }) {
  if (!state.gmailConnected) {
    return {
      ok: false,
      code: 'GMAIL_NOT_CONNECTED',
      message: 'Gmail OAuth is not connected yet. The agent will not send email until Gmail is connected.'
    };
  }
  if (state.approvalRequired) {
    return {
      ok: false,
      code: 'APPROVAL_REQUIRED',
      message: 'This account is configured to require approval before sending.'
    };
  }
  const message = state.inbox.find((m) => m.id === messageId);
  if (!message) throw new Error('Message not found');
  state.activity.unshift({ id: `a_${Date.now()}`, text: `Reply sent to ${message.name}`, time: 'Just now' });
  return { ok: true, messageId, body };
}
