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
  const style = styleFromExamples(matches);
  const lines = [];
  const greeting = /^hi\b|^hello\b|^hey\b/i.test(body) ? 'Hi!' : `Hi ${name},`;
  lines.push(greeting, '');

  if (/\b(thank|thanks|appreciate)\b/i.test(body)) {
    lines.push('Thanks for the message.');
  } else if (/\b(update|following up|follow up)\b/i.test(body)) {
    lines.push('Thanks for the update.');
  } else {
    lines.push('Thanks for reaching out.');
  }

  if (qs.length) {
    lines.push('');
    if (qs.length === 1) {
      lines.push(answerQuestion(qs[0]));
    } else {
      qs.forEach((q,i)=> {
        lines.push(`${i+1}. ${answerQuestion(q)}`);
      });
    }
  } else if (/\b(issue|problem|error|not working|failed)\b/i.test(body)) {
    lines.push('', 'I can check this. Please send the exact error or a screenshot and I’ll look into it.');
  } else if (/\b(demo|project|website|app|service)\b/i.test(body)) {
    lines.push('', 'I’ve understood the request. Send me any remaining requirement or example you want me to follow and I’ll take it from there.');
  } else {
    lines.push('', 'I’ve seen your message and I’ll follow up with the relevant details.');
  }

  const confidence = qs.length || /\b(issue|problem|error|demo|project|website|app|service|update)\b/i.test(body) ? 0.78 : 0.58;
  if (style.signed || lines.join('\n').length > 130) {
    lines.push('', 'Best regards,', 'Hisham');
  }

  return { reply: lines.join('\n').trim(), confidence, mode: matches.length ? 'learned-rules' : 'rules' };
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

  const approvalRequired = Boolean(importantType) || generated.confidence < 0.65;

  return Response.json({
    ok:true,
    model:'heart-mail-0.1',
    mode:generated.mode,
    reply:generated.reply,
    confidence:generated.confidence,
    importantType:importantType || null,
    approvalRequired,
    trainingMatches:matches.length
  }, { headers:{'Cache-Control':'no-store'} });
}
