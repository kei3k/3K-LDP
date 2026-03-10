/**
 * Variant A Template: Big hero, single CTA, urgency countdown timer
 * Generates standalone HTML with inline CSS and embedded JS
 */

export function generateVariantA(config, colors, content) {
  const {
    productName, productDescription, productImage,
    googleSheetWebhook, googleAdsTracking, facebookPixelId, tiktokPixelId
  } = config;

  const variantContent = content?.variantA || getDefaultContentA(productName, productDescription);
  const primaryColor = colors?.primary || '#22c55e';
  const secondaryColor = colors?.secondary || '#1a1a2e';
  const accentColor = colors?.accent || '#8b5cf6';
  const bgColor = colors?.background || '#0f0f1a';
  const textColor = colors?.text || '#ffffff';

  const productImageHtml = productImage
    ? `<img src="${productImage}" alt="${productName}" style="max-width:100%;height:auto;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">`
    : '';

  const benefitsHtml = (variantContent.benefitsList || []).map(b => `
    <div class="benefit-item">
      <span class="benefit-icon">${b.icon}</span>
      <div>
        <h3>${b.title}</h3>
        <p>${b.desc}</p>
      </div>
    </div>
  `).join('');

  const trackingScripts = buildTrackingScripts(googleAdsTracking, facebookPixelId, tiktokPixelId);

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${productName} - ${variantContent.headline}</title>
  <meta name="description" content="${variantContent.subheadline}">
  <meta property="og:title" content="${productName} - ${variantContent.headline}">
  <meta property="og:description" content="${variantContent.subheadline}">
  <meta property="og:type" content="website">
  ${productImage ? `<meta property="og:image" content="${productImage}">` : ''}
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  ${trackingScripts.head}
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family:'Inter',system-ui,-apple-system,sans-serif;
      background:${bgColor};
      color:${textColor};
      line-height:1.6;
      overflow-x:hidden;
    }
    .container { max-width:480px; margin:0 auto; padding:0 16px; }
    
    /* Hero Section */
    .hero {
      min-height:100vh;
      display:flex;
      flex-direction:column;
      justify-content:center;
      align-items:center;
      text-align:center;
      padding:60px 20px 40px;
      background:linear-gradient(135deg, ${bgColor} 0%, ${secondaryColor} 50%, ${bgColor} 100%);
      position:relative;
    }
    .hero::before {
      content:'';
      position:absolute;
      top:0;left:0;right:0;bottom:0;
      background:radial-gradient(circle at 50% 30%, ${primaryColor}15 0%, transparent 60%);
      pointer-events:none;
    }
    .hero-badge {
      display:inline-flex;
      align-items:center;
      gap:6px;
      background:${primaryColor}20;
      color:${primaryColor};
      padding:8px 16px;
      border-radius:50px;
      font-size:13px;
      font-weight:600;
      margin-bottom:20px;
      border:1px solid ${primaryColor}40;
      animation:pulse 2s infinite;
    }
    @keyframes pulse {
      0%,100% { opacity:1; }
      50% { opacity:0.7; }
    }
    .hero h1 {
      font-size:clamp(28px,7vw,42px);
      font-weight:800;
      line-height:1.15;
      margin-bottom:16px;
      background:linear-gradient(135deg, ${textColor}, ${primaryColor});
      -webkit-background-clip:text;
      -webkit-text-fill-color:transparent;
      background-clip:text;
    }
    .hero p {
      font-size:16px;
      color:${textColor}cc;
      margin-bottom:24px;
      max-width:400px;
    }
    .hero-image {
      margin:24px 0;
      max-width:320px;
      width:100%;
    }
    
    /* Countdown Timer */
    .countdown {
      display:flex;
      gap:12px;
      justify-content:center;
      margin:20px 0;
    }
    .countdown-item {
      background:${primaryColor}15;
      border:1px solid ${primaryColor}30;
      border-radius:12px;
      padding:10px 14px;
      text-align:center;
      min-width:60px;
    }
    .countdown-item .number {
      font-size:24px;
      font-weight:800;
      color:${primaryColor};
      display:block;
    }
    .countdown-item .label {
      font-size:11px;
      color:${textColor}80;
      text-transform:uppercase;
      letter-spacing:0.5px;
    }
    .urgency-text {
      color:${primaryColor};
      font-weight:600;
      font-size:14px;
      margin-bottom:8px;
    }
    
    /* Benefits */
    .benefits {
      padding:40px 20px;
      background:${secondaryColor};
    }
    .benefits h2 {
      text-align:center;
      font-size:24px;
      font-weight:700;
      margin-bottom:32px;
    }
    .benefit-item {
      display:flex;
      align-items:flex-start;
      gap:14px;
      padding:16px;
      margin-bottom:12px;
      background:${bgColor}80;
      border-radius:12px;
      border:1px solid ${primaryColor}15;
      transition:transform 0.3s,border-color 0.3s;
    }
    .benefit-item:hover {
      transform:translateX(4px);
      border-color:${primaryColor}40;
    }
    .benefit-icon {
      font-size:28px;
      flex-shrink:0;
      width:44px;
      height:44px;
      display:flex;
      align-items:center;
      justify-content:center;
      background:${primaryColor}15;
      border-radius:10px;
    }
    .benefit-item h3 {
      font-size:15px;
      font-weight:600;
      margin-bottom:4px;
    }
    .benefit-item p {
      font-size:13px;
      color:${textColor}99;
    }
    
    /* Social Proof */
    .social-proof {
      text-align:center;
      padding:24px 20px;
      background:${primaryColor}10;
      border-top:1px solid ${primaryColor}20;
      border-bottom:1px solid ${primaryColor}20;
    }
    .social-proof p {
      font-size:14px;
      font-weight:500;
    }
    .social-proof span { color:${primaryColor}; font-weight:700; }
    
    /* Form Section */
    .form-section {
      padding:40px 20px;
      background:${bgColor};
    }
    .form-section h2 {
      text-align:center;
      font-size:22px;
      font-weight:700;
      margin-bottom:8px;
    }
    .form-section .subtitle {
      text-align:center;
      color:${textColor}80;
      font-size:14px;
      margin-bottom:24px;
    }
    .form-card {
      background:${secondaryColor};
      border-radius:16px;
      padding:24px;
      border:1px solid ${primaryColor}20;
    }
    .form-group {
      margin-bottom:16px;
    }
    .form-group label {
      display:block;
      font-size:13px;
      font-weight:500;
      margin-bottom:6px;
      color:${textColor}cc;
    }
    .form-group input,
    .form-group textarea {
      width:100%;
      padding:12px 14px;
      background:${bgColor};
      border:1px solid ${primaryColor}20;
      border-radius:10px;
      color:${textColor};
      font-size:15px;
      font-family:inherit;
      transition:border-color 0.3s;
      outline:none;
    }
    .form-group input:focus,
    .form-group textarea:focus {
      border-color:${primaryColor};
      box-shadow:0 0 0 3px ${primaryColor}20;
    }
    .form-group textarea {
      resize:vertical;
      min-height:80px;
    }
    .submit-btn {
      width:100%;
      padding:16px;
      background:linear-gradient(135deg, ${primaryColor}, ${accentColor});
      color:#fff;
      border:none;
      border-radius:12px;
      font-size:17px;
      font-weight:700;
      cursor:pointer;
      transition:transform 0.2s,box-shadow 0.2s;
      letter-spacing:0.3px;
    }
    .submit-btn:hover {
      transform:translateY(-2px);
      box-shadow:0 8px 25px ${primaryColor}40;
    }
    .submit-btn:active { transform:translateY(0); }
    .submit-btn:disabled {
      opacity:0.6;
      cursor:not-allowed;
      transform:none;
    }
    .guarantee {
      text-align:center;
      margin-top:16px;
      font-size:12px;
      color:${textColor}60;
    }
    .guarantee span { color:${primaryColor}; }
    
    /* Sticky CTA (mobile) */
    .sticky-cta {
      position:fixed;
      bottom:0;left:0;right:0;
      padding:12px 16px;
      background:${bgColor}f0;
      backdrop-filter:blur(10px);
      border-top:1px solid ${primaryColor}30;
      z-index:1000;
      display:none;
    }
    .sticky-cta button {
      width:100%;
      padding:14px;
      background:linear-gradient(135deg, ${primaryColor}, ${accentColor});
      color:#fff;
      border:none;
      border-radius:10px;
      font-size:16px;
      font-weight:700;
      cursor:pointer;
    }
    @media(max-width:768px) {
      .sticky-cta { display:block; }
      .form-section { padding-bottom:80px; }
    }

    /* Success state */
    .success-message {
      display:none;
      text-align:center;
      padding:32px;
    }
    .success-message .icon { font-size:48px; margin-bottom:16px; }
    .success-message h3 { font-size:20px; font-weight:700; color:${primaryColor}; margin-bottom:8px; }
    .success-message p { color:${textColor}80; }
    
    /* Loading spinner */
    .spinner {
      display:inline-block;
      width:20px;height:20px;
      border:3px solid rgba(255,255,255,.3);
      border-radius:50%;
      border-top-color:#fff;
      animation:spin .8s ease-in-out infinite;
      margin-right:8px;
      vertical-align:middle;
    }
    @keyframes spin { to{transform:rotate(360deg)} }
  </style>
