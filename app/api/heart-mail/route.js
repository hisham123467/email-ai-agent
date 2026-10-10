import { generateNeuralReply } from '../../../lib/heart-neural';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SUPABASE_REST = 'https://luptphcutecxkxvoijfc.supabase.co/rest/v1/rpc';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

function clean(text='') {
  return String(text).replace(/\r/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
}

function lastIncoming(context='') {
  const parts = clean(context).split(/\n\s*---\s*\n/).filter(Boolean);
  return parts[parts.length - 1] || clean(context);
}

function detectImportant(subject, body) {
  const text = (subject + ' ' + body).toLowerCase();
  const patterns = [
    ['payment', /\b(payment|paid|pay|invoice|bank|jazzcash|easypaisa|refund|account number|transfer)\b/i],
    ['pricing', /\b(price|pricing|quote|discount|cost|budget|rate)\b/i],
    ['legal', /\b(contract|legal|lawyer|agreement|terms|complaint|dispute)\b/i],
    ['security', /\b(password|otp|verification code|security code|login code)\b/i],
    ['urgent', /\b(urgent|important|asap|deadline|immediately)\b/i]
  ];
  for (const [type, regex] of patterns) if (regex.test(text)) return type;
  return '';
}

function sentences(text='') {
  return clean(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s=>s.trim())
    .filter(Boolean);
}

function questions(text='') {
  return sentences(text).filter(s=>s.includes('?')).slice(0,6);
}

function styleFromExamples(matches=[]) {
  const replies = matches.map(m=>String(m.reply||'')).filter(Boolean);
  const signed = replies.some(r=>/best regards,?\s*\n?hisham/i.test(r));
  const casual = replies.some(r=>/^(hi|hey|hello)[!,.]?$/i.test(r.trim()));
  const avg = replies.length ? replies.reduce((n,r)=>n+r.length,0)/replies.length : 0;
  return { signed, casual, avg };
}

function answerQuestion(q) {
  const x = q.toLowerCase();

  if (/\b(when|what time|available|availability|schedule|meeting|call)\b/.test(x)) {
    return "Send me a time that works for you and I’ll confirm it from my side.";
  }
  if (/\b(can you|could you|will you)\b.*\b(send|share|provide)\b/.test(x)) {
    return "Yes, I can help with that. Please confirm exactly what you need me to send.";
  }
  if (/\b(status|update|progress|ready|done|completed)\b/.test(x)) {
    return "I’ve noted this. I’ll check the latest status and update you with the confirmed details.";
  }
  if (/\b(problem|issue|error|not working|failed|broken)\b/.test(x)) {
    return "I can check this. Please send the exact error or a screenshot along with what you were doing when it happened.";
  }
  if (/\b(demo|website|app|project|service|work)\b/.test(x)) {
    return "Yes, I can discuss that with you. Send me the exact requirement and I’ll reply with the next steps.";
  }
  if (/\b(where|which|what)\b/.test(x)) {
    return "I want to give you the correct information, so I’ll confirm that detail before I answer.";
  }
  if (/\bwhy|how\b/.test(x)) {
    return "I’ve understood the question. I’ll confirm the relevant details and give you the correct answer rather than guess.";
  }
  return "I’ve noted your question and I’ll confirm the correct details for you.";
}

function detectReplyIntents(body='') {
  const text = String(body || '').toLowerCase();
  const intents = [];

  if (/\b(problem|issue|error|not working|failed|fails|broken|bug|overlap|overlaps)\b/i.test(text)) {
    intents.push('issue');
  }
  if (/\b(call|meeting|meet|schedule|available|availability)\b/i.test(text)) {
    intents.push('call');
  }
  if (/\b(next steps?|before launch|launch plan|what happens next|proceed)\b/i.test(text)) {
    intents.push('next_steps');
  }
  if (/\b(send|share|provide)\b/i.test(text) && /\b(demo|file|document|link|details?|information|access)\b/i.test(text)) {
    intents.push('send');
  }
  if (/\b(status|update|progress|ready|done|completed)\b/i.test(text)) {
    intents.push('status');
  }

  return [...new Set(intents)];
}

function generateReply({ senderName, subject, context, matches }) {
  const body = lastIncoming(context);
  const bodyLower = body.toLowerCase().replace(/[.!?]+$/g,'').trim();
  const name = clean(senderName || '').split(' ')[0] || 'there';

  if (/^(hi|hello|hey|hi hisham|hello hisham|hey hisham)$/.test(bodyLower)) {
    return { reply: 'Hi!', confidence: 0.99, mode: 'quick' };
  }
  if (/^(thanks|thank you|thankyou|thx|ty)$/.test(bodyLower)) {
    return { reply: "You’re welcome!", confidence: 0.99, mode: 'quick' };
  }
  if (/\bhow are you\b/.test(bodyLower) && bodyLower.length < 100) {
    return { reply: "Hi! I’m good, thanks for asking. How are you?", confidence: 0.98, mode: 'quick' };
  }
  if (/^(ok|okay|alright|got it|sounds good|perfect)$/.test(bodyLower)) {
    return { reply: 'Sounds good!', confidence: 0.98, mode: 'quick' };
  }

  const qs = questions(body);
  const intents = detectReplyIntents(body);
  const style = styleFromExamples(matches);
  const lines = [];
  const greeting = /^hi\b|^hello\b|^hey\b/i.test(body) ? 'Hi!' : 'Hi ' + name + ',';
  lines.push(greeting, '');

  if (/\b(thank|thanks|appreciate)\b/i.test(body)) {
    lines.push('Thanks for the message.');
  } else if (/\b(update|following up|follow up)\b/i.test(body)) {
    lines.push('Thanks for the update.');
  } else {
    lines.push('Thanks for reaching out.');
  }

  const answers = [];

  if (intents.includes('issue')) {
    answers.push('For the issues you mentioned, please send me the exact error or screenshots and the steps that reproduce them. I’ll review both and confirm what needs to be fixed.');
  }
  if (intents.includes('send')) {
    answers.push('I can send that. Please confirm exactly which file, link, demo, or details you need.');
  }
  if (intents.includes('call')) {
    answers.push('For the call, send me a couple of times that work for you and I’ll confirm one after I’ve reviewed the details.');
  }
  if (intents.includes('status')) {
    answers.push('I’ll check the latest status and update you with the confirmed details.');
  }
  if (intents.includes('next_steps')) {
    answers.push('Once I’ve reviewed everything, I’ll confirm the required fixes and the next steps before we proceed.');
  }

  if (!answers.length && qs.length) {
    qs.forEach((q) => answers.push(answerQuestion(q)));
  }

  if (answers.length) {
    lines.push('');
    if (answers.length === 1) {
      lines.push(answers[0]);
    } else {
      answers.forEach((answer, i) => lines.push(String(i + 1) + '. ' + answer));
    }
  } else if (/\b(demo|project|website|app|service)\b/i.test(body)) {
    lines.push('', 'I’ve understood the request. Send me any remaining requirement or example you want me to follow and I’ll take it from there.');
  } else {
    lines.push('', 'I’ve seen your message and I’ll follow up with the relevant details.');
  }

  const confidence =
    answers.length || qs.length || /\b(demo|project|website|app|service|update)\b/i.test(body)
      ? 0.82
      : 0.58;

  if (style.signed || lines.join('\n').length > 130) {
    lines.push('', 'Best regards,', 'Hisham');
  }

  return {
    reply: lines.join('\n').trim(),
    confidence,
    mode: matches.length ? 'learned-rules' : 'rules'
  };
}

function unsupportedSpecifics(reply='', context='') {
  const source = String(context || '').toLowerCase();
  const output = String(reply || '').toLowerCase();

  const moneyPatterns = [
    /(?:pkr|rs\.?|usd|aed|eur|gbp|\$|€|£)\s*[\d,.]+/gi,
    /[\d,.]+\s*(?:pkr|rupees?|dollars?|dirhams?|usd|aed|eur|gbp)/gi
  ];

  for (const pattern of moneyPatterns) {
    const values = output.match(pattern) || [];
    for (const value of values) {
      if (!source.includes(value.toLowerCase().replace(/\s+/g, ' '))) return true;
    }
  }

  const specificNumbers = output.match(/\b\d{2,}(?:[.,]\d+)?\b/g) || [];
  for (const value of specificNumbers) {
    if (!source.includes(value)) return true;
  }

  return false;
}

function preservesReplyIdentity(reply='', safeDraft='', senderName='') {
  const output = String(reply || '');
  const draft = String(safeDraft || '');
  const sender = String(senderName || '').trim().split(/\s+/)[0].toLowerCase();

  if (/\bbest regards\b/i.test(draft) && !/\bhisham\b/i.test(output)) {
    return false;
  }

  if (sender && sender !== 'hisham') {
    const lower = output.toLowerCase();
    const signoffs = ['best regards', 'kind regards', 'regards', 'sincerely'];

    for (const signoff of signoffs) {
      const index = lower.lastIndexOf(signoff);
      if (index >= 0) {
        const tail = lower.slice(index, index + 120);
        if (tail.includes(sender)) return false;
      }
    }
  }

  if (
    /\b(we tested|i tested|we reviewed|i reviewed|we conducted|i conducted)\b/i.test(output) &&
    !/\b(we tested|i tested|we reviewed|i reviewed|we conducted|i conducted)\b/i.test(draft)
  ) {
    return false;
  }

  return true;
}

function neuralReplyLooksSafe(reply, context) {
  const text = String(reply || '').trim();
  if (!text || text.length < 2 || text.length > 7000) return false;
  if (/\b(as an ai|language model|automation system|system prompt|policy says)\b/i.test(text)) return false;
  if (unsupportedSpecifics(text, context)) return false;
  return true;
}

async function rpc(name, body) {
  const response = await fetch(`${SUPABASE_REST}/${name}`, {
    method:'POST',
    headers:{ apikey: SUPABASE_KEY, 'content-type':'application/json' },
    body:JSON.stringify(body),
    cache:'no-store'
  });
  const data = await response.json().catch(()=>null);
  if (!response.ok) throw new Error(data?.message || 'Database action failed');
  return data;
}

export async function POST(request) {
  const expected = process.env.HEART_MAIL_SECRET || '';
  const received = request.headers.get('x-heart-mail-secret') || '';
  if (!expected || received !== expected) {
    return Response.json({ ok:false, error:'Unauthorized' }, { status:401 });
  }

  const input = await request.json().catch(()=>({}));
  const ownerEmail = clean(input.ownerEmail).toLowerCase();
  const senderName = clean(input.senderName);
  const senderEmail = clean(input.senderEmail).toLowerCase();
  const subject = clean(input.subject || '(No subject)');
  const context = clean(input.context).slice(-24000);

  if (!ownerEmail || !context) {
    return Response.json({ ok:false, error:'Missing email context' }, { status:400 });
  }

  const importantType = detectImportant(subject, context);
  const training = await rpc('email_ai_training_matches', {
    p_secret: expected,
    p_owner_email: ownerEmail,
    p_context: context,
    p_limit: 4
  }).catch(()=>({ matches:[] }));

  const matches = Array.isArray(training?.matches) ? training.matches : [];
  const generated = generateReply({ senderName, senderEmail, subject, context, matches });

  let finalReply = generated.reply;
  let model = 'heart-mail-0.1-rules';
  let mode = generated.mode;
  let confidence = generated.confidence;
  let neural = false;
  let neuralError = null;

  if (generated.mode !== 'quick') {
    try {
      const result = await generateNeuralReply({
        safeDraft: generated.reply,
        examples: matches
      });

      if (
        neuralReplyLooksSafe(result.reply, context) &&
        preservesReplyIdentity(result.reply, generated.reply, senderName)
      ) {
        finalReply = result.reply;
        model = result.model;
        mode = matches.length ? 'neural+retrieval' : 'neural';
        confidence = matches.length ? 0.88 : 0.8;
        neural = true;
      } else {
        neuralError = 'Neural reply failed safety validation';
      }
    } catch (error) {
      neuralError = error instanceof Error ? error.message : 'Neural model unavailable';
    }
  }

  const approvalRequired =
    Boolean(importantType) ||
    confidence < 0.65 ||
    unsupportedSpecifics(finalReply, context);

  return Response.json({
    ok:true,
    model,
    mode,
    neural,
    reply:finalReply,
    confidence,
    importantType:importantType || null,
    approvalRequired,
    trainingMatches:matches.length,
    fallbackUsed:Boolean(neuralError),
    fallbackReason:neuralError
  }, { headers:{'Cache-Control':'no-store'} });
}
