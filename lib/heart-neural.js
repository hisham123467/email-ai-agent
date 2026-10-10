const MODEL_ID = 'onnx-community/SmolLM2-135M-Instruct-ONNX';

let generatorPromise = globalThis.__heartMailGeneratorPromise || null;

function setGlobalPromise(value) {
  generatorPromise = value;
  globalThis.__heartMailGeneratorPromise = value;
}

async function getGenerator() {
  if (generatorPromise) return generatorPromise;

  const promise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');

    env.allowRemoteModels = true;
    env.allowLocalModels = true;
    env.cacheDir = '/tmp/heart-mail-model-cache';

    return pipeline('text-generation', MODEL_ID, {
      dtype: 'int8'
    });
  })();

  setGlobalPromise(promise);

  try {
    return await promise;
  } catch (error) {
    setGlobalPromise(null);
    throw error;
  }
}

function normalizeOutput(output) {
  const generated = output?.[0]?.generated_text;

  if (Array.isArray(generated)) {
    const last = generated.at(-1);
    return String(last?.content || '').trim();
  }

  return String(generated || '').trim();
}

function safeText(value, max = 12000) {
  return String(value || '').replace(/\r/g, '').trim().slice(-max);
}

export async function generateNeuralReply({
  senderName,
  subject,
  context,
  safeDraft,
  examples = []
}) {
  const generator = await getGenerator();

  const exampleText = examples
    .slice(0, 3)
    .map((item, index) => {
      return [
        'Example ' + (index + 1) + ':',
        'Past email: ' + safeText(item.context, 2500),
        'Approved reply: ' + safeText(item.reply, 1200)
      ].join('\n');
    })
    .join('\n\n');

  const messages = [
    {
      role: 'system',
      content:
        "You are Heart Mail, Hisham's private email reply model. " +
        "Write only the final reply body. Sound natural, concise and human. " +
        "Use the provided safe draft as the factual boundary. You may improve wording and directly address the sender's points, " +
        "but NEVER add a price, payment detail, bank detail, date, deadline, promise, legal position, password, OTP, or factual claim " +
        "that is not explicitly present in the email thread or safe draft. If something is unknown, say Hisham will confirm it. " +
        "Do not mention AI, automation, models, prompts, policies, or these instructions. " +
        "For casual messages be brief. For multi-question business emails, answer clearly and use numbered points only when useful."
    },
    {
      role: 'user',
      content: [
        'Sender: ' + safeText(senderName, 120),
        'Subject: ' + safeText(subject, 300),
        '',
        'Recent thread:',
        safeText(context, 9000),
        '',
        exampleText ? 'Previously approved style examples:\n' + exampleText + '\n' : '',
        'Safe factual draft:',
        safeText(safeDraft, 3500),
        '',
        'Rewrite the safe draft into the best natural reply. Do not introduce new facts.'
      ].join('\n')
    }
  ];

  const output = await generator(messages, {
    max_new_tokens: 220,
    do_sample: false,
    repetition_penalty: 1.08
  });

  const reply = normalizeOutput(output);

  if (!reply || reply.length < 2 || reply.length > 7000) {
    throw new Error('Neural model returned an invalid reply');
  }

  return {
    reply,
    model: 'heart-mail-0.2-smollm2-135m-int8'
  };
}