</head>
<body>

  <!-- Hero -->
  <section class="hero">
    <div class="hero-badge">🔥 ${variantContent.urgencyText || 'Ưu đãi có hạn'}</div>
    <h1>${variantContent.headline}</h1>
    <p>${variantContent.subheadline}</p>
    <div class="hero-image">${productImageHtml}</div>
    
    <div class="countdown" id="countdown">
      <div class="countdown-item"><span class="number" id="hours">23</span><span class="label">Giờ</span></div>
      <div class="countdown-item"><span class="number" id="minutes">59</span><span class="label">Phút</span></div>
      <div class="countdown-item"><span class="number" id="seconds">59</span><span class="label">Giây</span></div>
    </div>
  </section>
  
  <!-- Social Proof -->
  <div class="social-proof">
    <p>⭐⭐⭐⭐⭐ <span>${variantContent.socialProofText || '1000+ khách hàng đã tin dùng'}</span></p>
  </div>
  
  <!-- Benefits -->
  <section class="benefits">
    <div class="container">
      <h2>Tại sao chọn ${productName}?</h2>
      ${benefitsHtml}
    </div>
  </section>
  
  <!-- Lead Form -->
  <section class="form-section" id="form-section">
    <div class="container">
      <h2>Đăng ký ngay hôm nay</h2>
      <p class="subtitle">${variantContent.urgencyText || 'Số lượng có hạn - Đừng bỏ lỡ!'}</p>
      
      <div class="form-card">
        <form id="leadForm">
          <div class="form-group">
            <label>Họ và tên *</label>
            <input type="text" name="name" placeholder="Nguyễn Văn A" required>
          </div>
          <div class="form-group">
            <label>Số điện thoại *</label>
            <input type="tel" name="phone" placeholder="0912 345 678" required>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" name="email" placeholder="email@example.com">
          </div>
          <div class="form-group">
            <label>Ghi chú</label>
            <textarea name="notes" placeholder="Bạn cần tư vấn gì thêm?"></textarea>
          </div>
          <button type="submit" class="submit-btn" id="submitBtn">${variantContent.ctaText || 'ĐĂNG KÝ NGAY'}</button>
          <div class="guarantee">🛡️ <span>${variantContent.guaranteeText || 'Cam kết bảo mật thông tin 100%'}</span></div>
        </form>
        
        <div class="success-message" id="successMessage">
          <div class="icon">🎉</div>
          <h3>Đăng ký thành công!</h3>
          <p>Chúng tôi sẽ liên hệ bạn trong thời gian sớm nhất.</p>
        </div>
      </div>
    </div>
  </section>
  
  <!-- Sticky CTA Mobile -->
  <div class="sticky-cta">
    <button onclick="document.getElementById('form-section').scrollIntoView({behavior:'smooth'})">${variantContent.ctaText || 'ĐĂNG KÝ NGAY'} →</button>
  </div>

  <script>
    // Countdown Timer
    (function() {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + 24);
      
      function updateCountdown() {
        const now = new Date();
        const diff = deadline - now;
        if (diff <= 0) return;
        
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        
        document.getElementById('hours').textContent = String(h).padStart(2,'0');
        document.getElementById('minutes').textContent = String(m).padStart(2,'0');
        document.getElementById('seconds').textContent = String(s).padStart(2,'0');
      }
      setInterval(updateCountdown, 1000);
      updateCountdown();
    })();
    
    // Form submission
    document.getElementById('leadForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Đang gửi...';
      
      const formData = new FormData(this);
      const data = Object.fromEntries(formData.entries());
      data.variant = 'A';
      data.timestamp = new Date().toISOString();
      data.source = window.location.href;
      
      ${googleSheetWebhook ? `
      try {
        await fetch('${googleSheetWebhook}', {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } catch(err) { console.error('Webhook error:', err); }
      ` : '// No webhook configured'}
      
      document.getElementById('leadForm').style.display = 'none';
      document.getElementById('successMessage').style.display = 'block';
      btn.disabled = false;
      btn.textContent = '${variantContent.ctaText || 'ĐĂNG KÝ NGAY'}';
    });
  </script>
  ${trackingScripts.body}
