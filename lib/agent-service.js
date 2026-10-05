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

const defaultRules = [
  { id: 'rule_1', name: 'Payment emails', instruction: 'Always require approval before replying to payment-related emails.', enabled: true },
  { id: 'rule_2', name: 'Professional tone', instruction: 'Keep client replies concise, clear and professional.', enabled: true }
];

const state = globalThis.__EMAIL_AI_AGENT_STATE__ || {
  gmailConnected: false,
  autoReply: false,
  approvalRequired: true,
  mode: 'development',
  inbox: demoInbox,
  rules: defaultRules,
  activity: [
    { id: 'a1', text: 'Email AI Agent V1 initialized', time: 'Just now', actor: 'system' },
    { id: 'a2', text: 'ChatGPT MCP endpoint enabled', time: 'Just now', actor: 'system' }
  ]
};

globalThis.__EMAIL_AI_AGENT_STATE__ = state;

function log(text, actor = 'dashboard') {
  state.activity.unshift({
    id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    text,
    time: 'Just now',
    actor
  });
  state.activity = state.activity.slice(0, 50);
}

export function getAgentStatus() {
  const gmailOAuthConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );

  return {
    gmailConnected: state.gmailConnected,
    gmailOAuthConfigured,
    autoReply: state.autoReply,
    approvalRequired: state.approvalRequired,
    mode: state.mode,
    mcpReady: true,
    database: 'development-memory',
    nextStep: state.gmailConnected
      ? 'Configure AI rules'
      : gmailOAuthConfigured
        ? 'Authorize Gmail'
        : 'Add Gmail OAuth credentials'
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
    rules: state.rules,
    activity: state.activity
  };
}

export function setAutoReply(enabled) {
  state.autoReply = Boolean(enabled);
  log(`Auto reply turned ${state.autoReply ? 'ON' : 'OFF'}`);
  return getAgentStatus();
}

export function setApprovalRequired(enabled) {
  state.approvalRequired = Boolean(enabled);
  log(`Approval requirement turned ${state.approvalRequired ? 'ON' : 'OFF'}`);
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

  log(`Draft prepared for ${message.name}`);
  return draft;
}

export function addRule({ name, instruction }) {
  if (!name?.trim() || !instruction?.trim()) throw new Error('Rule name and instruction are required');

  const rule = {
    id: `rule_${Date.now()}`,
    name: name.trim(),
    instruction: instruction.trim(),
    enabled: true
  };
  state.rules.unshift(rule);
  log(`AI rule added: ${rule.name}`);
  return rule;
}

export function toggleRule({ ruleId, enabled }) {
  const rule = state.rules.find((item) => item.id === ruleId);
  if (!rule) throw new Error('Rule not found');
  rule.enabled = Boolean(enabled);
  log(`AI rule ${rule.enabled ? 'enabled' : 'disabled'}: ${rule.name}`);
  return rule;
}

export function deleteRule({ ruleId }) {
  const index = state.rules.findIndex((item) => item.id === ruleId);
  if (index === -1) throw new Error('Rule not found');
  const [removed] = state.rules.splice(index, 1);
  log(`AI rule deleted: ${removed.name}`);
  return removed;
}

export function sendReply({ messageId, body }) {
  if (!state.gmailConnected) {
    return {
      ok: false,
      code: 'GMAIL_NOT_CONNECTED',
      message: 'Gmail OAuth is not connected yet. Connect Gmail before sending.'
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

  log(`Reply sent to ${message.name}`);
  return { ok: true, messageId, body };
}
