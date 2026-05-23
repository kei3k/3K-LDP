import { useState, useCallback, useRef } from 'react';
import { Loader2, RefreshCw, CheckCircle, Image as ImageIcon, Plus, X } from 'lucide-react';
import { generateRefImage } from '../../../lib/nanoBananaClient.js';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function blobToBase64Sync(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function SceneImageCard({ scene, idx, refImg, customRefs, onRegenerate, onAddCustomRefs, onRemoveCustomRef, onToggleSkipProducts, skipProducts }) {
  const status = refImg?.status || 'idle';
  const fileRef = useRef();

  const handleFiles = async (files) => {
    const out = [];
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('image/')) continue;
      const data = await blobToBase64Sync(f);
      out.push({ id: crypto.randomUUID(), mimeType: f.type, data, preview: URL.createObjectURL(f) });
    }
    if (out.length) onAddCustomRefs(idx, out);
  };

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold">Cảnh {idx + 1}</span>
        <div className="flex items-center gap-1.5">
          {status === 'generating' && <Loader2 size={12} className="animate-spin text-pink-400" />}
          {status === 'ok' && <CheckCircle size={12} className="text-green-400" />}
          {status === 'error' && <span className="text-[10px] text-red-400">Lỗi</span>}
          <button
            onClick={() => onRegenerate(idx)}
            disabled={status === 'generating'}
            className="text-xs flex items-center gap-1 text-muted-foreground hover:text-pink-400 px-2 py-0.5 rounded border border-border hover:border-pink-400 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} /> Regen
          </button>
        </div>
      </div>
      {refImg?.previewUrl ? (
        <img src={refImg.previewUrl} alt={`Scene ${idx + 1}`} className="w-full aspect-[9/16] object-cover rounded-lg border border-border" />
      ) : (
        <div className="w-full aspect-[9/16] rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/20">
          <ImageIcon size={24} className="text-muted-foreground" />
        </div>
      )}
      {refImg?.error && (
        <p className="text-[11px] text-red-400 mt-1 break-words">{refImg.error}</p>
      )}

      {/* Custom refs strip */}
      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center w-10 h-10 rounded-md border border-dashed border-border hover:border-pink-400 hover:text-pink-400 text-muted-foreground transition-colors"
          title="Thêm ảnh tham chiếu riêng cho cảnh này"
        >
          <Plus size={14} />
        </button>
        <input
          ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {(customRefs || []).map((r) => (
          <div key={r.id} className="relative group w-10 h-10">
            <img src={r.preview} alt="ref" className="w-10 h-10 object-cover rounded-md border border-pink-400/50" />
            <button
              onClick={() => onRemoveCustomRef(idx, r.id)}
              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100"
            >
              <X size={9} />
            </button>
          </div>
        ))}
        {(customRefs || []).length > 0 && (
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer ml-1">
            <input
              type="checkbox"
              checked={!!skipProducts}
              onChange={(e) => onToggleSkipProducts(idx, e.target.checked)}
              className="w-3 h-3"
            />
            chỉ dùng ref riêng
          </label>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{scene.imagePrompt}</p>
    </div>
  );
}

