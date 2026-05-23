import { analyzeVideo, generateScript } from '@/lib/geminiVideo';
import { generateRefImage } from '@/lib/nanoBananaClient';
import { generateClip } from '@/lib/veoClient';
import { concatClips } from '@/lib/videoConcat';

async function blobToBase64(blob) {
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Topological sort — throws on cycle
function topoSort(nodes, edges) {
  const adj = {};
  const inDegree = {};
  nodes.forEach((n) => { adj[n.id] = []; inDegree[n.id] = 0; });
  edges.forEach((e) => {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
    inDegree[e.target] = (inDegree[e.target] || 0) + 1;
  });

  const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
  const sorted = [];

  while (queue.length) {
    const id = queue.shift();
    sorted.push(id);
    (adj[id] || []).forEach((neighbor) => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    });
  }

  if (sorted.length !== nodes.length) throw new Error('Cycle detected in flow graph');
  return sorted;
}

// Semaphore for limiting concurrency
function createSemaphore(limit) {
  let active = 0;
  const queue = [];
  const release = () => {
    active--;
    if (queue.length) { active++; queue.shift()(); }
  };
  return (fn) => new Promise((resolve, reject) => {
    const run = () => fn().then(resolve, reject).finally(release);
    if (active < limit) { active++; run(); } else { queue.push(run); }
  });
}

