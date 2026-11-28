import Script from 'next/script';
import pixel from '@/data/meta-pixel.json';

/**
 * Meta (Facebook) Pixel, on the shop pages only: lets Facebook ads count
 * visits and purchases. Off while src/data/meta-pixel.json has no pixelId.
 * The paid-order page (functions-lib/orders.js) reads the same file and sends
 * the Purchase event. The privacy policy mentions the pixel only when it is on.
 */
export const PIXEL_ID: string = (pixel as { pixelId?: string }).pixelId?.trim() ?? '';

export function MetaPixel({ viewContent }: { viewContent?: { id: string; name: string; value: number } }) {
  if (!/^\d{5,20}$/.test(PIXEL_ID)) return null;
  const data = viewContent
    ? JSON.stringify({
        content_ids: [viewContent.id],
        content_name: viewContent.name,
        content_type: 'product',
        value: viewContent.value,
        currency: 'BDT',
      })
    : '';
  // InitiateCheckout when the buy form (BuyForm, a plain POST form) is sent:
  // hold the submit a moment so the event leaves before the page navigates.
  const extra = viewContent
    ? `fbq('track','ViewContent',${data});
document.addEventListener('submit',function(e){var f=e.target;if(!f||f.getAttribute('action')!=='/api/eps/checkout'||f.dataset.ic)return;e.preventDefault();f.dataset.ic='1';try{fbq('track','InitiateCheckout',${data})}catch(_){}setTimeout(function(){f.submit()},400)});`
    : '';
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${PIXEL_ID}');fbq('track','PageView');${extra}`}
    </Script>
  );
}