export default function Step4_GenerateRefImages({ credentials, script, assets, value, onApprove, onRegenerate }) {
  const [refImages, setRefImages] = useState(() => {
    if (value?.length) return value;
    return (script?.scenes || []).map(() => ({ status: 'idle', blob: null, previewUrl: null, error: null }));
  });
  // characterAnchors: one portrait per character — used as primary identity ref for every scene
  const [characterAnchors, setCharacterAnchors] = useState(() =>
    (assets?.characters || []).map(() => ({ status: 'idle', blob: null, previewUrl: null, error: null }))
  );
  // sceneCustomRefs[i]: { refs: [{id, mimeType, data, preview}], skipProducts: bool }
  const [sceneCustomRefs, setSceneCustomRefs] = useState(() =>
    (script?.scenes || []).map(() => ({ refs: [], skipProducts: false }))
  );
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const addCustomRefs = useCallback((sceneIdx, newRefs) => {
    setSceneCustomRefs(prev => {
      const next = [...prev];
      next[sceneIdx] = { ...next[sceneIdx], refs: [...(next[sceneIdx]?.refs || []), ...newRefs] };
      return next;
    });
  }, []);

  const removeCustomRef = useCallback((sceneIdx, refId) => {
    setSceneCustomRefs(prev => {
      const next = [...prev];
      next[sceneIdx] = { ...next[sceneIdx], refs: next[sceneIdx].refs.filter(r => r.id !== refId) };
      return next;
    });
  }, []);

  const toggleSkipProducts = useCallback((sceneIdx, val) => {
    setSceneCustomRefs(prev => {
      const next = [...prev];
      next[sceneIdx] = { ...next[sceneIdx], skipProducts: val };
      return next;
    });
  }, []);

  // Build character identity block — explicit, stable across scenes
  const buildIdentityBlock = useCallback(() => {
    const chars = assets?.characters || [];
    if (chars.length === 0) return '';
    return chars.map((c, i) =>
      `Person ${i + 1}: ${c.gender === 'F' ? 'female' : c.gender === 'M' ? 'male' : 'person'}, ${c.nationality || 'Asian'} ethnicity, approximately ${c.ageRange || '25-30'} years old. ${c.description || ''}`.trim()
    ).join(' | ');
  }, [assets]);

  // Build refs for scene i: [character portraits] + [scene_1 if exists] + [scene_{i-1}] + scene-custom-refs + products
  const buildRefList = useCallback(async (sceneIdx, currentRefImages, anchorsOverride) => {
    const productRefs = (assets?.productImages || []).map(img => ({ mimeType: img.mimeType, data: img.data }));
    const anchors = anchorsOverride || characterAnchors;
    const sceneOverride = sceneCustomRefs[sceneIdx] || { refs: [], skipProducts: false };
    const customRefs = (sceneOverride.refs || []).map(r => ({ mimeType: r.mimeType, data: r.data }));
    const out = [];

    // 1) Character portrait anchors — HIGHEST priority for face identity
    for (const a of anchors) {
      if (a?.blob) {
        const d = await blobToBase64(a.blob);
        out.push({ mimeType: a.blob.type || 'image/png', data: d });
      }
    }
    // 2) Scene 1 result (full-body composition anchor) for scenes >= 2
    if (sceneIdx > 0 && currentRefImages[0]?.blob) {
      const d = await blobToBase64(currentRefImages[0].blob);
      out.push({ mimeType: currentRefImages[0].blob.type || 'image/png', data: d });
    }
    // 3) Immediate previous scene for visual flow
    if (sceneIdx >= 2 && currentRefImages[sceneIdx - 1]?.blob) {
      const d = await blobToBase64(currentRefImages[sceneIdx - 1].blob);
      out.push({ mimeType: currentRefImages[sceneIdx - 1].blob.type || 'image/png', data: d });
    }
    // 4) Scene-specific custom refs (user-uploaded for this exact scene)
    out.push(...customRefs);
    // 5) Default product images (unless user said skip)
    if (!sceneOverride.skipProducts) {
      out.push(...productRefs);
    }
    return out;
  }, [assets, characterAnchors, sceneCustomRefs]);

  // Generate close-up character portrait — used as identity anchor for all scenes
  const generateCharacterAnchor = useCallback(async (charIdx) => {
    const char = assets?.characters?.[charIdx];
    if (!char) return null;
    const portraitPrompt = [
      `Photorealistic studio headshot portrait, vertical 9:16 aspect ratio.`,
      ``,
      `Subject: a single ${char.gender === 'F' ? 'female' : char.gender === 'M' ? 'male' : 'person'}, ${char.nationality || 'Asian'} ethnicity, approximately ${char.ageRange || '25-30'} years old.`,
      char.description ? `Notable features: ${char.description}.` : '',
      ``,
      `Composition: head-and-shoulders, looking straight at camera, neutral expression, soft natural lighting, plain neutral background (light grey or beige), shallow depth of field. No props, no text, no other people. Sharp focus on face. Realistic skin texture and pores. This is a reference identity portrait — face must be clear and consistent.`,
    ].filter(Boolean).join('\n');

    return await generateRefImage({ prompt: portraitPrompt, refImages: [] });
  }, [assets]);

  const buildPrompt = useCallback((sceneIdx, scene, hasAnchors) => {
    const identity = buildIdentityBlock();
    const numAnchors = (assets?.characters || []).length;
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
  }, [buildIdentityBlock, assets]);

  const generateFrom = useCallback(async (startIdx) => {
    setError('');
    setGenerating(true);
    const scenes = script?.scenes || [];
    let workingRefs = [...refImages];
    let workingAnchors = [...characterAnchors];

    // Step 0: generate character portrait anchors if missing (only on full generate, startIdx=0)
    if (startIdx === 0) {
      const chars = assets?.characters || [];
      for (let ci = 0; ci < chars.length; ci++) {
        if (workingAnchors[ci]?.blob) continue; // already have it (e.g. from previous run)
        setCharacterAnchors(prev => {
          const next = [...prev];
          next[ci] = { ...next[ci], status: 'generating', error: null };
          return next;
        });
        try {
          const blob = await generateCharacterAnchor(ci);
          const entry = { status: 'ok', blob, previewUrl: URL.createObjectURL(blob), error: null };
          workingAnchors[ci] = entry;
          setCharacterAnchors(prev => {
            const next = [...prev];
            next[ci] = entry;
            return next;
          });
        } catch (err) {
          setCharacterAnchors(prev => {
            const next = [...prev];
            next[ci] = { ...next[ci], status: 'error', error: err.message };
            return next;
          });
          setError(`Character anchor ${ci + 1} failed: ${err.message}`);
          setGenerating(false);
          return;
        }
      }
    }

    const hasAnchors = workingAnchors.some(a => a?.blob);

    for (let i = startIdx; i < scenes.length; i++) {
      setRefImages(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'generating', error: null };
        return next;
      });

      try {
        const refImgList = await buildRefList(i, workingRefs, workingAnchors);
        const fullPrompt = buildPrompt(i, scenes[i], hasAnchors);

        const blob = await generateRefImage({
          prompt: fullPrompt,
          refImages: refImgList,
        });

        const previewUrl = URL.createObjectURL(blob);
        const entry = { status: 'ok', blob, previewUrl, error: null };
        workingRefs[i] = entry;
        setRefImages(prev => {
          const next = [...prev];
          next[i] = entry;
          return next;
        });
      } catch (err) {
        setRefImages(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'error', error: err.message };
          return next;
        });
        setError(`Scene ${i + 1} failed: ${err.message}`);
        setGenerating(false);
        return;
      }
    }
    setGenerating(false);
  }, [script, refImages, characterAnchors, assets, buildRefList, buildPrompt, generateCharacterAnchor]);

  const handleGenerateAll = useCallback(() => {
    generateFrom(0);
  }, [generateFrom]);

  const handleRegenerateScene = useCallback(async (idx) => {
    const confirmed = (script?.scenes || []).length > idx + 1
      ? window.confirm(`Regenerate scenes ${idx + 1}..${script.scenes.length} để giữ consistency?`)
      : false;

    if (confirmed) {
      generateFrom(idx);
    } else {
      setRefImages(prev => {
        const next = [...prev];
        next[idx] = { ...next[idx], status: 'generating', error: null };
        return next;
      });
      setError('');
      try {
        const scene = script.scenes[idx];
        const refImgList = await buildRefList(idx, refImages, characterAnchors);
        const fullPrompt = buildPrompt(idx, scene, characterAnchors.some(a => a?.blob));

        const blob = await generateRefImage({
          prompt: fullPrompt,
          refImages: refImgList,
        });
        const previewUrl = URL.createObjectURL(blob);
        setRefImages(prev => {
          const next = [...prev];
          next[idx] = { status: 'ok', blob, previewUrl, error: null };
          return next;
        });
      } catch (err) {
        setRefImages(prev => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'error', error: err.message };
          return next;
        });
        setError(`Scene ${idx + 1} regen failed: ${err.message}`);
      }
    }
  }, [script, assets, credentials, refImages, generateFrom]);

  const allDone = refImages.length > 0 && refImages.every(r => r.status === 'ok');

  const handleApprove = useCallback(() => {
    if (!allDone) return;
    onApprove(refImages);
  }, [refImages, allDone, onApprove]);

  const handleRegenerateAnchor = useCallback(async (charIdx) => {
    const confirmAll = refImages.some(r => r.status === 'ok')
      ? window.confirm('Đổi character portrait sẽ làm các cảnh hiện tại không khớp identity nữa. Regenerate luôn tất cả cảnh sau khi đổi portrait?')
      : true;

    setCharacterAnchors(prev => {
      const next = [...prev];
      next[charIdx] = { ...next[charIdx], status: 'generating', error: null };
      return next;
    });
    try {
      const blob = await generateCharacterAnchor(charIdx);
      setCharacterAnchors(prev => {
        const next = [...prev];
        next[charIdx] = { status: 'ok', blob, previewUrl: URL.createObjectURL(blob), error: null };
        return next;
      });
      if (confirmAll) {
        setRefImages(prev => prev.map(() => ({ status: 'idle', blob: null, previewUrl: null, error: null })));
        // Generate fresh from scene 0
        setTimeout(() => generateFrom(0), 0);
      }
    } catch (err) {
      setCharacterAnchors(prev => {
        const next = [...prev];
        next[charIdx] = { ...next[charIdx], status: 'error', error: err.message };
        return next;
      });
      setError(`Anchor regen failed: ${err.message}`);
    }
  }, [refImages, generateCharacterAnchor, generateFrom]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleGenerateAll}
          disabled={generating}
          className="px-4 py-2 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold text-sm rounded-lg flex items-center gap-2 transition-colors"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : null}
          Generate all ảnh
        </button>
        <span className="text-xs text-muted-foreground">{refImages.filter(r => r.status === 'ok').length}/{refImages.length} hoàn thành</span>
      </div>

      {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

      {/* Character portrait anchors — identity reference for every scene */}
      {(assets?.characters || []).length > 0 && characterAnchors.some(a => a?.status !== 'idle') && (
        <section>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Character Portrait Anchors (identity reference, used cho tất cả cảnh)
          </h3>
          <div className="flex flex-wrap gap-3">
            {(assets?.characters || []).map((char, ci) => {
              const a = characterAnchors[ci];
              return (
                <div key={ci} className="w-32 rounded-xl border border-pink-500/30 bg-pink-500/5 p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold">NV {ci + 1}</span>
                    <button
                      onClick={() => handleRegenerateAnchor(ci)}
                      disabled={generating}
                      className="text-[10px] flex items-center gap-1 text-muted-foreground hover:text-pink-400 px-1.5 py-0.5 rounded border border-border hover:border-pink-400 transition-colors disabled:opacity-40"
                    >
                      <RefreshCw size={10} /> Regen
                    </button>
                  </div>
                  {a?.previewUrl ? (
                    <img src={a.previewUrl} alt={`Anchor ${ci + 1}`} className="w-full aspect-[9/16] object-cover rounded-lg" />
                  ) : (
                    <div className="w-full aspect-[9/16] rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/20">
                      {a?.status === 'generating' ? <Loader2 size={18} className="animate-spin text-pink-400" /> : <ImageIcon size={18} className="text-muted-foreground" />}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{char.gender === 'F' ? 'Nữ' : char.gender === 'M' ? 'Nam' : '—'} {char.nationality} {char.ageRange}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {(script?.scenes || []).map((scene, idx) => (
          <SceneImageCard
            key={idx}
            scene={scene}
            idx={idx}
            refImg={refImages[idx]}
            customRefs={sceneCustomRefs[idx]?.refs || []}
            skipProducts={sceneCustomRefs[idx]?.skipProducts}
            onRegenerate={handleRegenerateScene}
            onAddCustomRefs={addCustomRefs}
            onRemoveCustomRef={removeCustomRef}
            onToggleSkipProducts={toggleSkipProducts}
          />
        ))}
      </div>

      {allDone && (
        <button onClick={handleApprove} className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold text-sm rounded-lg flex items-center gap-2 self-start transition-colors">
          <CheckCircle size={14} /> Approve & Tiếp tục
        </button>
      )}
    </div>
  );
}
