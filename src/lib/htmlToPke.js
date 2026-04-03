import { encode } from '@msgpack/msgpack';

/**
 * Generate a random 8-character alphanumeric string for Webcake IDs
 */
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Extract CSS from HTML head section
 */
function extractStyles(html) {
  const styles = [];
  
  // Extract inline <style> blocks
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    styles.push(match[1]);
  }
  
  return styles.join('\n');
}

/**
 * Extract body content from full HTML document
 */
function extractBodyContent(html) {
  // Try to extract <body> content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    return bodyMatch[1].trim();
  }
  // If no body tag, return the html as-is (might already be a fragment)
  return html.trim();
}

/**
 * Extract scripts from HTML
 */
function extractScripts(html) {
  const scripts = [];
  // Only grab non-module, non-data scripts (actual JS code)
  const scriptRegex = /<script(?![^>]*(?:type\s*=\s*["'](?:application\/json|application\/ld\+json)["']))[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const content = match[1].trim();
    if (content && content.length > 10 && !content.startsWith('{')) {
      scripts.push(content);
    }
  }
  return scripts.join('\n;\n');
}

/**
 * Convert HTML to Webcake's .pke format (MessagePack + Base64)
 * 
 * Strategy: 
 * - Extract CSS → put into extra_css setting
 * - Extract JS → put into extra_script setting  
 * - Extract body content → put into text-block specials.text
 * - This way Webcake can render the content properly
 * 
 * @param {string} html - The full HTML page content
 * @param {string} productName - The name of the product/page 
 * @returns {string} The base64 encoded .pke content
 */
export function generatePkeBuffer(html, productName = 'Landing Page') {
  const sectionId = generateId();
  const textBlockId = generateId();

  // Separate HTML into components Webcake can handle
  const css = extractStyles(html);
  const bodyContent = extractBodyContent(html);
  const scripts = extractScripts(html);

  // Wrap body content with scoped styles inline 
  // This ensures styles work even if extra_css isn't applied
  const wrappedContent = css 
    ? `<style>${css}</style>\n${bodyContent}`
    : bodyContent;

  // Build the valid Webcake Schema
  const pkeData = {
    source: {
      settings: {
        width_section: { mobile: 420, desktop: 1200 },
        title: productName,
        tiktok_script: '',
        thumbnail: '',
        send_info_to_thank_page: '',
        keywords: '',
        global_track_ids: [],
        gg_tag_manager_id: '',
        fontGeneral: 'Muli',
        fb_tracking_code: '',
        favicon: '',
        extra_script: scripts || '',
        extra_css: css || '',
        description: '',
        country: 'VN',
        bhet: '',
        bbet: '',
        auto_save_info_user: '0',
        auto_save_draft: '1',
        auto_complete_form_in_popup: '0',
        analytic_heatmap: '',
      },
      popup: [],
      page: [
        {
          type: 'section',
          specials: {},
          runtime: { firstInit: false },
          responsive: {
            mobile: {
              styles: { position: 'relative', height: 'auto' },
              config: { overlay: '', notloaded: false, bgOverlayHidden: {}, bgHidden: {} }
            },
            desktop: {
              styles: { position: 'relative', height: 'auto' },
              config: { overlay: '', notloaded: false, bgOverlayHidden: {}, bgHidden: {} }
            }
          },
          properties: { sync: true, name: 'Section', movable: false },
          id: sectionId,
          events: [],
          children: [
            {
              type: 'text-block',
              specials: { text: wrappedContent, tag: 'div' },
              runtime: { firstInit: false },
              responsive: {
                mobile: {
                  styles: {
                    width: 420,
                    top: 0,
                    left: 0,
                    height: 'auto',
                    zIndex: 1,
                  },
                  config: { notloaded: false }
                },
                desktop: {
                  styles: {
                    width: 1200,
                    top: 0,
                    left: 0,
                    height: 'auto',
                    zIndex: 1,
                  },
                  config: { notloaded: false }
                }
              },
              properties: { sync: true, name: 'text_block_1', movable: true },
              id: textBlockId,
              events: [],
              children: []
            }
          ]
        }
      ],
      options: { versionID: '', mobileOnly: false, currency: 'VND' },
      cartConfigs: {}
    },
    owner_id: '00000000-0000-0000-0000-000000000000',
    name: productName,
    engine: 2,
    email: {},
    data_set_id: []
  };

  // Convert to MessagePack format
  const buffer = encode(pkeData);

  // Convert to Base64 String (chunked to avoid browser stack overflow)
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK_SIZE = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk);
  }
  const base64String = btoa(binary);

  return base64String;
}
