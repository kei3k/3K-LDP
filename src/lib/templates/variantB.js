/**
 * Variant B Template: Testimonials, 2-step form, social proof stats
 * Generates standalone HTML with inline CSS and embedded JS
 */

export function generateVariantB(config, colors, content) {
  const {
    productName, productDescription, productImage,
    googleSheetWebhook, googleAdsTracking, facebookPixelId, tiktokPixelId
  } = config;

  const variantContent = content?.variantB || getDefaultContentB(productName, productDescription);
  const primaryColor = colors?.primary || '#3b82f6';
  const secondaryColor = colors?.secondary || '#1a1a2e';
  const accentColor = colors?.accent || '#f59e0b';
  const bgColor = colors?.background || '#0f0f1a';
  const textColor = colors?.text || '#ffffff';

  const productImageHtml = productImage
    ? `<img src="${productImage}" alt="${productName}" style="max-width:100%;height:auto;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.3);">`
    : '';

  const benefitsHtml = (variantContent.benefitsList || []).map(b => `
    <div class="benefit-card">
      <span class="benefit-icon">${b.icon}</span>
      <h3>${b.title}</h3>
      <p>${b.desc}</p>
    </div>
  `).join('');

  const testimonialsHtml = (variantContent.testimonials || []).map(t => `
    <div class="testimonial-card">
      <div class="stars">${'⭐'.repeat(t.rating || 5)}</div>
      <p class="quote">"${t.text}"</p>
      <div class="author">
        <div class="avatar">${t.name.charAt(0)}</div>
        <div>
          <div class="name">${t.name}</div>
          <div class="role">${t.role}</div>
        </div>
      </div>
    </div>
  `).join('');

  const statsHtml = (variantContent.socialProofStats || []).map(s => `
    <div class="stat-item">
      <div class="stat-number">${s.number}</div>
      <div class="stat-label">${s.label}</div>
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
      padding:60px 20px 40px;
      text-align:center;
      background:linear-gradient(180deg, ${secondaryColor} 0%, ${bgColor} 100%);
      position:relative;
    }
    .hero::before {
      content:'';
      position:absolute;
      top:-50%;left:-50%;
      width:200%;height:200%;
      background:radial-gradient(circle at 50% 80%, ${primaryColor}12 0%, transparent 50%);
      pointer-events:none;
    }
    .hero h1 {
      font-size:clamp(26px,6.5vw,38px);
      font-weight:800;
      line-height:1.2;
      margin-bottom:14px;
    }
    .hero p {
      font-size:16px;
      color:${textColor}bb;
      margin-bottom:24px;
      max-width:380px;
      margin-left:auto;
      margin-right:auto;
    }
    .hero-image {
      max-width:300px;
      width:100%;
      margin:0 auto 20px;
    }
    
    /* Social Proof Stats */
    .stats-bar {
      display:flex;
      justify-content:center;
      gap:24px;
      padding:24px 20px;
      background:${primaryColor}08;
      border-top:1px solid ${primaryColor}15;
      border-bottom:1px solid ${primaryColor}15;
    }
    .stat-item { text-align:center; }
    .stat-number {
      font-size:24px;
      font-weight:800;
      color:${primaryColor};
    }
    .stat-label {
      font-size:12px;
      color:${textColor}80;
      margin-top:2px;
    }
    
    /* Benefits Grid */
    .benefits {
      padding:40px 20px;
    }
    .benefits h2 {
      text-align:center;
      font-size:22px;
      font-weight:700;
      margin-bottom:24px;
    }
    .benefits-grid {
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
    }
    .benefit-card {
      background:${secondaryColor};
      border:1px solid ${primaryColor}15;
      border-radius:14px;
      padding:20px 16px;
      text-align:center;
      transition:transform 0.3s,border-color 0.3s;
    }
    .benefit-card:hover {
      transform:translateY(-4px);
      border-color:${primaryColor}40;
    }
    .benefit-icon {
      font-size:32px;
      display:block;
      margin-bottom:10px;
    }
    .benefit-card h3 {
      font-size:14px;
      font-weight:600;
      margin-bottom:6px;
    }
    .benefit-card p {
      font-size:12px;
      color:${textColor}80;
    }
    
    /* Testimonials */
    .testimonials {
      padding:40px 20px;
      background:${secondaryColor};
    }
    .testimonials h2 {
      text-align:center;
      font-size:22px;
      font-weight:700;
      margin-bottom:24px;
    }
    .testimonial-card {
      background:${bgColor};
      border:1px solid ${primaryColor}15;
      border-radius:14px;
      padding:20px;
      margin-bottom:12px;
    }
    .testimonial-card .stars {
      font-size:14px;
      margin-bottom:10px;
    }
    .testimonial-card .quote {
      font-size:14px;
      font-style:italic;
      color:${textColor}cc;
      margin-bottom:14px;
      line-height:1.5;
    }
    .testimonial-card .author {
      display:flex;
      align-items:center;
      gap:10px;
    }
    .testimonial-card .avatar {
      width:36px;height:36px;
      border-radius:50%;
      background:linear-gradient(135deg, ${primaryColor}, ${accentColor});
      display:flex;
      align-items:center;
      justify-content:center;
      font-weight:700;
      font-size:14px;
      color:#fff;
    }
    .testimonial-card .name {
      font-size:13px;
      font-weight:600;
    }
    .testimonial-card .role {
      font-size:11px;
      color:${textColor}70;
    }
    
    /* 2-Step Form */
    .form-section {
      padding:40px 20px;
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
    /* Step indicator */
    .step-indicator {
      display:flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      margin-bottom:24px;
    }
    .step-dot {
      width:32px;height:32px;
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:13px;
      font-weight:700;
      background:${bgColor};
      border:2px solid ${primaryColor}30;
      color:${textColor}60;
      transition:all 0.3s;
    }
    .step-dot.active {
      background:${primaryColor};
      border-color:${primaryColor};
      color:#fff;
    }
    .step-dot.done {
      background:${primaryColor};
      border-color:${primaryColor};
      color:#fff;
    }
    .step-line {
      width:60px;height:2px;
      background:${primaryColor}30;
      border-radius:1px;
    }
    .step-line.done { background:${primaryColor}; }
    
    .form-step { display:none; }
    .form-step.active { display:block; }
    
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
    .btn-primary {
      width:100%;
      padding:14px;
      background:linear-gradient(135deg, ${primaryColor}, ${accentColor});
      color:#fff;
      border:none;
      border-radius:12px;
      font-size:16px;
      font-weight:700;
      cursor:pointer;
      transition:transform 0.2s,box-shadow 0.2s;
    }
    .btn-primary:hover {
      transform:translateY(-2px);
      box-shadow:0 8px 25px ${primaryColor}40;
    }
    .btn-primary:disabled {
      opacity:0.6;
      cursor:not-allowed;
      transform:none;
    }
    .btn-secondary {
      width:100%;
      padding:12px;
      background:transparent;
      color:${textColor}80;
      border:1px solid ${primaryColor}20;
      border-radius:10px;
      font-size:14px;
      cursor:pointer;
      margin-top:8px;
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
    
    /* Success */
    .success-message {
      display:none;
      text-align:center;
      padding:32px;
    }
    .success-message .icon { font-size:48px; margin-bottom:16px; }
    .success-message h3 { font-size:20px; font-weight:700; color:${primaryColor}; margin-bottom:8px; }
    .success-message p { color:${textColor}80; }
    
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
    <h1>${variantContent.headline}</h1>
    <p>${variantContent.subheadline}</p>
    <div class="hero-image">${productImageHtml}</div>
  </section>
  
  <!-- Social Proof Stats -->
  <div class="stats-bar">
    ${statsHtml}
  </div>
  
  <!-- Benefits -->
  <section class="benefits">
    <div class="container">
      <h2>Tại sao chọn ${productName}?</h2>
      <div class="benefits-grid">
        ${benefitsHtml}
      </div>
    </div>
  </section>
  
  <!-- Testimonials -->
  <section class="testimonials">
    <div class="container">
      <h2>Khách hàng nói gì?</h2>
      ${testimonialsHtml}
    </div>
  </section>
  
  <!-- 2-Step Form -->
  <section class="form-section" id="form-section">
    <div class="container">
      <h2>Đăng ký nhận ưu đãi</h2>
      <p class="subtitle">Chỉ mất 30 giây để đăng ký</p>
      
      <div class="form-card">
        <div class="step-indicator">
          <div class="step-dot active" id="dot1">1</div>
          <div class="step-line" id="line1"></div>
          <div class="step-dot" id="dot2">2</div>
        </div>
        
        <form id="leadForm">
          <!-- Step 1 -->
          <div class="form-step active" id="step1">
            <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;text-align:center;">${variantContent.step1Title || 'Bước 1: Thông tin cơ bản'}</h3>
            <div class="form-group">
              <label>Họ và tên *</label>
              <input type="text" name="name" placeholder="Nguyễn Văn A" required>
            </div>
            <div class="form-group">
              <label>Số điện thoại *</label>
              <input type="tel" name="phone" placeholder="0912 345 678" required>
            </div>
            <button type="button" class="btn-primary" id="nextBtn" onclick="goToStep2()">Tiếp tục →</button>
          </div>
          
          <!-- Step 2 -->
          <div class="form-step" id="step2">
            <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;text-align:center;">${variantContent.step2Title || 'Bước 2: Hoàn tất đăng ký'}</h3>
            <div class="form-group">
              <label>Email</label>
              <input type="email" name="email" placeholder="email@example.com">
            </div>
            <div class="form-group">
              <label>Ghi chú</label>
              <textarea name="notes" placeholder="Bạn muốn tìm hiểu thêm về..."></textarea>
            </div>
            <button type="submit" class="btn-primary" id="submitBtn">${variantContent.ctaText || 'HOÀN TẤT ĐĂNG KÝ'}</button>
            <button type="button" class="btn-secondary" onclick="goToStep1()">← Quay lại</button>
          </div>
        </form>
        
        <div class="success-message" id="successMessage">
          <div class="icon">🎉</div>
          <h3>Đăng ký thành công!</h3>
          <p>Chúng tôi sẽ liên hệ bạn trong thời gian sớm nhất.</p>
        </div>
        
        <div class="guarantee">🛡️ <span>Cam kết bảo mật thông tin 100%</span></div>
      </div>
    </div>
  </section>
  
  <!-- Sticky CTA Mobile -->
  <div class="sticky-cta">
    <button onclick="document.getElementById('form-section').scrollIntoView({behavior:'smooth'})">${variantContent.ctaText || 'ĐĂNG KÝ NGAY'} →</button>
  </div>

  <script>
    // 2-step form logic
    function goToStep2() {
      const name = document.querySelector('[name="name"]').value;
      const phone = document.querySelector('[name="phone"]').value;
      if (!name || !phone) {
        alert('Vui lòng nhập đầy đủ họ tên và số điện thoại');
        return;
      }
      document.getElementById('step1').classList.remove('active');
      document.getElementById('step2').classList.add('active');
      document.getElementById('dot1').classList.remove('active');
      document.getElementById('dot1').classList.add('done');
      document.getElementById('dot2').classList.add('active');
      document.getElementById('line1').classList.add('done');
    }
    
    function goToStep1() {
      document.getElementById('step2').classList.remove('active');
      document.getElementById('step1').classList.add('active');
      document.getElementById('dot2').classList.remove('active');
      document.getElementById('dot1').classList.remove('done');
      document.getElementById('dot1').classList.add('active');
      document.getElementById('line1').classList.remove('done');
    }
    
    // Form submission
    document.getElementById('leadForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Đang gửi...';
      
      const formData = new FormData(this);
      const data = Object.fromEntries(formData.entries());
      data.variant = 'B';
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
    });
  </script>
  ${trackingScripts.body}
</body>
</html>`;
}

/**
 * Build tracking scripts
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
  </script>`;
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
function getDefaultContentB(name, desc) {
  return {
    headline: `Khám Phá ${name} - Được Hàng Nghìn Người Tin Dùng`,
    subheadline: desc || 'Tham gia cộng đồng khách hàng hài lòng ngay hôm nay',
    benefitsList: [
      { icon: '⭐', title: 'Chất lượng vượt trội', desc: 'Được kiểm định nghiêm ngặt' },
      { icon: '💪', title: 'Hiệu quả ngay', desc: 'Thấy kết quả từ lần đầu' },
      { icon: '🎯', title: 'Dễ sử dụng', desc: 'Ai cũng dùng được' },
      { icon: '❤️', title: 'An toàn tuyệt đối', desc: 'Công nghệ tiên tiến' },
    ],
    ctaText: 'HOÀN TẤT ĐĂNG KÝ',
    testimonials: [
      { name: 'Nguyễn Văn A', role: 'Doanh nhân', text: 'Sản phẩm tuyệt vời, tôi rất hài lòng!', rating: 5 },
      { name: 'Trần Thị B', role: 'Nhân viên VP', text: 'Đã dùng 3 tháng và kết quả rất tốt.', rating: 5 },
      { name: 'Lê Văn C', role: 'Sinh viên', text: 'Giá cả hợp lý, chất lượng cao.', rating: 5 },
    ],
    socialProofStats: [
      { number: '10,000+', label: 'Khách hàng' },
      { number: '99%', label: 'Hài lòng' },
      { number: '24/7', label: 'Hỗ trợ' },
    ],
    step1Title: 'Bước 1: Thông tin cơ bản',
    step2Title: 'Bước 2: Hoàn tất đăng ký',
  };
}
