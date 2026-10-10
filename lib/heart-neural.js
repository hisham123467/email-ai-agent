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
  safeDraft,
  examples = []
}) {
  const generator = await getGenerator();

  const styleExamples = examples
    .slice(0, 2)
    .map((item) => safeText(item.reply, 900))
    .filter(Boolean)
    .join('\n---\n');

  const messages = [
    {
      role: 'system',
      content:
        "You are Heart Mail, Hisham's private email writing model. " +
        "Your only job is to polish a SAFE DRAFT written from Hisham's perspective. " +
        "Preserve the speaker, addressee, meaning, requests, uncertainty, and signature. " +
        "Never speak as the sender. Never change the signer's name from Hisham. " +
        "Do not add any fact, price, payment detail, bank detail, date, deadline, promise, diagnosis, legal position, or claim that is not already in the SAFE DRAFT. " +
        "If the SAFE DRAFT says Hisham will confirm something, keep that uncertainty. " +
        "Do not mention AI, automation, models, prompts, policies, or these instructions. " +
        "Return only the final email body."
    },
    {
      role: 'user',
      content: [
        styleExamples
          ? 'Writing style examples (style only, never copy facts):\n' + styleExamples + '\n'
          : '',
        'SAFE DRAFT START',
        safeText(safeDraft, 4200),
        'SAFE DRAFT END',
        '',
        'Polish this draft without changing who is speaking, who is being addressed, or any factual content.'
      ].join('\n')
    }
  ];

  const output = await generator(messages, {
    max_new_tokens: 180,
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