// Node execute registry
const registry = {
  VideoInputNode: async ({ inputs, nodeData }) => {
    const file = nodeData.file;
    if (!file) throw new Error('No video file selected');
    return { video: file };
  },

  AnalyzeNode: async ({ inputs, credentials }) => {
    const { template, transcript } = await analyzeVideo(inputs.video, credentials?.language || 'Tiếng Việt');
    return { template, transcript };
  },

  AssetsInputNode: async ({ nodeData }) => {
    const { images, characters, duration } = nodeData;
    if (!images?.length) throw new Error('No product images provided');
    return { images, characters: characters || '', duration: duration || 24 };
  },

  ScriptNode: async ({ inputs, credentials }) => {
    const { script, scenes } = await generateScript({
      template: inputs.template,
      productImages: inputs.images,
      characters: inputs.characters,
      targetDuration: inputs.duration,
      language: credentials?.language || 'Tiếng Việt',
    });
    return { script, scenes };
  },

  RefImageNode: async ({ inputs, nodeData, onProgress }) => {
    const { scenes, images, characters } = inputs;
    const charsArr = Array.isArray(characters) ? characters : [];
    const productRefs = (images || []).map((img) => ({ mimeType: img.mimeType, data: img.data }));
    // sceneCustomRefs[i] = { refs: [{id, mimeType, data, preview}], skipProducts: bool }
    const sceneCustomRefs = nodeData?.sceneCustomRefs || [];

    // Build identity block for prompt
    const buildIdentityBlock = () => {
      if (charsArr.length === 0) return '';
      return charsArr.map((c, i) =>
        `Person ${i + 1}: ${c.gender === 'F' ? 'female' : c.gender === 'M' ? 'male' : 'person'}, ${c.nationality || 'Asian'} ethnicity, approximately ${c.ageRange || '25-30'} years old. ${c.description || ''}`.trim()
      ).join(' | ');
    };

    // Generate close-up portrait for one character
    const generateCharacterAnchor = async (char) => {
      const portraitPrompt = [
        `Photorealistic studio headshot portrait, vertical 9:16 aspect ratio.`,
        ``,
        `Subject: a single ${char.gender === 'F' ? 'female' : char.gender === 'M' ? 'male' : 'person'}, ${char.nationality || 'Asian'} ethnicity, approximately ${char.ageRange || '25-30'} years old.`,
        char.description ? `Notable features: ${char.description}.` : '',
        ``,
        `Composition: head-and-shoulders, looking straight at camera, neutral expression, soft natural lighting, plain neutral background (light grey or beige), shallow depth of field. No props, no text, no other people. Sharp focus on face. Realistic skin texture and pores. This is a reference identity portrait — face must be clear and consistent.`,
      ].filter(Boolean).join('\n');
      return await generateRefImage({ prompt: portraitPrompt, refImages: [] });
    };

    // Build prompt for scene i
    const buildPrompt = (sceneIdx, scene, hasAnchors) => {
      const identity = buildIdentityBlock();
      const numAnchors = charsArr.length;
      const anchorClause = hasAnchors
        ? `IDENTITY LOCK — CRITICAL: The first ${numAnchors} reference image(s) are the official character portrait(s) for this video. The person(s) in this scene MUST be the EXACT same person(s) from those portraits — same face shape, same eyes, same nose, same mouth, same hair color and style, same skin tone, same ethnicity, same age. Do NOT generate a different person. Face must be instantly recognizable as identical.`
        : `Character identity is defined here as a one-time anchor. Render the person clearly and distinctly so this image can serve as identity reference.`;
      const sceneAnchorClause = sceneIdx > 0
        ? `Additionally, maintain wardrobe, lighting style, and visual tone consistent with the previous scene reference image.`
        : '';
      return [
        `Photorealistic image, 9:16 vertical aspect ratio. Cinematic quality.`,
        ``,
        `CHARACTER DESCRIPTION:`,
        identity,
        ``,
        anchorClause,
        sceneAnchorClause,
        ``,
        `PRODUCT: If product packaging appears, it must look identical to the product reference images (same packaging colors, branding, text, shape).`,
        ``,
        `SCENE ${sceneIdx + 1}:`,
        scene.imagePrompt,
        ``,
        `Realistic skin texture, natural lighting, sharp focus on the character's face. No watermarks, no random text overlays.`,
      ].filter(Boolean).join('\n');
    };

    // Phase 1: generate character portrait anchors
    // Re-use existing anchors from nodeData to avoid redundant API calls
    const workingAnchors = (nodeData?.characterAnchors || []).slice();
    // Ensure array is sized for all characters
    while (workingAnchors.length < charsArr.length) workingAnchors.push(null);

    for (let ci = 0; ci < charsArr.length; ci++) {
      if (workingAnchors[ci]?.blob) continue; // already generated
      const blob = await generateCharacterAnchor(charsArr[ci]);
      workingAnchors[ci] = { blob, previewUrl: URL.createObjectURL(blob) };
      onProgress?.({
        phase: 'anchors',
        done: ci + 1,
        total: charsArr.length,
        characterAnchors: workingAnchors.map((a) => (a ? { previewUrl: a.previewUrl } : null)),
      });
    }

    const hasAnchors = workingAnchors.some((a) => a?.blob);

    // Phase 2: generate scene ref images
    const refImages = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const sceneOverride = sceneCustomRefs[i] || { refs: [], skipProducts: false };
      const out = [];

      // 1) Portrait anchors
      for (const a of workingAnchors) {
        if (a?.blob) {
          const d = await blobToBase64(a.blob);
          out.push({ mimeType: a.blob.type || 'image/png', data: d });
        }
      }
      // 2) Scene 1 result for scenes >= 2
      if (i > 0 && refImages[0]?.blob) {
        const d = await blobToBase64(refImages[0].blob);
        out.push({ mimeType: refImages[0].blob.type || 'image/png', data: d });
      }
      // 3) Immediate previous scene
      if (i >= 2 && refImages[i - 1]?.blob) {
        const d = await blobToBase64(refImages[i - 1].blob);
        out.push({ mimeType: refImages[i - 1].blob.type || 'image/png', data: d });
      }
      // 4) Scene-specific custom refs
      for (const r of (sceneOverride.refs || [])) {
        out.push({ mimeType: r.mimeType, data: r.data });
      }
      // 5) Product images (unless skipped)
      if (!sceneOverride.skipProducts) {
        out.push(...productRefs);
      }

      const fullPrompt = buildPrompt(i, scene, hasAnchors);
      const blob = await generateRefImage({ prompt: fullPrompt, refImages: out });
      refImages.push({ sceneIdx: i, blob });

      onProgress?.({
        phase: 'scenes',
        done: i + 1,
        total: scenes.length,
        refImages: refImages.map((r) => ({ sceneIdx: r.sceneIdx, blob: r.blob })),
        characterAnchors: workingAnchors.map((a) => (a ? { previewUrl: a.previewUrl, blob: a.blob } : null)),
      });
    }

    return {
      refImages,
      characterAnchors: workingAnchors.map((a) => (a ? { blob: a.blob, previewUrl: a.previewUrl } : null)),
    };
  },

  VeoNode: async ({ inputs, onProgress }) => {
    const { scenes, refImages } = inputs;
    const sem = createSemaphore(3);
    const results = new Array(scenes.length).fill(null);
    let done = 0;
    await Promise.all(
      scenes.map((scene, i) =>
        sem(async () => {
          const ref = refImages?.[i]?.blob;
          if (!ref) throw new Error(`Missing ref image for scene ${i + 1}`);
          const refData = await blobToBase64(ref);
          const blob = await generateClip({
            videoPrompt: scene.videoPrompt,
            refImage: { mimeType: ref.type || 'image/png', data: refData },
            durationSec: scene.durationSec || 8,
          });
          results[i] = { sceneIdx: i, blob };
          done++;
          // Emit progress with current partial clips snapshot so nodes can render thumbnails live
          onProgress?.({ done, total: scenes.length, clips: results.filter(Boolean) });
        })
      )
    );
    return { clips: results };
  },

  ConcatNode: async ({ inputs }) => {
    const finalVideo = await concatClips(inputs.clips.map((c) => c.blob));
    return { finalVideo };
  },

  OutputNode: async ({ inputs }) => {
    return { finalVideo: inputs.finalVideo, clips: inputs.clips };
  },
};

