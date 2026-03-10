import { useState } from 'react';
import {
  Package, Palette, BarChart3, Settings, Loader2,
  Sparkles, Link, ChevronDown, ChevronUp, Eye, EyeOff, Globe, Plus, Trash2, FileText
} from 'lucide-react';
import ImageUploader from './ImageUploader';
import ExportButtons from './ExportButtons';

/**
 * Config form sidebar — product info, design, tracking, API settings
 */
export default function ConfigForm({ config, setConfig, onGenerate, isGenerating, progress, generatedHtml }) {
  const [expandedSections, setExpandedSections] = useState({
    product: true,
    design: true,
    tracking: false,
    formFields: false,
    api: true,
  });
  const [showApiKey, setShowApiKey] = useState(false);

  const toggle = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const update = (field, value) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const updateColors = (colors) => {
    setConfig(prev => ({
      ...prev,
      colors: colors ? {
        primary: colors.primary,
        secondary: colors.secondary,
        accent: colors.accent,
        background: colors.background,
        text: colors.text,
      } : null,
    }));
  };

  const models = [
    { value: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro (mới nhất)' },
    { value: 'gemini-3.0-pro', label: 'Gemini 3.0 Pro' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  ];

  const isFormValid = config.productName?.trim();

  return (
    <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 border-r border-border bg-card overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">LDP Generator</h1>
            <p className="text-xs text-muted-foreground">A/B Landing Page cho Ads</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* PRODUCT INFO */}
        <Section
          icon={<Package className="w-4 h-4" />}
          title="Thông tin sản phẩm"
          expanded={expandedSections.product}
          onToggle={() => toggle('product')}
        >
          <div className="space-y-3">
            <FormField label="Tên sản phẩm *">
              <input
                type="text"
                value={config.productName || ''}
                onChange={(e) => update('productName', e.target.value)}
                placeholder="VD: Serum Vitamin C"
                className="form-input"
              />
            </FormField>

            <FormField label="Mô tả ngắn">
              <textarea
                value={config.productDescription || ''}
                onChange={(e) => update('productDescription', e.target.value)}
                placeholder="Mô tả sản phẩm ngắn gọn trong 2-3 câu..."
                rows={3}
                className="form-input resize-none"
              />
            </FormField>

            <FormField label="Lợi ích chính">
              <textarea
                value={config.productBenefits || ''}
                onChange={(e) => update('productBenefits', e.target.value)}
                placeholder="Mỗi lợi ích 1 dòng. VD:&#10;Làm sáng da sau 7 ngày&#10;Giảm thâm nám hiệu quả&#10;Nguyên liệu 100% tự nhiên"
                rows={3}
                className="form-input resize-none"
              />
            </FormField>

            <FormField label="Ngôn ngữ Landing Page *">
              <select
                value={config.language || 'Tiếng Việt'}
                onChange={(e) => update('language', e.target.value)}
                className="form-input"
              >
                <option value="Tiếng Việt">🇻🇳 Tiếng Việt</option>
                <option value="English">🇺🇸 English</option>
                <option value="ภาษาไทย">🇹🇭 ภาษาไทย (Thai)</option>
                <option value="中文">🇨🇳 中文 (Chinese)</option>
                <option value="日本語">🇯🇵 日本語 (Japanese)</option>
                <option value="한국어">🇰🇷 한국어 (Korean)</option>
                <option value="Bahasa Indonesia">🇮🇩 Bahasa Indonesia</option>
              </select>
            </FormField>
          </div>
        </Section>

        {/* DESIGN */}
        <Section
          icon={<Palette className="w-4 h-4" />}
          title="Thiết kế"
          expanded={expandedSections.design}
          onToggle={() => toggle('design')}
        >
          <div className="space-y-3">
            <FormField label="Ảnh sản phẩm (chọn nhiều ảnh)">
              <ImageUploader
                onImagesChange={(imgs) => update('productImages', imgs)}
                onColorsExtracted={updateColors}
              />
            </FormField>

            <FormField label="Link landing page mẫu">
              <div className="relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  value={config.referenceUrl || ''}
                  onChange={(e) => update('referenceUrl', e.target.value)}
                  placeholder="https://example.com/landing"
                  className="form-input pl-9"
                />
              </div>
            </FormField>

            <FormField label="HOẶC dán HTML trực tiếp (tin cậy hơn)">
              <textarea
                value={config.referenceHtml || ''}
                onChange={(e) => update('referenceHtml', e.target.value)}
                placeholder={"Mở trang mẫu trong browser → Ctrl+U (View Source) → Ctrl+A → Ctrl+C → Dán vào đây"}
                rows={3}
                className="form-input resize-none text-xs font-mono"
              />
              {config.referenceHtml && (
                <p className="text-xs text-primary mt-1">
                  ✅ Đã có {Math.round(config.referenceHtml.length/1024)}KB HTML
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                💡 Cách lấy: Mở trang mẫu → nhấn <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Ctrl+U</kbd> → copy toàn bộ → dán vào đây
              </p>
            </FormField>

            <FormField label="✨ Hướng dẫn tùy chỉnh (tùy chọn)">
              <textarea
                value={config.customPrompt || ''}
                onChange={(e) => update('customPrompt', e.target.value)}
                placeholder={"VD:\n- Đổi màu nền thành gradient xanh đậm\n- Thêm section FAQ ở cuối\n- Làm nút CTA to hơn, bo tròn\n- Bỏ phần đánh giá sao\n- Thêm hiệu ứng animation"}
                rows={4}
                className="form-input resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Yêu cầu thêm để Gemini điều chỉnh thiết kế landing page theo ý bạn
              </p>
            </FormField>


          </div>
        </Section>

        {/* TRACKING */}
        <Section
          icon={<BarChart3 className="w-4 h-4" />}
          title="Tracking & Integration"
          expanded={expandedSections.tracking}
          onToggle={() => toggle('tracking')}
          badge="Tùy chọn"
        >
          <div className="space-y-3">
            <FormField label="Google Sheet Webhook">
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="url"
                  value={config.googleSheetWebhook || ''}
                  onChange={(e) => update('googleSheetWebhook', e.target.value)}
                  placeholder="https://script.google.com/..."
                  className="form-input pl-9"
                />
              </div>
            </FormField>

            <FormField label="Google Ads Tracking Code">
              <textarea
                value={config.googleAdsTracking || ''}
                onChange={(e) => update('googleAdsTracking', e.target.value)}
                placeholder="Paste Google Ads conversion tracking code..."
                rows={2}
                className="form-input resize-none text-xs font-mono"
              />
            </FormField>

            <FormField label="Facebook Pixel ID">
              <input
                type="text"
                value={config.facebookPixelId || ''}
                onChange={(e) => update('facebookPixelId', e.target.value)}
                placeholder="VD: 123456789012345"
                className="form-input"
              />
            </FormField>

            <FormField label="TikTok Pixel ID">
              <input
                type="text"
                value={config.tiktokPixelId || ''}
                onChange={(e) => update('tiktokPixelId', e.target.value)}
                placeholder="VD: ABCDEFG123"
                className="form-input"
              />
            </FormField>
          </div>
        </Section>

        {/* CUSTOM FORM FIELDS */}
        <Section
          icon={<FileText className="w-4 h-4" />}
          title="Tùy chỉnh Form đăng ký"
          expanded={expandedSections.formFields}
          onToggle={() => toggle('formFields')}
          badge="Tùy chọn"
        >
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Thêm trường tùy chỉnh vào form đăng ký trên landing page
            </p>
            
            {(config.customFormFields || []).map((field, i) => (
              <div key={i} className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Trường #{i + 1}</span>
                  <button
                    onClick={() => {
                      const fields = [...(config.customFormFields || [])];
                      fields.splice(i, 1);
                      update('customFormFields', fields);
                    }}
                    className="text-destructive hover:text-destructive/80 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={field.label || ''}
                  onChange={(e) => {
                    const fields = [...(config.customFormFields || [])];
                    fields[i] = { ...fields[i], label: e.target.value, name: e.target.value };
                    update('customFormFields', fields);
                  }}
                  placeholder="Tên trường (VD: Loại sản phẩm)"
                  className="form-input text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={field.type || 'text'}
                    onChange={(e) => {
                      const fields = [...(config.customFormFields || [])];
                      fields[i] = { ...fields[i], type: e.target.value };
                      update('customFormFields', fields);
                    }}
                    className="form-input text-xs"
                  >
                    <option value="text">Text</option>
                    <option value="tel">Số điện thoại</option>
                    <option value="email">Email</option>
                    <option value="number">Số</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Dropdown</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={field.required || false}
                      onChange={(e) => {
                        const fields = [...(config.customFormFields || [])];
                        fields[i] = { ...fields[i], required: e.target.checked };
                        update('customFormFields', fields);
                      }}
                      className="rounded"
                    />
                    Bắt buộc
                  </label>
                </div>
                {field.type === 'select' && (
                  <input
                    type="text"
                    value={field.options || ''}
                    onChange={(e) => {
                      const fields = [...(config.customFormFields || [])];
                      fields[i] = { ...fields[i], options: e.target.value };
                      update('customFormFields', fields);
                    }}
                    placeholder="Tùy chọn, cách nhau dấu phẩy (VD: Đỏ, Xanh, Trắng)"
                    className="form-input text-xs"
                  />
                )}
                <input
                  type="text"
                  value={field.placeholder || ''}
                  onChange={(e) => {
                    const fields = [...(config.customFormFields || [])];
                    fields[i] = { ...fields[i], placeholder: e.target.value };
                    update('customFormFields', fields);
                  }}
                  placeholder="Placeholder (VD: Nhập ghi chú...)"
                  className="form-input text-xs"
                />
              </div>
            ))}

            <button
              onClick={() => {
                const fields = [...(config.customFormFields || []), { label: '', name: '', type: 'text', required: false, placeholder: '' }];
                update('customFormFields', fields);
              }}
              className="w-full py-2 rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Thêm trường mới
            </button>
          </div>
        </Section>

        {/* API Settings */}
        <Section
          icon={<Settings className="w-4 h-4" />}
          title="Cài đặt API"
          expanded={expandedSections.api}
          onToggle={() => toggle('api')}
        >
          <FormField label="Gemini API Key">
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey || ''}
                onChange={(e) => {
                  update('apiKey', e.target.value);
                  localStorage.setItem('gemini_api_key', e.target.value);
                }}
                placeholder="AIza..."
                className="form-input pr-9"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lấy key tại <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-primary hover:underline">AI Studio</a>
            </p>
          </FormField>

          <FormField label="Model">
            <select
              value={config.model || 'gemini-2.0-flash'}
              onChange={(e) => {
                update('model', e.target.value);
                localStorage.setItem('gemini_model', e.target.value);
              }}
              className="form-input"
            >
              {models.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Nếu model bị lỗi, thử đổi sang model khác
            </p>
          </FormField>
        </Section>

        {/* GENERATE BUTTON */}
        <button
          onClick={onGenerate}
          disabled={!isFormValid || isGenerating}
          className={`w-full py-3.5 rounded-xl font-bold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
            isFormValid && !isGenerating
              ? 'bg-gradient-to-r from-primary to-green-400 text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99]'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Đang tạo...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Tạo Landing Page
            </>
          )}
        </button>

        {/* Progress indicator */}
        {isGenerating && progress && (
          <div className="text-xs text-center text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 animate-pulse">
            {progress}
          </div>
        )}

        {/* Export Buttons */}
        <ExportButtons
          html={generatedHtml}
          productName={config.productName}
        />
      </div>
    </div>
  );
}

/**
 * Collapsible section wrapper
 */
function Section({ icon, title, expanded, onToggle, badge, children }) {
  return (
    <div className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/50 transition-colors"
      >
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-semibold text-foreground flex-1 text-left">{title}</span>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {badge}
          </span>
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/**
 * Form field with label
 */
function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}
