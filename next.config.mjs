/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    '@huggingface/transformers',
    'onnxruntime-node'
  ],
  outputFileTracingIncludes: {
    '/api/heart-mail': [
      './node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime.so.1',
      './node_modules/onnxruntime-node/bin/napi-v3/linux/x64/onnxruntime_binding.node',
      './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime.so.1',
      './node_modules/@huggingface/transformers/node_modules/onnxruntime-node/bin/napi-v3/linux/x64/onnxruntime_binding.node'
    ]
  }
};

export default nextConfig;