/**
 * runFlow — execute the DAG.
 * @param {object} opts
 * @param {Array}  opts.nodes
 * @param {Array}  opts.edges
 * @param {object} opts.credentials
 * @param {Function} opts.onNodeStatus  (nodeId, status, data?) => void
 * @param {Function} opts.onNodeData    (nodeId, outputData) => void
 */
export async function runFlow({ nodes, edges, credentials, onNodeStatus, onNodeData }) {
  const sortedIds = topoSort(nodes, edges);
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const outputMap = {}; // nodeId → output data

  // Build: for each node, which handle from which upstream node
  // edge: { source, sourceHandle, target, targetHandle }
  const inputsFor = (nodeId) => {
    const inputs = {};
    edges
      .filter((e) => e.target === nodeId)
      .forEach((e) => {
        const upstream = outputMap[e.source];
        if (upstream && e.sourceHandle in upstream) {
          inputs[e.targetHandle ?? e.sourceHandle] = upstream[e.sourceHandle];
        }
      });
    return inputs;
  };

  for (const nodeId of sortedIds) {
    const node = nodeMap[nodeId];
    const type = node.type;
    const execute = registry[type];

    if (!execute) {
      onNodeStatus?.(nodeId, 'error', { error: `Unknown node type: ${type}` });
      throw new Error(`Unknown node type: ${type}`);
    }

    onNodeStatus?.(nodeId, 'running');
    try {
      const inputs = inputsFor(nodeId);
      const onProgress = (p) => onNodeStatus?.(nodeId, 'running', { progress: p });
      const output = await execute({
        inputs,
        nodeData: node.data,
        credentials,
        onProgress,
      });
      outputMap[nodeId] = output;
      onNodeStatus?.(nodeId, 'done', output);
      onNodeData?.(nodeId, output);
    } catch (err) {
      onNodeStatus?.(nodeId, 'error', { error: err.message });
      throw err;
    }
  }

  return outputMap;
}