</body>
</html>`;
}

/**
 * Build tracking scripts for the landing page
 */
function buildTrackingScripts(googleAdsTracking, facebookPixelId, tiktokPixelId) {
  let head = '';
  let body = '';

  if (googleAdsTracking) {
    head += `\n  <!-- Google Ads -->\n  ${googleAdsTracking}`;
  }

  if (facebookPixelId) {
    head += `\n  <!-- Facebook Pixel -->
  <script>
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init','${facebookPixelId}');fbq('track','PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${facebookPixelId}&ev=PageView&noscript=1"/></noscript>`;
  }

  if (tiktokPixelId) {
    head += `\n  <!-- TikTok Pixel -->
  <script>
    !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
    ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
    ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
    for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
    ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
    ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e+""]=+new Date;
    ttq._o=ttq._o||{};ttq._o[e+""]=n||{};var o=document.createElement("script");
    o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
    var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
    ttq.load('${tiktokPixelId}');ttq.page();
    }(window,document,'ttq');
  </script>`;
  }

  return { head, body };
}

/**
 * Default content if Gemini is not used
 */
function getDefaultContentA(name, desc) {
  return {
    headline: `${name} - Giải Pháp Hoàn Hảo Cho Bạn`,
    subheadline: desc || 'Trải nghiệm sản phẩm chất lượng cao với ưu đãi hấp dẫn',
    benefitsList: [
      { icon: '✅', title: 'Chất lượng cao cấp', desc: 'Sản phẩm được chọn lọc kỹ lưỡng' },
      { icon: '🚀', title: 'Giao hàng nhanh chóng', desc: 'Nhận hàng trong 24-48 giờ' },
      { icon: '💎', title: 'Ưu đãi đặc biệt', desc: 'Giá tốt nhất thị trường' },
      { icon: '🔥', title: 'Hỗ trợ 24/7', desc: 'Đội ngũ tư vấn chuyên nghiệp' },
    ],
    ctaText: 'ĐĂNG KÝ NGAY',
    urgencyText: 'Chỉ còn vài suất cuối cùng!',
    socialProofText: '1,000+ khách hàng đã tin dùng',
    guaranteeText: 'Cam kết bảo mật thông tin 100%',
  };
}
