import { encode } from '@msgpack/msgpack';

/**
 * Generate a random 8-character alphanumeric string for Webcake IDs
 */
function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export function generatePkeBuffer(html, productName = 'Landing Page') {
  const pageId = generateId();
  const sectionId = generateId();
  const textBlockId = generateId();

  const escapedHtml = html.trim();

  // Re-creating the minimum valid Webcake Schema based on our analysis
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
        favicon: '',
        facebook_pixel_ids: [],
        description: '',
        custom_code: '',
        auto_save_info_user: '0',
        auto_save_draft: '1',
        auto_save_abandoned_cart: '0',
        abandonedCartConfigs: {},
      },
      popup: [],
      page: [
        {
          type: 'section',
          specials: {},
          runtime: { firstInit: false },
          responsive: {
            mobile: {
              styles: { position: 'relative', height: 10000 },
              config: { overlay: '', notloaded: false, bgOverlayHidden: {}, bgHidden: {} }
            },
            desktop: {
              styles: { position: 'relative', height: 10000 },
              config: { overlay: '', notloaded: false, bgOverlayHidden: {}, bgHidden: {} }
            }
          },
          properties: { sync: true, name: 'section_1', movable: false },
          id: sectionId,
          events: [],
          children: [
            {
              type: 'text-block',
              specials: { text: escapedHtml, tag: 'div' },
              runtime: { firstInit: false },
              responsive: {
                mobile: {
                  styles: {
                    width: 420,
                    top: 0,
                    left: 0,
                    height: 10000,
                    zIndex: 1,
                  },
                  config: { notloaded: false }
                },
                desktop: {
                  styles: {
                    width: 1200,
                    top: 0,
                    left: 0,
                    height: 10000,
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
