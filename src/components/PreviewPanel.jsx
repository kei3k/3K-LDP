import { useState, useMemo } from 'react';
import { Monitor, Smartphone, Tablet, Edit3, ChevronDown } from 'lucide-react';
import HtmlEditor from './HtmlEditor';

/**
 * Device presets for responsive preview
 */
const DEVICES = [
  { id: 'iphone-se', label: 'iPhone SE', w: 375, h: 667, cat: 'mobile' },
  { id: 'iphone-14', label: 'iPhone 14', w: 390, h: 844, cat: 'mobile' },
  { id: 'iphone-15-pro', label: 'iPhone 15 Pro', w: 393, h: 852, cat: 'mobile' },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', w: 430, h: 932, cat: 'mobile' },
  { id: 'galaxy-s24', label: 'Galaxy S24', w: 360, h: 780, cat: 'mobile' },
  { id: 'galaxy-s24-ultra', label: 'Galaxy S24 Ultra', w: 412, h: 915, cat: 'mobile' },
  { id: 'pixel-8', label: 'Pixel 8', w: 412, h: 915, cat: 'mobile' },
  { id: 'ipad-mini', label: 'iPad Mini', w: 744, h: 1133, cat: 'tablet' },
  { id: 'ipad-air', label: 'iPad Air', w: 820, h: 1180, cat: 'tablet' },
  { id: 'ipad-pro', label: 'iPad Pro 12.9"', w: 1024, h: 1366, cat: 'tablet' },
  { id: 'desktop-hd', label: 'Desktop HD', w: 1280, h: 800, cat: 'desktop' },
  { id: 'desktop-fhd', label: 'Desktop FHD', w: 1920, h: 1080, cat: 'desktop' },
  { id: 'responsive', label: '100% Chiều rộng', w: 0, h: 0, cat: 'responsive' },
];

/**
 * Preview panel — single view, device presets, large preview
 */
export default function PreviewPanel({ html, onUpdateHtml }) {
  const [device, setDevice] = useState('iphone-15-pro');
  const [editing, setEditing] = useState(false);
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

  const selectedDevice = DEVICES.find(d => d.id === device) || DEVICES[2];
  const isResponsive = selectedDevice.cat === 'responsive';

  const blobUrl = useMemo(() => {
    if (!html) return null;
    const blob = new Blob([html], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [html]);

  // Empty state
  if (!html) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[500px]">
        <div className="text-center space-y-4 max-w-md px-6">
          <div className="text-6xl">🚀</div>
          <h2 className="text-xl font-bold">Sẵn sàng tạo Landing Page</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Điền thông tin sản phẩm, nhập URL hoặc dán HTML trang mẫu, sau đó nhấn{' '}
            <span className="text-primary font-semibold">"Tạo Landing Page"</span>
          </p>
          <div className="flex flex-wrap gap-3 justify-center text-xs text-muted-foreground/70">
            <span className="px-3 py-1.5 bg-muted rounded-full">Clone Layout</span>
            <span className="px-3 py-1.5 bg-muted rounded-full">Dịch ngôn ngữ</span>
            <span className="px-3 py-1.5 bg-muted rounded-full">Custom Form</span>
          </div>
        </div>
      </div>
    );
  }

  // Editor mode
  if (editing) {
    return (
      <HtmlEditor
        html={html}
        onSave={(newHtml) => {
          onUpdateHtml?.(newHtml);
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  // Calculate scale to fit preview into available space
  const getPreviewStyle = () => {
    if (isResponsive) {
      return { width: '100%', height: '100%' };
    }
    return {
      width: `${selectedDevice.w}px`,
      maxWidth: '100%',
      height: '100%',
    };
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 flex-shrink-0">
        {/* Device selector */}
        <div className="relative">
          <button
            onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium transition-all"
          >
            {selectedDevice.cat === 'mobile' && <Smartphone className="w-4 h-4" />}
            {selectedDevice.cat === 'tablet' && <Tablet className="w-4 h-4" />}
            {selectedDevice.cat === 'desktop' && <Monitor className="w-4 h-4" />}
            {selectedDevice.cat === 'responsive' && <Monitor className="w-4 h-4" />}
            <span>{selectedDevice.label}</span>
            {!isResponsive && <span className="text-xs text-muted-foreground">{selectedDevice.w}×{selectedDevice.h}</span>}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          {showDeviceDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDeviceDropdown(false)} />
              <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden w-64 max-h-[400px] overflow-y-auto">
                {/* Group by category */}
                {['mobile', 'tablet', 'desktop', 'responsive'].map(cat => {
                  const items = DEVICES.filter(d => d.cat === cat);
                  const catLabels = { mobile: '📱 Điện thoại', tablet: '📱 Tablet', desktop: '💻 Máy tính', responsive: '📐 Tùy chỉnh' };
                  return (
                    <div key={cat}>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">
                        {catLabels[cat]}
                      </div>
                      {items.map(d => (
                        <button
                          key={d.id}
                          onClick={() => { setDevice(d.id); setShowDeviceDropdown(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors ${
                            device === d.id ? 'bg-primary/10 text-primary font-medium' : 'text-foreground'
                          }`}
                        >
                          <span>{d.label}</span>
                          {d.w > 0 && <span className="text-xs text-muted-foreground">{d.w}×{d.h}</span>}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Quick device shortcuts */}
        <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1">
          {[
            { id: 'iphone-15-pro', icon: Smartphone, tip: 'iPhone 15 Pro' },
            { id: 'ipad-air', icon: Tablet, tip: 'iPad Air' },
            { id: 'desktop-fhd', icon: Monitor, tip: 'Desktop FHD' },
          ].map(({ id, icon: Icon, tip }) => (
            <button
              key={id}
              onClick={() => setDevice(id)}
              title={tip}
              className={`p-1.5 rounded-md transition-all ${
                device === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Edit button */}
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/15 text-accent hover:bg-accent/25 rounded-lg text-xs font-medium transition-all"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Chỉnh sửa
        </button>
      </div>

      {/* Preview area — FULL HEIGHT, centered */}
      <div className="flex-1 flex items-start justify-center p-3 bg-muted/10 overflow-auto min-h-0">
        <div
          className="bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-300 border border-border/30 flex-shrink-0"
          style={{
            ...getPreviewStyle(),
            minHeight: isResponsive ? '100%' : `${Math.min(selectedDevice.h, 900)}px`,
          }}
        >
          {blobUrl && (
            <iframe
              key={blobUrl}
              src={blobUrl}
              className="w-full h-full border-0"
              style={isResponsive ? {} : { 
                width: `${selectedDevice.w}px`,
                height: `${selectedDevice.h}px`,
                transformOrigin: 'top left',
                border: 'none',
              }}
              title="Preview"
              sandbox="allow-scripts allow-forms"
            />
          )}
        </div>
      </div>
    </div>
  );
}
